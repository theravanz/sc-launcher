package com.myproject.launcherauth;

import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

/**
 * Серверный (serverbound) payload кастомного сетевого канала {@code myproject:auth}.
 * Переносит JWT-токен Supabase от клиента (лаунчера) к серверу.
 *
 * Определяется как record с единственным строковым полем {@code jwt}.
 * Codec строится через {@link StreamCodec#composite} (поле String -> конструктор record).
 */
public record AuthPayload(String jwt) implements CustomPacketPayload {

    /** Канал: {@code myproject:auth}. */
    public static final ResourceLocation ID = ResourceLocation.fromNamespaceAndPath("myproject", "auth");

    /** Тип payload, привязанный к каналу. Регистрируется на клиенте и сервере. */
    public static final Type<AuthPayload> TYPE = new Type<>(ID);

    /** Сериализация: одно поле {@code String} (UTF-8). */
    public static final StreamCodec<FriendlyByteBuf, AuthPayload> STREAM_CODEC = StreamCodec.composite(
            ByteBufCodecs.STRING_UTF8,
            AuthPayload::jwt,
            AuthPayload::new);

    @Override
    public Type<AuthPayload> type() {
        return TYPE;
    }
}