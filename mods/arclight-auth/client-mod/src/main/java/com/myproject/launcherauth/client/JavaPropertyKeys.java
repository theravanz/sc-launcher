package com.myproject.launcherauth.client;

/**
 * Ключи системных свойств JVM, которые задаёт лаунчер при запуске игры.
 */
public final class JavaPropertyKeys {

    /** Supabase Access Token (JWT). Пробрасывается в JVM: -Dmyproject.supabase.jwt="..." */
    public static final String SUPABASE_JWT = "myproject.supabase.jwt";

    private JavaPropertyKeys() {
    }
}