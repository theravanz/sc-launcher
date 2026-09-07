package scctitle.client;

import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import org.lwjgl.glfw.GLFW;

public class CustomTitleScreen extends Screen {
    
    private static final ResourceLocation BACKGROUND = 
        ResourceLocation.fromNamespaceAndPath("scctitle", "textures/gui/background.png");
    private static final ResourceLocation LOGO = 
        ResourceLocation.fromNamespaceAndPath("scctitle", "textures/gui/logo.png");
    
    private CustomButton serverBtn;
    private CustomButton settingsBtn;
    private CustomButton closeBtn;
    
    public CustomTitleScreen() {
        super(Component.literal("Custom Menu"));
    }
    
    @Override
    protected void init() {
        super.init();
        
        int centerX = this.width / 2;
        int centerY = this.height / 2;
        int buttonSize = 50;
        int buttonGap = 70;
        
        serverBtn = new CustomButton(
            centerX - buttonGap, centerY - buttonSize / 2,
            buttonSize, buttonSize,
            ResourceLocation.fromNamespaceAndPath("scctitle", "textures/gui/btn_server.png"),
            btn -> Minecraft.getInstance().setScreen(new net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen(this))
        );
        
        settingsBtn = new CustomButton(
            centerX, centerY - buttonSize / 2,
            buttonSize, buttonSize,
            ResourceLocation.fromNamespaceAndPath("scctitle", "textures/gui/btn_settings.png"),
            btn -> Minecraft.getInstance().setScreen(new net.minecraft.client.gui.screens.options.OptionsScreen(this, Minecraft.getInstance().options))
        );
        
        closeBtn = new CustomButton(
            this.width - 60, 20,
            40, 40,
            ResourceLocation.fromNamespaceAndPath("scctitle", "textures/gui/btn_close.png"),
            btn -> Minecraft.getInstance().stop()
        );
        
        this.addRenderableWidget(serverBtn);
        this.addRenderableWidget(settingsBtn);
        this.addRenderableWidget(closeBtn);
    }
    
    @Override
    public void render(GuiGraphics guiGraphics, int mouseX, int mouseY, float partialTick) {
        // 1. ЖЕСТКО очищаем экран черным цветом, чтобы гарантированно перекрыть любую стандартную панораму
        guiGraphics.fill(0, 0, this.width, this.height, 0xFF000000);
        
        // 2. Рисуем наш фон
        renderBackground(guiGraphics);
        
        // 3. Рисуем логотип
        renderLogo(guiGraphics);
        
        // 4. Рисуем кнопки (вызываем super.render ТОЛЬКО для отрисовки виджетов)
        super.render(guiGraphics, mouseX, mouseY, partialTick);
    }
    
    private void renderBackground(GuiGraphics guiGraphics) {
        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
        // Рисуем текстуру на весь экран
        guiGraphics.blit(BACKGROUND, 0, 0, 0, 0.0F, 0.0F, this.width, this.height, this.width, this.height);
        RenderSystem.disableBlend();
    }

    private void renderLogo(GuiGraphics guiGraphics) {
        int logoWidth = 2172;
        int logoHeight = 724;
        
        // Адаптивный масштаб: 40% от ширины экрана (можешь поменять 0.4f на 0.3f или 0.5f)
        float scale = (this.width * 0.4f) / logoWidth;
        if (scale > 0.6f) scale = 0.6f; // Ограничитель максимального размера
        
        int scaledWidth = (int)(logoWidth * scale);
        int scaledHeight = (int)(logoHeight * scale);
        
        // Центрируем по горизонтали и поднимаем чуть выше центра по вертикали
        int x = (this.width - scaledWidth) / 2;
        int y = (this.height / 2) - scaledHeight - 60; 
        
        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
        guiGraphics.blit(LOGO, x, y, 0, 0.0F, 0.0F, scaledWidth, scaledHeight, logoWidth, logoHeight);
        RenderSystem.disableBlend();
    }
    
    @Override
    public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
        if (keyCode == GLFW.GLFW_KEY_ESCAPE) {
            Minecraft.getInstance().stop();
            return true;
        }
        return super.keyPressed(keyCode, scanCode, modifiers);
    }
}