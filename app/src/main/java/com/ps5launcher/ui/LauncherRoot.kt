package com.ps5launcher.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ps5launcher.ui.components.AnimatedBackground
import com.ps5launcher.ui.components.LocalBattery
import com.ps5launcher.ui.components.LocalNow
import com.ps5launcher.ui.components.rememberBattery
import com.ps5launcher.ui.components.rememberNow
import com.ps5launcher.ui.screens.AppOptionsDialog
import com.ps5launcher.ui.screens.BootScreen
import com.ps5launcher.ui.screens.ControlCenter
import com.ps5launcher.ui.screens.HomeScreen
import com.ps5launcher.ui.screens.LibraryScreen
import com.ps5launcher.ui.screens.ProfileScreen
import com.ps5launcher.ui.screens.SettingsScreen
import com.ps5launcher.ui.screens.WelcomeScreen
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.PsNavy

/** Monta o launcher: fundo animado + tela atual + central de controle + menus. */
@Composable
fun LauncherRoot(vm: LauncherViewModel, onRequestDefault: () -> Unit) {
    val settings by vm.settings.collectAsStateWithLifecycle()
    val entries by vm.entries.collectAsStateWithLifecycle()
    val games by vm.games.collectAsStateWithLifecycle()
    val media by vm.media.collectAsStateWithLifecycle()
    val appsLoaded by vm.appsLoaded.collectAsStateWithLifecycle()
    val recent = remember(entries) {
        entries.filter { it.usage != null && !it.isHidden }
            .sortedByDescending { it.usage?.lastLaunched ?: 0L }
            .take(6)
    }

    val now = rememberNow(vm.resumeTick)
    val battery = rememberBattery()
    val accent = LocalAccent.current
    val tint by animateColorAsState(vm.backgroundTint ?: accent, tween(600), label = "tint")

    LaunchedEffect(Unit) { vm.playStartupSoundOnce() }

    // O botão voltar nunca fecha o launcher; só volta para a tela anterior.
    BackHandler(enabled = true) { vm.back() }

    CompositionLocalProvider(LocalNow provides now, LocalBattery provides battery) {
        Box(Modifier.fillMaxSize().background(PsNavy)) {
            AnimatedBackground(tint = tint, animated = settings.animatedBackground)

            if (!settings.firstRunDone) {
                WelcomeScreen(vm, onRequestDefault)
            } else if (vm.bootStage < LauncherViewModel.BOOT_DONE) {
                BootScreen(vm, settings)
            } else {

                AnimatedContent(
                    targetState = vm.screen,
                    transitionSpec = {
                        (fadeIn(tween(260)) + scaleIn(tween(260), initialScale = 0.96f)) togetherWith
                            (fadeOut(tween(160)) + scaleOut(tween(160), targetScale = 1.02f))
                    },
                    label = "screen",
                ) { screen ->
                    when (screen) {
                        Screen.HOME -> HomeScreen(
                            vm = vm,
                            settings = settings,
                            games = games,
                            media = media,
                            totalApps = entries.size,
                            appsLoaded = appsLoaded,
                            onRequestDefault = onRequestDefault,
                        )
                        Screen.LIBRARY -> LibraryScreen(vm, entries)
                        Screen.PROFILE -> ProfileScreen(vm, settings, entries)
                        Screen.SETTINGS -> SettingsScreen(vm, settings, onRequestDefault)
                    }
                }

                AnimatedVisibility(
                    visible = vm.controlCenterOpen,
                    enter = fadeIn(tween(200)) + slideInVertically(tween(280)) { it / 3 },
                    exit = fadeOut(tween(160)) + slideOutVertically(tween(200)) { it / 3 },
                ) {
                    ControlCenter(vm, recent)
                }

                vm.optionsFor?.let { entry -> AppOptionsDialog(vm, entry) }
            }
        }
    }
}
