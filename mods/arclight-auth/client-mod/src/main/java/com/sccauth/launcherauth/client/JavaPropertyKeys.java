package com.sccauth.launcherauth.client;

/**
 * Ключи системных свойств JVM, которые задаёт лаунчер при запуске игры.
 */
public final class JavaPropertyKeys {

    /** Supabase Access Token (JWT). Пробрасывается в JVM: -Dsccauth.supabase.jwt="..." */
    public static final String SUPABASE_JWT = "sccauth.supabase.jwt";

    private JavaPropertyKeys() {
    }
}