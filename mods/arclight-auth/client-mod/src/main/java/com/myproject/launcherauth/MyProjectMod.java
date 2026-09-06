package com.myproject.launcherauth;

import com.mojang.logging.LogUtils;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.loading.FMLEnvironment;
import org.slf4j.Logger;

/**
 * Точка входа мода (mod id: {@code myproject}, согласован с neoforge.mods.toml).
 *
 * В конструкторе (первый код мода) регистрируем на шине событий FML сетевой
 * тип {@code myproject:auth} — на обеих сторонах ({@link AuthNetwork}).
 *
 * Клиентская отправка JWT регистрируется сама: класс
 * {@link com.myproject.launcherauth.client.ClientLoginHandler} помечен
 * {@code @EventBusSubscriber(modid="myproject", value=Dist.CLIENT)}, поэтому
 * загружается только в клиенте без ручной регистрации.
 *
 * Сигнатура с {@link IEventBus} / {@link ModContainer} — документированный
 * способ FML: эти параметры инжектятся автоматически.
 */
@Mod("myproject")
public final class MyProjectMod {

    /** Идентификатор мода — читается в {@code neoforge.mods.toml}. */
    public static final String MODID = "myproject";

    private static final Logger LOGGER = LogUtils.getLogger();

    public MyProjectMod(IEventBus modEventBus, ModContainer modContainer) {
        LOGGER.info("[myproject:auth] StructureCraftAuth мод загружается, dist={}",
                FMLEnvironment.dist);

        // Регистрация канала myproject:auth (клиент + сервер) и серверного обработчика.
        modEventBus.addListener(AuthNetwork::onRegisterPayloads);

        LOGGER.info("[myproject:auth] канал myproject:auth зарегистрирован ({})",
                AuthNetwork.NETWORK_VERSION);
    }
}