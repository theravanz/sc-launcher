package com.structurecraft.launcherauth.velocity;

import com.google.inject.Inject;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.event.connection.PluginMessageEvent;
import com.velocitypowered.api.event.player.ServerPreConnectEvent;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.proxy.messages.MinecraftChannelIdentifier;
import com.velocitypowered.api.scheduler.ScheduledTask;
import net.kyori.adventure.text.Component;
import org.slf4j.Logger;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * StructureCraftAuth для Velocity-прокси.
 *
 * Клиентский лаунчер-мод шлёт Supabase JWT по плагин-каналу {@code myproject:auth};
 * плагин валидирует его локально (HMAC-SHA256) и пускает на сервер только
 * авторизованных игроков — остальных кикает.
 *
 * Файл настроек: {@code <dataDirectory>/config.yml} (создаётся при первом запуске).
 */
@Plugin(
        id = "structurecraftauth",
        name = "StructureCraftAuth",
        version = "1.0.0",
        authors = {"myproject"}
)
public final class VelocityAuthPlugin {

    /** Имя плагин-канала (совпадает с каналом в клиентском моде и Bukkit-плагине). */
    private static final String CHANNEL = "myproject:auth";

    private static final String KICK_MESSAGE =
            "Пожалуйста, войдите через официальный лаунчер!";

    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;

    private JwtValidator validator;
    private long timeoutMillis = 5_000L;

    /** Игроки, подтверждённые валидным JWT (по UUID). */
    private final Map<UUID, Long> authorized = new ConcurrentHashMap<>();

    /** Запланированные кики для игроков, ожидающих JWT. */
    private final Map<UUID, ScheduledTask> pendingKicks = new ConcurrentHashMap<>();

    @Inject
    public VelocityAuthPlugin(ProxyServer server, Logger logger,
                              @DataDirectory Path dataDirectory) {
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
    }

    @Subscribe
    public void onProxyInit(ProxyInitializeEvent event) {
        loadConfig();

        server.getChannelRegistrar().register(MinecraftChannelIdentifier.from(CHANNEL));

        // Регистрируем этот объект как слушатель: все методы с @Subscribe подхватятся
        // автоматически (onPluginMessage, onPreConnect, onDisconnect).
        server.getEventManager().register(this, this);

        logger.info("[StructureCraftAuth] активирован, канал '{}', секрет {}",
                CHANNEL, validator.isConfigured() ? "задан" : "НЕ задан!");
    }

    @Subscribe
    public void onProxyShutdown(ProxyShutdownEvent event) {
        server.getEventManager().unregisterListeners(this);
        pendingKicks.values().forEach(ScheduledTask::cancel);
        pendingKicks.clear();
        authorized.clear();
    }

    /** Читает config.yml (создаётся, если нет). */
    private void loadConfig() {
        try {
            Files.createDirectories(dataDirectory);
            Path file = dataDirectory.resolve("config.yml");
            if (!Files.exists(file)) {
                try (var in = getClass().getResourceAsStream("/config.yml")) {
                    if (in != null) Files.copy(in, file);
                    else Files.writeString(file, "supabase-jwt-secret: ''\n"
                            + "supabase-jwt-secret-is-base64: false\n"
                            + "auth-timeout-seconds: 5\n");
                }
                logger.info("[StructureCraftAuth] создан config.yml: {}", file);
            }

            var props = new java.util.Properties();
            try (var reader = Files.newBufferedReader(file)) {
                props.load(reader);
            }

            String secret = props.getProperty("supabase-jwt-secret", "");
            boolean base64 = Boolean.parseBoolean(
                    props.getProperty("supabase-jwt-secret-is-base64", "false"));
            try {
                this.timeoutMillis = Math.max(1_000L,
                        1_000L * Long.parseLong(props.getProperty("auth-timeout-seconds", "5")));
            } catch (NumberFormatException ignore) {
                this.timeoutMillis = 5_000L;
            }

            this.validator = new JwtValidator(secret, base64);
            if (!validator.isConfigured()) {
                logger.warn("[StructureCraftAuth] supabase-jwt-secret НЕ задан: "
                        + "все игроки будут кикаться! Добавь секрет в config.yml.");
            }
        } catch (IOException ex) {
            logger.error("[StructureCraftAuth] не удалось прочитать config.yml", ex);
            this.validator = new JwtValidator("", false);
        }
    }

    /** Принят JWT от клиентского мода по плагин-каналу. */
    @Subscribe
    public void onPluginMessage(PluginMessageEvent event) {
        if (!(event.getTarget() instanceof Player player)) return;
        byte[] data = event.getData();
        String token = data == null ? "" : new String(data, StandardCharsets.UTF_8);
        if (event.getIdentifier() == null
                || !event.getIdentifier().getId().equalsIgnoreCase(CHANNEL)) return;

        var payload = validator.validate(token);
        if (payload == null) {
            logger.info("[StructureCraftAuth] {}: недействительный JWT -> кик",
                    player.getUsername());
            kick(player);
            return;
        }
        authorized.put(player.getUniqueId(), System.currentTimeMillis());
        ScheduledTask pending = pendingKicks.remove(player.getUniqueId());
        if (pending != null) pending.cancel();
        logger.info("[StructureCraftAuth] {}: авторизован (sub={})",
                player.getUsername(), payload.subject());
    }

    /** Пропускаем игрока, но кикаем через таймаут, если JWT так и не пришёл. */
    @Subscribe
    public void onPreConnect(ServerPreConnectEvent event) {
        Player player = event.getPlayer();
        UUID id = player.getUniqueId();
        if (authorized.containsKey(id) || pendingKicks.containsKey(id)) return;

        ScheduledTask task = server.getScheduler().buildTask(this, () -> {
            pendingKicks.remove(id);
            if (!authorized.containsKey(id)) kick(player);
        }).delay(timeoutMillis, java.util.concurrent.TimeUnit.MILLISECONDS).schedule();

        pendingKicks.put(id, task);
    }

    /** При выходе — сбрасываем авторизацию и таймеры. */
    @Subscribe
    public void onDisconnect(DisconnectEvent event) {
        UUID id = event.getPlayer().getUniqueId();
        authorized.remove(id);
        ScheduledTask pending = pendingKicks.remove(id);
        if (pending != null) pending.cancel();
    }

    private void kick(Player player) {
        player.disconnect(Component.text(KICK_MESSAGE));
        authorized.remove(player.getUniqueId());
    }
}