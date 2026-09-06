# MyProject Launcher Auth (Arclight 1.21.1)

Гейтинг-модуль: на сервер пускаем только тех, кто вошёл через официальный лаунчер.
Лаунчер пробрасывает **Supabase JWT (access token)** в JVM игры через
системное свойство `myproject.supabase.jwt`, клиентский NeoForge-мод отправляет
его на сервер по каналу `myproject:auth`, а Spigot-плагин валидирует токен
(локально, HMAC-SHA256) и кикает всех остальных.

```
+-------------+            +------------+            +---------------------+
| Tauri launcher           | NG клиент   |            | Arclight сервер     |
| ------------|            | (NeoForge)  |            |  (Spigot-плагин)    |
| SUPABASE    |            +------------+            +---------------------+
|  JWT Secret |                                       | registerIncoming    |
|  --->       |  -Dmyproject.supabase.jwt=<JWT>       |  PluginChannel      |
|  auth()     |  --------->  ClientPlayerNetworkEvent |                     |
|             |              PacketDistributor        | onPluginMessage     |
|             |              .sendToServer(payload)   |  Received(...)      |
|             |              (MESSENGER-совместимо)   |  ---> validate()    |
|             |                                       |  ok?  -> доступ     |
|             |                                       |  нет? -> kick       |
+-------------+            +------------+             +---------------------+
```

## Зачем JWT и как это безопасно
- Подпись HS256 сверяется с `SUPABASE_JWT_SECRET` прямо на сервере — **без**
  обращений к Supabase API (нет сетевых вызовов и ожиданий).
- Токен проверяется на срок действия (`exp`): просроченный/подделанный кикается.
- Секрет никогда не печатается в логи.
- Прямой заход без лаунчера токена не даст -> кик по таймауту.

## Состав репозитория
| Путь | Что это |
|------|---------|
| `client-mod/` | NeoForge-мод 1.21.1 (JWT -> сервер по каналу `myproject:auth`) |
| `server-plugin/` | Spigot-плагин 1.21.1 (валидация JWT, кик-таймер) |

---

## 1. Клиентский мод (`client-mod/`)

Ключевые классы:
- `AuthPayload` — серверный payload (поле `String jwt`), канал `myproject:auth`.
- `AuthNetwork` — регистрация типа через `RegisterPayloadHandlersEvent`;
  сетевой неймспейс канала согласуется фазой PLAY, версия `NETWORK_VERSION`.
- `client/ClientLoginHandler` — на `ClientPlayerNetworkEvent.LoggingIn` читает
  свойство `myproject.supabase.jwt` и шлёт `AuthPayload` через
  `PacketDistributor.sendToServer(...)`.

Сборка (NeoForge 1.21.1):
```bash
cd client-mod
# проверь версию NeoForge в build.gradle под твоё ядро Arclight
./gradlew build   # итог: build/libs/*.jar
```

> **Почему событие `LoggingIn`?** В NeoForge 1.21.x оно срабатывает на клиенте
> после установления соединения в игровой (PLAY) фазе — именно тогда канал уже
---

## 2. Серверный плагин (`server-plugin/`)

Ключевые классы:
- `AuthPlugin` — `JavaPlugin implements PluginMessageListener`:
  - `onEnable` регистрирует входящий плагин-канал `myproject:auth`;
  - `onPluginMessageReceived` валидирует полученный JWT;
  - `onJoin` запускает кик через `BukkitScheduler.runTaskLater(...)` (5 c);
  - `tryAuthorize(player, token)` — переиспользуемая точка валидации.
- `JwtValidator` — только JDK: проверка `alg`, подпись HS256
  (`MessageDigest.isEqual`), срок `exp`. Без внешних зависимостей и без
  исключений наружу (любая ошибка разбора -> «невалидно»).

Сборка:
```bash
cd server-plugin
# подставь точную координату spigot-api твоего Arclight в pom.xml
mvn package   # итог: target/myproject-launcher-auth-1.0.0.jar
```

Установка:
1. Положи jar в `plugins/` сервера.
2. При первом запуске плагин создаст `plugins/MyProject Launcher Auth/config.yml` —
   отредактируй его (или скопируй заготовку `docs-config.yml.reference`).

### Настройка секрета (важно!)
В `config.yml` задай секрет из **Supabase Dashboard → Settings → API → JWT Secret**:

```yaml
supabase-jwt-secret: "твой-настоящий-SUPABASE_JWT_SECRET"
supabase-jwt-secret-is-base64: true   # у Supabase секрет base64 — не трогай
auth-timeout-seconds: 5
```

- Пока `supabase-jwt-secret` не настроен, плагин **кикает всех** (и пишет
  предупреждение при старте) — поведение «fail-closed», безопасно по умолчанию.
- После изменения — `reload` плагина или перезапуск сервера.

---

## 3. Лаунчер (Tauri) — передача JWT в JVM

Добавь системное свойство `myproject.supabase.jwt` в аргументы запуска Java
**перед** `-jar`/`-cp` клиента:

```ts
// JS/TS-сторона Tauri
const args = ["-Dmyproject.supabase.jwt=" + jwt, ...lobbyArgs];
spawnGame(args); // ваш рантайм запуска

// Rust-сторона (примерно):
// let args = [Some("-Dmyproject.supabase.jwt=".to_string() + jwt)];
```

Пустое/отсутствующее свойство (игра вне лаунчера) -> мод не шлёт токен -> кик.
Токен имеет короткий срок жизни; главное — не логировать его значение.

---

## Два способа доставки токена (на выбор)

1. **MESSENGER (рекомендуемый)** — мод шлёт payload, Arclight транслирует его в
   плагин-канал `myproject:auth`, плагин валидирует. Мод ставится только игрокам.
2. **NeoForge payload на сервере** — если мод стоит И в `mods` сервера,
   `AuthNetwork.handleIncoming(...)` получает токен напрямую и может вызвать
   `AuthPlugin.tryAuthorize(player, token)`. Полнее, но требует мод на сервере.

## Ограничения и заметки
- Токен должен быть живым **access token** (не просрочен), `auth-timeout-seconds` > 0.
- Локальная валидация доверяет серверу собственный `JWT Secret`; расширять права
  можно чтением `app_metadata` / `role` из payload.
- Проверено по исходникам NeoForge 1.21.1 (`RegisterPayloadHandlersEvent`,
  `PayloadRegistrar`, `PacketDistributor`, `ClientPlayerNetworkEvent`) и стабильному
  Spigot-API (`org.bukkit.plugin.messaging`).
> зарегистрирован и `PacketDistributor` безопасен.