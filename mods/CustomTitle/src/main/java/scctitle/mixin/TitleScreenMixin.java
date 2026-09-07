package scctitle.mixin;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import scctitle.client.CustomTitleScreen;

@Mixin(TitleScreen.class)
public class TitleScreenMixin {
    
    @Inject(method = "init()V", at = @At("HEAD"))
    private void onInit(CallbackInfo ci) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.screen instanceof TitleScreen) {
            mc.setScreen(new CustomTitleScreen());
        }
    }
}