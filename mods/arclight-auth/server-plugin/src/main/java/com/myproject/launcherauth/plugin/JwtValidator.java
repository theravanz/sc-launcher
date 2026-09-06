package com.myproject.launcherauth.plugin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Локальная (без обращения к Supabase API) валидация JWT, подписанного HS256.
 *
 * Проверяет:
 *  1. Структуру токена (3 части, base64url);
 *  2. Алгоритм в header == HS256;
 *  3. Подпись HMAC-SHA256 сверкой с секретом Supabase JWT Secret;
 *  4. Срок действия (exp).
 *
 * Реализация использует только JDK (javax.crypto + java.util.Base64) и не
 * требует внешних зависимостей. Любые ошибки разбора превращаются в результат
 * "невалидно" (null) — сервер такими ошибками уронить нельзя.
 *
 * Примечание про секрет Supabase: в настройках Supabase "JWT Secret" — это
 * base64-значение, которым подписаны токены (HS256). По умолчанию
 * {@code base64Decode=true} разбирает строку в байты ключа. Если провайдер
 * подписывает «сырым» секретом — поставь {@code base64Decode=false}.
 */
public final class JwtValidator {

    /** Данные пользователя, извлечённые из валидного JWT. */
    public record JwtPayload(String subject, String email, String nickname, Instant expiresAt) {
        @Override
        public String toString() {
            return "JwtPayload[sub=" + subject + ", email=" + email + "]";
        }
    }

    private final byte[] secretKey;
    private final boolean configured;

    /**
     * @param configuredSecret строка из конфига (Supabase JWT Secret).
     * @param base64Decode     декодировать ли строку секрета из base64 перед
     *                         использованием как байтов ключа HMAC.
     */
    public JwtValidator(String configuredSecret, boolean base64Decode) {
        String raw = configuredSecret == null ? "" : configuredSecret.trim();
        this.secretKey = base64Decode ? tryBase64Decode(raw) : raw.getBytes(StandardCharsets.UTF_8);
        this.configured = this.secretKey.length > 0;
    }

    /** Сконфигурирован ли секрет (иначе ни один токен не пройдёт). */
    public boolean isConfigured() {
        return configured;
    }

    /**
     * Валидирует токен. Возвращает данные пользователя или {@code null}.
     * Не бросает исключения наружу: ошибки парсинга -> null.
     */
    public JwtPayload validate(String token) {
        try {
            if (token == null || token.isBlank()) return null;
            if (!configured) return null; // секрет не задан

            String[] parts = token.split("\\.");
            if (parts.length != 3) return null;

            // 1) Header: проверяем alg == HS256.
            String header = new String(base64UrlDecode(parts[0]), StandardCharsets.UTF_8);
            if (!"HS256".equals(readString(header, "alg"))) return null;

            // 2) Подпись HMAC-SHA256 (константное сравнение).
            String signingInput = parts[0] + "." + parts[1];
            byte[] expected = hmacSha256(secretKey, signingInput);
            byte[] actual = base64UrlDecode(parts[2]);
            if (!MessageDigest.isEqual(expected, actual)) return null;

            // 3) Payload: sub, email, exp, nickname.
            String payloadJson = new String(base64UrlDecode(parts[1]), StandardCharsets.UTF_8);
            return parsePayload(payloadJson);
        } catch (Exception ex) {
            return null; // не роняем сервер при мусорном токене
        }
    }

    /** Разбирает payload: sub, email, exp и nickname (user_metadata.preferred_username). */
    private JwtPayload parsePayload(String json) {
        Long exp = readLong(json, "exp");
        if (exp == null || exp <= 0) return null;

        String sub = readString(json, "sub");
        if (sub == null || sub.isEmpty()) return null;

        long now = Instant.now().getEpochSecond();
        if (exp <= now) return null; // срок действия истёк

        String email = readString(json, "email");
        String nickname = readString(json, "user_metadata.preferred_username");
        if (nickname == null) nickname = readString(json, "app_metadata.preferred_username");

        return new JwtPayload(sub, email, nickname, Instant.ofEpochSecond(exp));
    }

    // ---------------- JSON-lite (без зависимости от Jackson) ----------------

    /**
     * Ищет в JSON-строке { "key": "value" } и возвращает value без кавычек.
     * Поддерживает точечный путь (например, "user_metadata.preferred_username")
     * для одного-двух уровней вложенности.
     */
    static String readString(String json, String dottedKey) {
        if (json == null) return null;
        int keyAt = indexOfKey(json, dottedKey);
        if (keyAt < 0) return null;
        int colon = json.indexOf(':', keyAt);
        if (colon < 0) return null;
        int i = colon + 1;
        while (i < json.length() && isJsonSpace(json.charAt(i))) i++;
        if (i >= json.length() || json.charAt(i) != '"') return null; // не строка
        int start = i + 1;
        StringBuilder sb = new StringBuilder();
        for (int j = start; j < json.length(); j++) {
            char c = json.charAt(j);
            if (c == '\\') {
                int next = j + 1 < json.length() ? j + 1 : j;
                char e = json.charAt(next);
                switch (e) {
                    case 'n' -> sb.append('\n');
                    case 't' -> sb.append('\t');
                    case 'r' -> sb.append('\r');
                    case 'u' -> { // unicode-escape: 4 hex digits
                        if (j + 5 < json.length()) {
                            try {
                                sb.append((char) Integer.parseInt(json.substring(j + 2, j + 6), 16));
                                j += 4;
                            } catch (NumberFormatException ignored) {
                                sb.append('?');
                            }
                        }
                    }
                    default -> sb.append(e);
                }
                j++;
            } else if (c == '"') {
                return sb.toString();
            } else {
                sb.append(c);
            }
        }
        return null;
    }

    /** Ищет числовое значение ключа (для "exp"). */
    static Long readLong(String json, String key) {
        if (json == null) return null;
        int keyAt = indexOfKey(json, key);
        if (keyAt < 0) return null;
        int colon = json.indexOf(':', keyAt);
        if (colon < 0) return null;
        int i = colon + 1;
        while (i < json.length() && isJsonSpace(json.charAt(i))) i++;
        if (i >= json.length()) return null;
        int start = i;
        while (i < json.length() && (Character.isDigit(json.charAt(i))
                || json.charAt(i) == '-' || json.charAt(i) == '.')) i++;
        if (i == start) return null;
        try {
            double v = Double.parseDouble(json.substring(start, i).replace("\"", ""));
            return (long) v;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static int indexOfKey(String json, String dottedKey) {
        int from = 0;
        for (String segment : dottedKey.split("\\.")) {
            String needle = "\"" + segment + "\"";
            int idx = json.indexOf(needle, from);
            if (idx < 0) return -1;
            from = idx + needle.length();
        }
        return from;
    }

    private static boolean isJsonSpace(char c) {
        return c == ' ' || c == '\t' || c == '\n' || c == '\r';
    }

    // ---------------- base64url / HMAC ----------------

    private static byte[] hmacSha256(byte[] key, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] tryBase64Decode(String s) {
        try {
            return base64UrlDecode(s);
        } catch (Exception ex) {
            return new byte[0];
        }
    }

    /** Декодирует base64url без паддинга (стандартный формат JWT). */
    static byte[] base64UrlDecode(String s) {
        String p = s.replace('-', '+').replace('_', '/');
        switch (p.length() % 4) {
            case 2 -> p += "==";
            case 3 -> p += "=";
            default -> { }
        }
        return Base64.getDecoder().decode(p);
    }
}