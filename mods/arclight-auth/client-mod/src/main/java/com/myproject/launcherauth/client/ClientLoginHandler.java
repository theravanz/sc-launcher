package com.myproject.launcherauth.client;

import com.mojang.logging.LogUtils;
import com.myproject.launcherauth.AuthPayload;
import com.myproject.launcherauth.MyProjectMod;
import net.minecraft.client.player.LocalPlayer;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.network.PacketDistributor;
import org.slf4j.Logger;

/**
 * Клиентская часть: отправляет JWT на сервер в момент входа в мир.
 *
 * Класс помечен {@code @EventBusSubscriber(modid=..., value=Dist.CLIENT)} и
 * {@code @SubscribeEvent} — благодаря этому NeoForge сам зарегистрирует
 * метод {@link #onLogin} и будет вызывать его только на клиенте. Без этих
 * аннотаций слушатель не попадает в шину, и пакет никогда не отправляется.
 *
 * Слушает {@link ClientPlayerNetworkEvent.LoggingIn} — событие на КЛИЕНТЕ после
 * установления соединения в игровой (PLAY) фазе, когда канал {@code myproject:auth}
 * уже зарегистрирован.
 *
 * Токен берётся из системного свойства JVM:
 * {@code -Dmyproject.supabase.jwt="<JWT>"} (лаунчер задаёт свойство при запуске).
 * Если свойство пустое (игра запущена вне лаунчера) — пакет не отправляется,
 * и сервер в этом случае закикнет игрока по таймауту.
 */
@EventBusSubscriber(modid = MyProjectMod.MODID, value = Dist.CLIENT)
public final class ClientLoginHandler {

    private static final Logger LOGGER = LogUtils.getLogger();

    private ClientLoginHandler() {
    }

    @SubscribeEvent
    public static void onLogin(ClientPlayerNetworkEvent.LoggingIn event) {
        String jwt = System.getProperty(JavaPropertyKeys.SUPABASE_JWT, "");

        LocalPlayer player = event.getPlayer();

        if (jwt == null || jwt.isBlank()) {
            // Лаунчер не прокинул токен в JVM (игра запущена без -Dmyproject.supabase.jwt).
            LOGGER.info("[myproject:auth] Игрок {}, но JVM-свойство '{}' пустое: "
                            + "токен от лаунчера НЕ получен, пакет не отправляется "
                            + "(сервер закикнет по таймауту).",
                    player != null ? player.getName().getString() : "?",
                    JavaPropertyKeys.SUPABASE_JWT);
            return;
        }

        LOGGER.info("[myproject:auth] JVM-свойство задано, длина токена = {} (игрок {}). "
                        + "Отправляю пакет на сервер.",
                jwt.length(), player != null ? player.getName().getString() : "?");

        // NeoForge 1.21: фактическая отправка в игровой (PLAY) фазе.
        PacketDistributor.sendToServer(new AuthPayload(jwt));
    }
}