package com.sccauth.launcherauth;

import com.mojang.logging.LogUtils;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.loading.FMLEnvironment;
import org.slf4j.Logger;

/**
 * Точка входа мода (mod id: {@code sccauth}, согласован с neoforge.mods.toml).
 *
 * В конструкторе (первый код мода) регистрируем на шине событий FML сетевой
 * тип {@code sccauth:auth} — на обеих сторонах ({@link AuthNetwork}).
 *
 * Клиентская отправка JWT регистрируется сама: класс
 * {@link com.sccauth.launcherauth.client.ClientLoginHandler} помечен
 * {@code @EventBusSubscriber(modid="sccauth", value=Dist.CLIENT)}, поэтому
 * загружается только в клиенте без ручной регистрации.
 *
 * Сигнатура с {@link IEventBus} / {@link ModContainer} — документированный
 * способ FML: эти параметры инжектятся автоматически.
 */
@Mod("sccauth")
public final class SCCAuth {

    /** Идентификатор мода — читается в {@code neoforge.mods.toml}. */
    public static final String MODID = "sccauth";

    private static final Logger LOGGER = LogUtils.getLogger();

    public SCCAuth(IEventBus modEventBus, ModContainer modContainer) {
        LOGGER.info("[sccauth:auth] StructureCraftAuth мод загружается, dist={}",
                FMLEnvironment.dist);

        // Регистрация канала sccauth:auth (клиент + сервер) и серверного обработчика.
        modEventBus.addListener(AuthNetwork::onRegisterPayloads);

        LOGGER.info("[sccauth:auth] канал sccauth:auth зарегистрирован ({})",
                AuthNetwork.NETWORK_VERSION);
    }
}