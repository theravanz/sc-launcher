package scctitle.client;

import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractButton;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.Mth;
import java.util.function.Consumer;

public class CustomButton extends AbstractButton {
    
    private final ResourceLocation iconTexture;
    private float hoverProgress = 0.0f;
    
    // Используем стандартный Java Consumer, чтобы избежать проблем с маппингами Minecraft
    private final Consumer<CustomButton> onPress;

    public CustomButton(int x, int y, int width, int height, ResourceLocation icon, Consumer<CustomButton> onPress) {
        super(x, y, width, height, Component.empty());
        this.iconTexture = icon;
        this.onPress = onPress;
    }
    
    @Override
    public void onPress() {
        this.onPress.accept(this);
    }
    
    @Override
    protected void renderWidget(GuiGraphics guiGraphics, int mouseX, int mouseY, float partialTick) {
        boolean isHovered = mouseX >= this.getX() && mouseX < this.getX() + this.width &&
                           mouseY >= this.getY() && mouseY < this.getY() + this.height;
        
        if (isHovered && hoverProgress < 1.0f) {
            hoverProgress += partialTick * 0.15f;
        } else if (!isHovered && hoverProgress > 0.0f) {
            hoverProgress -= partialTick * 0.15f;
        }
        hoverProgress = Mth.clamp(hoverProgress, 0.0f, 1.0f);
        
        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
        
        // Полупрозрачный фон кнопки
        int bgColor = (int)(0x60 + hoverProgress * 0x40) << 24; 
        guiGraphics.fill(this.getX(), this.getY(), this.getX() + this.width, this.getY() + this.height, bgColor);
        
        // Обводка
        int borderColor = isHovered ? 0xFFFFFFFF : 0x60FFFFFF;
        guiGraphics.hLine(this.getX(), this.getX() + this.width, this.getY(), borderColor);
        guiGraphics.hLine(this.getX(), this.getX() + this.width, this.getY() + this.height - 1, borderColor);
        guiGraphics.vLine(this.getX(), this.getY(), this.getY() + this.height, borderColor);
        guiGraphics.vLine(this.getX() + this.width - 1, this.getY(), this.getY() + this.height, borderColor);
        
        // Иконка
        if (iconTexture != null) {
            int iconSize = (int)(this.width * 0.6f);
            int iconX = this.getX() + (this.width - iconSize) / 2;
            int iconY = this.getY() + (this.height - iconSize) / 2;
            
            guiGraphics.blit(iconTexture, iconX, iconY, 0, 0.0F, 0.0F, iconSize, iconSize, iconSize, iconSize);
        }
        
        RenderSystem.disableBlend();
    }
    
    @Override
    protected void updateWidgetNarration(NarrationElementOutput narrationElementOutput) {
        // Отключаем озвучку
    }
}