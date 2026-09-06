package com.myproject.launcherauth.plugin;

import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;
import org.bukkit.plugin.messaging.PluginMessageListenerRegistration;
import org.bukkit.scheduler.BukkitTask;

/**
 * Spigot-плагин (Arclight): только игроки, вошедшие через официальный лаунчер
 * (прислали валидный Supabase JWT по каналу {@code myproject:auth}), остаются
 * на сервере. Остальные получают кик по истечении {@code auth-timeout-seconds}.
 *
 * Пути получения токена:
 *
 *  1. MESSENGER (основной): клиентский мод шлёт JWT в плагин-канал
 *     {@code myproject:auth} ({@link #registerIncomingPluginChannel}), и
 *     {@link PluginMessageListener#onPluginMessageReceived} валидирует токен.
 *
 *  2. (Опционально) NeoForge payload: если мод установлен и на сервере,
 *     обработчик в AuthNetwork может вызвать {@link #tryAuthorize(Player, String)}.
 *
 * Валидация — локальная (HMAC-SHA256/JDK), без обращения к Supabase API.
 */
public final class AuthPlugin extends JavaPlugin implements Listener, PluginMessageListener, CommandExecutor {

    /** Имя плагин-канала (совпадает с каналом в клиентском моде). */
    private static final String CHANNEL = "myproject:auth";

    private static final String KICK_MESSAGE = "Пожалуйста, войдите через официальный лаунчер!";

    /** Таймаут авторизации по умолчанию: 5 секунд. */
    private static final long DEFAULT_TIMEOUT_SECONDS = 5L;

    private static AuthPlugin instance;

    private JwtValidator validator;
    private long timeoutTicks;
    private PluginMessageListenerRegistration registration;

    /** Игроки, подтверждённые валидным JWT за текущую сессию сервера. */
    private final Set<UUID> authorized = ConcurrentHashMap.newKeySet();

    /** Кик-таймеры для игроков, ожидающих авторизации. */
    private final java.util.Map<UUID, BukkitTask> pendingKicks = new ConcurrentHashMap<>();

    @Override
    public void onEnable() {
        instance = this;

        // Создаём plugins/StructureCraftAuth/config.yml при первом запуске
        // (если файла ещё нет).
        saveDefaultConfig();
        applyConfig();

        // Регистрируем обработчик команды /structurecraftauth (reload).
        org.bukkit.command.PluginCommand cmd = getCommand("structurecraftauth");
        if (cmd != null) {
            cmd.setExecutor(this);
        }

        // 1) Регистрируем входящий плагин-канал для приёма JWT от мода.
        this.registration = getServer().getMessenger()
                .registerIncomingPluginChannel(this, CHANNEL, this);

        // 2) Слушаем вход/выход игроков.
        getServer().getPluginManager().registerEvents(this, this);

        getLogger().info("[myproject:auth] сущ. фильтр включён, секрет "
                + (validator.isConfigured() ? "задан" : "НЕ задан!"));
    }

    /** (Пере)читывает config.yml в поля. Вызывается при старте и при reload. */
    private void applyConfig() {
        String secret = getConfig().getString("supabase-jwt-secret", "");
        boolean base64 = getConfig().getBoolean("supabase-jwt-secret-is-base64", true);
        long timeoutSeconds = getConfig().getInt("auth-timeout-seconds", (int) DEFAULT_TIMEOUT_SECONDS);
        this.timeoutTicks = Math.max(20L * timeoutSeconds, 20L); // минимум 1 секунда
        this.validator = new JwtValidator(secret, base64);

        if (!validator.isConfigured()) {
            getLogger().warning("[myproject:auth] supabase-jwt-secret НЕ задан: "
                    + "ВСЕ игроки будут кикаться! Добавь секрет в config.yml "
                    + "и выполни /structurecraftauth reload.");
        }
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length > 0 && args[0].equalsIgnoreCase("reload")) {
            reloadConfig();
            applyConfig();
            sender.sendMessage("StructureCraftAuth: конфиг перезагружен. Секрет "
                    + (validator.isConfigured() ? "задан." : "НЕ задан! Проверь config.yml."));
            return true;
        }
        sender.sendMessage("Использование: /" + label + " reload");
        return true;
    }

    @Override
    public void onDisable() {
        if (registration != null) {
            try {
                getServer().getMessenger().unregisterIncomingPluginChannel(this, CHANNEL);
            } catch (Exception ignored) {
                // канал мог быть уже снят — не критично
            }
        }
        pendingKicks.values().forEach(task -> task.cancel());
        pendingKicks.clear();
        authorized.clear();
        instance = null;
    }

    /** Запускает таймер кика для игрока, если он ещё не авторизован. */
    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        if (player == null || isAuthorized(player)) return;

        UUID id = player.getUniqueId();
        BukkitTask task = Bukkit.getScheduler().runTaskLater(this, () -> {
            pendingKicks.remove(id);
            if (!isAuthorized(player) && player.isOnline()) {
                player.kickPlayer(KICK_MESSAGE);
                getLogger().info("[myproject:auth] кик " + player.getName()
                        + ": авторизация не получена вовремя");
            }
        }, timeoutTicks);
        pendingKicks.put(id, task);
    }

    /** Чистим сеты при выходе игрока (переподключение — повторная авторизация). */
    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        if (player == null) return;
        UUID id = player.getUniqueId();
        authorized.remove(id);
        BukkitTask t = pendingKicks.remove(id);
        if (t != null) t.cancel();
    }

    // ---------------- PluginMessageListener ----------------

    /** Получен JWT от клиентского мода по плагин-каналу. */
    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!CHANNEL.equals(channel) || player == null) return;
        String token = message == null ? "" : new String(message, StandardCharsets.UTF_8);
        tryAuthorize(player, token);
    }

    // ---------------- Валидация ----------------

    /**
     * Валидирует токен и, при успехе, засчитывает игрока авторизованным.
     * Вызывается из {@link #onPluginMessageReceived} (MESSENGER).
     *
     * @return true, если токен валиден и игрок получил доступ.
     */
    public synchronized boolean tryAuthorize(Player player, String token) {
        if (player == null) return false;

        if (token == null || token.isBlank()) {
            // Токена нет (запущено вне лаунчера) — полагаемся на кик по таймауту.
            getLogger().info("[myproject:auth] " + player.getName()
                    + ": JWT не получен (запущено вне лаунчера?)");
            return false;
        }

        JwtValidator.JwtPayload payload = validator.validate(token);
        if (payload == null) {
            // Невалидная/просроченная подпись — кик сразу.
            cancelPending(player.getUniqueId());
            safeKick(player);
            getLogger().info("[myproject:auth] " + player.getName()
                    + ": недействительный JWT -> кик");
            return false;
        }

        cancelPending(player.getUniqueId());
        authorized.add(player.getUniqueId());
        getLogger().info("[myproject:auth] " + player.getName()
                + ": авторизован (sub=" + payload.subject() + ")");
        return true;
    }

    private void cancelPending(UUID id) {
        BukkitTask t = pendingKicks.remove(id);
        if (t != null) t.cancel();
    }

    private void safeKick(Player player) {
        try {
            player.kickPlayer(KICK_MESSAGE);
        } catch (Exception ignored) {
            // если игрок уже отключился — ignore
        }
    }

    private boolean isAuthorized(Player player) {
        return player != null && authorized.contains(player.getUniqueId());
    }

    public static AuthPlugin getInstance() {
        return instance;
    }
}