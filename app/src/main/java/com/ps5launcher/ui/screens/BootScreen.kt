package com.ps5launcher.ui.screens

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ps5launcher.data.LauncherSettings
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.components.Avatar
import com.ps5launcher.ui.components.StatusCluster
import com.ps5launcher.ui.components.focusHighlight
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Abertura de console: logo com som e, em seguida, a tela "Quem está jogando?".
 * Aparece só quando o launcher "liga" (por exemplo, depois de reiniciar o celular).
 * Pode ser desligada em Configurações > Tela de abertura.
 */
@Composable
fun BootScreen(vm: LauncherViewModel, settings: LauncherSettings) {
    Crossfade(targetState = vm.bootStage, animationSpec = tween(500), label = "boot") { stage ->
        if (stage == LauncherViewModel.BOOT_LOGO) {
            BootLogo(onDone = { vm.bootToProfile() })
        } else {
            ProfileSelect(settings, onEnter = { vm.finishBoot() })
        }
    }
}

@Composable
private fun BootLogo(onDone: () -> Unit) {
    val alpha = remember { Animatable(0f) }
    val scale = remember { Animatable(0.85f) }
    LaunchedEffect(Unit) {
        launch { scale.animateTo(1f, tween(1500, easing = FastOutSlowInEasing)) }
        alpha.animateTo(1f, tween(700))
        delay(900)
        alpha.animateTo(0f, tween(400))
        onDone()
    }
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onDone() },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.graphicsLayer {
                this.alpha = alpha.value
                scaleX = scale.value
                scaleY = scale.value
            },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            LogoMark(Modifier.size(110.dp))
            Spacer(Modifier.height(18.dp))
            Text(
                "PS5 LAUNCHER",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 14.sp,
                fontWeight = FontWeight.Light,
                letterSpacing = 6.sp,
            )
        }
    }
}

@Composable
private fun ProfileSelect(settings: LauncherSettings, onEnter: () -> Unit) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Box(
        Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(24.dp)
    ) {
        StatusCluster(Modifier.align(Alignment.TopEnd))
        Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Bem-vindo de volta", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Light)
            Spacer(Modifier.height(4.dp))
            Text("Quem está jogando?", color = TextSecondary, fontSize = 15.sp)
            Spacer(Modifier.height(26.dp))
            val interaction = remember { MutableInteractionSource() }
            Box(
                Modifier
                    .focusRequester(focus)
                    .focusHighlight(interaction, CircleShape, 1.08f)
                    .clip(CircleShape)
                    .clickable(interactionSource = interaction, indication = LocalIndication.current, onClick = onEnter)
            ) {
                Avatar(settings.avatarPath, settings.userName, 116.dp)
            }
            Spacer(Modifier.height(12.dp))
            Text(settings.userName, color = TextPrimary, fontSize = 20.sp)
            Spacer(Modifier.height(22.dp))
            Text("Toque no perfil ou pressione A para continuar", color = TextSecondary, fontSize = 13.sp)
        }
    }
}
