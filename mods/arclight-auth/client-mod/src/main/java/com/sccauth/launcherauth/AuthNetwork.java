package com.sccauth.launcherauth;

import net.minecraft.world.entity.player.Player;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.handling.IPayloadContext;

/**
 * Регистрация сетевого канала {@code sccauth:auth}.
 *
 * Обработчик {@link #onRegisterPayloads} подписывается на событие
 * {@link RegisterPayloadHandlersEvent}, которое срабатывает И на клиенте,
 * И на сервере (NeoForge core). Здесь на обеих сторонах объявляется
 * серверный (play->server, т.е. client->server) тип payload.
 *
 * Сетевую (modded) версию канала нужно согласовать между клиентом и сервером —
 * это и есть строка {@link #NETWORK_VERSION}.
 */
public final class AuthNetwork {

    /** Идентификатор канала в терминах Minecraft ResourceLocation: {@code sccauth:auth}. */
    public static final String CHANNEL = "sccauth:auth";

    /** Версия сети, которую клиент и сервер согласуют в хэндшейке RegistryPayloads. */
    public static final String NETWORK_VERSION = "1.21.1";

    private AuthNetwork() {
    }

    /**
     * Регистрирует тип {@link AuthPayload} как серверный (client->server) payload
     * игровой фазы (ConnectionProtocol.PLAY).
     */
    public static void onRegisterPayloads(RegisterPayloadHandlersEvent event) {
        event.registrar(NETWORK_VERSION).playToServer(
                AuthPayload.TYPE,
                AuthPayload.STREAM_CODEC,
                AuthNetwork::handleIncoming);
    }

    /**
     * Обработчик входящего на сервер токена.
     *
     * Вызывается NeoForge на СЕРВЕРЕ (Arclight) при получении {@link AuthPayload}
     * от клиента. Здесь — точка стыковки со Spigot-плагином:
     * можно прокинуть токен в плагин (например, через AuthBridge/шину событий),
     * чтобы плагин выполнил валидацию и кик, либо провалидировать и закикнуть прямо тут.
     *
     * На КЛИЕНТЕ этот обработчик не вызывается (payload серверный).
     */
    private static void handleIncoming(AuthPayload payload, IPayloadContext context) {
        Player player = context.player(); // Player, отправивший токен (net.minecraft ServerPlayer)
        String jwt = payload.jwt();

        // TODO (опционально, для варианта "мод на обеих сторонах"): передать токен в плагин.
        // Например: AuthBridge.forward(player, jwt);
        // Ниже — печать без вывода секрета в логи (токен чувствительный).
        System.out.println("[sccauth:auth] Получен JWT от игрока " + player.getName()
                + ", длина токена=" + jwt.length());
    }
}