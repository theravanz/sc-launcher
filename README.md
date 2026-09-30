This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


---

## Автообновление лаунчера

Лаунчер сам проверяет обновления при запуске (через `tauri-plugin-updater`) и, если вышла
новая версия, скачивает, устанавливает её и перезапускается. Прогресс показывается на экране
обновления, а в настройках («Настройки → Обновления лаунчера») есть кнопка ручной проверки
и текущая версия.

- Эндпоинт: `https://github.com/theravanz/sc-launcher/releases/latest/download/latest.json`
  (настраивается в `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`)
- Обновления подписываются приватным ключом, лаунчер проверяет подпись публичным
  (`plugins.updater.pubkey`) — подделанный файл обновления не установится.
- Обновляются только установленные сборки: Windows — NSIS-инсталлятор, Linux — AppImage
  (deb/rpm обновлять нельзя, это ограничение Tauri).
- В `pnpm dev` (браузер) проверка недоступна; в dev-сборке Tauri авто-проверка отключена,
  но кнопка в настройках работает.

### Как выпустить обновление

1. Поднять версию в `src-tauri/tauri.conf.json` (`"version": "0.1.0"` → `"0.1.1"`).
2. Закоммитить и поставить тег с той же версией:
   ```bash
   git commit -am "chore(release): 0.1.1"
   git tag v0.1.1 && git push origin main v0.1.1
   ```
3. GitHub Actions (`.github/workflows/release.yml`) соберёт приложение под Windows и Linux,
   опубликует релиз и `latest.json`.
4. Установленные лаунчеры при следующем запуске скачают обновление сами.

### Секреты GitHub (Settings → Secrets and variables → Actions)

| Секрет | Значение |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Содержимое приватного ключа `~/.tauri/sc-launcher.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Пусто (ключ создан без пароля) |

Ключи лежат вне репозитория: `~/.tauri/sc-launcher.key` (секретный) и `~/.tauri/sc-launcher.key.pub`.
**Приватный ключ нельзя терять или коммитить**: без него не подписать обновления, а при утечке
злоумышленник сможет выпустить «обновление» от вашего имени. Сделайте бэкап.

Пересоздать пару ключей (после этого нужно поменять `pubkey` в `tauri.conf.json` и выложить
новую версию лаунчера — старые сборки обновляться уже не смогут):

```bash
pnpm tauri signer generate -w ~/.tauri/sc-launcher.key
```

Локальная проверка сборки с подписью артефактов обновления:

```bash
cd src-tauri && cargo test --lib          # тесты ядра лаунчера
TAURI_SIGNING_PRIVATE_KEY_PATH=~/.tauri/sc-launcher.key \
  pnpm tauri build --bundles appimage,deb  # сборка + .sig для обновлений
```
