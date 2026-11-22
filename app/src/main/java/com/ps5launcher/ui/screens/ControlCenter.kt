package com.ps5launcher.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.AirplanemodeActive
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BrightnessMedium
import androidx.compose.material.icons.filled.FlashlightOff
import androidx.compose.material.icons.filled.FlashlightOn
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ps5launcher.system.Brightness
import com.ps5launcher.system.SystemPanels
import com.ps5launcher.system.Volume
import com.ps5launcher.ui.AppEntry
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.Screen
import com.ps5launcher.ui.components.BatteryGlyph
import com.ps5launcher.ui.components.LocalBattery
import com.ps5launcher.ui.components.LocalNow
import com.ps5launcher.ui.components.PsButton
import com.ps5launcher.ui.components.focusHighlight
import com.ps5launcher.ui.components.formattedDate
import com.ps5launcher.ui.components.formattedTime
import com.ps5launcher.ui.components.launcherApp
import com.ps5launcher.ui.theme.GlassFillStrong
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary
import kotlin.math.roundToInt

private enum class CcPanel { NONE, VOLUME, BRIGHTNESS }

/**
 * Central de controle no estilo do console: uma faixa na parte de baixo da tela,
 * com cartões dos apps recentes em cima e uma fileira de botões redondos embaixo.
 * Abre pelo ícone de ajustes ou pelo botão Start / botão central do controle.
 *
 * Volume e lanterna funcionam direto. Wi-Fi, Bluetooth e modo avião abrem o painel
 * oficial do Android, porque o sistema não permite que apps comuns os liguem sozinhos.
 */
@Composable
fun ControlCenter(vm: LauncherViewModel, recent: List<AppEntry>) {
    val context = LocalContext.current
    val torch = launcherApp().torch
    val now = LocalNow.current
    val battery = LocalBattery.current

    val maxVolume = remember { Volume.max(context).coerceAtLeast(1) }
    var volume by remember { mutableIntStateOf(Volume.get(context)) }
    var canWriteBrightness by remember { mutableStateOf(Brightness.canWrite(context)) }
    var brightness by remember { mutableFloatStateOf(Brightness.get(context)) }
    var panel by remember { mutableStateOf(CcPanel.NONE) }
    val firstFocus = remember { FocusRequester() }

    // Ao voltar da tela de permissão, verifica de novo se o brilho já pode ser ajustado.
    LaunchedEffect(vm.resumeTick) {
        canWriteBrightness = Brightness.canWrite(context)
        brightness = Brightness.get(context)
        volume = Volume.get(context)
    }
    LaunchedEffect(Unit) { runCatching { firstFocus.requestFocus() } }

    Box(Modifier.fillMaxSize()) {
        // Área escurecida acima da faixa: tocar nela fecha a central.
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0f to Color.Black.copy(alpha = 0.2f),
                        1f to Color.Black.copy(alpha = 0.7f),
                    )
                )
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                    vm.closeControlCenter()
                }
        )

        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(listOf(Color(0xEB0B1633), Color(0xFA040915)))
                )
                // Impede que toques dentro da faixa a fechem.
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(horizontal = 32.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Linha 1: hora/bateria + apps recentes
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Column(
                    Modifier
                        .width(210.dp)
                        .height(100.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(GlassFillStrong.copy(alpha = 0.12f))
                        .border(1.dp, GlassStroke, RoundedCornerShape(16.dp))
                        .padding(14.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(formattedTime(now), color = TextPrimary, fontSize = 30.sp, fontWeight = FontWeight.Light)
                    Text(formattedDate(now), color = TextSecondary, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BatteryGlyph(battery)
                        Spacer(Modifier.width(8.dp))
                        val batteryText = when {
                            battery.percent < 0 -> "--"
                            battery.charging -> "${battery.percent}% · carregando"
                            else -> "${battery.percent}%"
                        }
                        Text(batteryText, color = TextPrimary, fontSize = 12.sp)
                    }
                }
                recent.forEach { entry ->
                    RecentCard(entry) { vm.launch(entry) }
                }
            }

            // Controle deslizante de volume ou brilho (aparece ao tocar em Som/Brilho)
            AnimatedVisibility(visible = panel != CcPanel.NONE) {
                Row(
                    Modifier
                        .widthIn(max = 620.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White.copy(alpha = 0.06f))
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    val isVolume = panel == CcPanel.VOLUME
                    Icon(
                        if (isVolume) Icons.AutoMirrored.Filled.VolumeUp else Icons.Filled.BrightnessMedium,
                        contentDescription = null, tint = TextPrimary, modifier = Modifier.size(22.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    Box(Modifier.weight(1f)) {
                        if (isVolume) {
                            Slider(
                                value = volume.toFloat(),
                                onValueChange = {
                                    volume = it.roundToInt()
                                    Volume.set(context, volume)
                                },
                                valueRange = 0f..maxVolume.toFloat(),
                                colors = sliderColors(),
                            )
                        } else if (canWriteBrightness) {
                            Slider(
                                value = brightness,
                                onValueChange = {
                                    brightness = it
                                    Brightness.set(context, it)
                                },
                                valueRange = 0.02f..1f,
                                colors = sliderColors(),
                            )
                        } else {
                            PsButton(
                                "Permitir ajuste de brilho",
                                { SystemPanels.writeSettingsPermission(context) },
                                primary = false,
                            )
                        }
                    }
                }
            }

            // Linha 2: botões redondos
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                CcButton(Icons.Filled.Home, "Início", focusModifier = Modifier.focusRequester(firstFocus)) { vm.goHome() }
                CcButton(Icons.Filled.Apps, "Biblioteca") { vm.navigate(Screen.LIBRARY) }
                CcButton(Icons.AutoMirrored.Filled.VolumeUp, "Som", active = panel == CcPanel.VOLUME) {
                    panel = if (panel == CcPanel.VOLUME) CcPanel.NONE else CcPanel.VOLUME
                }
                CcButton(Icons.Filled.BrightnessMedium, "Brilho", active = panel == CcPanel.BRIGHTNESS) {
                    panel = if (panel == CcPanel.BRIGHTNESS) CcPanel.NONE else CcPanel.BRIGHTNESS
                }
                if (torch.available) {
                    CcButton(
                        if (torch.isOn.value) Icons.Filled.FlashlightOn else Icons.Filled.FlashlightOff,
                        "Lanterna",
                        active = torch.isOn.value,
                    ) { torch.toggle() }
                }
                CcButton(Icons.Filled.Wifi, "Wi-Fi") { SystemPanels.wifi(context) }
                CcButton(Icons.Filled.Bluetooth, "Bluetooth") { SystemPanels.bluetooth(context) }
                CcButton(Icons.Filled.AirplanemodeActive, "Avião") { SystemPanels.airplane(context) }
                CcButton(Icons.Filled.BatteryFull, "Bateria") { SystemPanels.battery(context) }
                CcButton(Icons.Filled.Person, "Perfil") { vm.navigate(Screen.PROFILE) }
                CcButton(Icons.Filled.Settings, "Ajustes") { vm.navigate(Screen.SETTINGS) }
                CcButton(Icons.Filled.PhoneAndroid, "Android") { SystemPanels.androidSettings(context) }
            }
        }
    }
}

@Composable
private fun sliderColors() = SliderDefaults.colors(
    thumbColor = Color.White,
    activeTrackColor = LocalAccent.current,
    inactiveTrackColor = GlassStroke,
)

/** Botão redondo com o nome embaixo, como os da central do console. */
@Composable
private fun CcButton(
    icon: ImageVector,
    label: String,
    active: Boolean = false,
    focusModifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val accent = LocalAccent.current
    Column(Modifier.width(68.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            focusModifier
                .focusHighlight(interaction, CircleShape, 1.12f)
                .size(52.dp)
                .clip(CircleShape)
                .background(if (active) accent else Color.White.copy(alpha = 0.10f))
                .clickable(interactionSource = interaction, indication = LocalIndication.current, onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = label, tint = TextPrimary, modifier = Modifier.size(24.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(label, color = TextSecondary, fontSize = 11.sp, maxLines = 1, textAlign = TextAlign.Center)
    }
}

/** Cartão de um app aberto recentemente (como o "alternador" do console). */
@Composable
private fun RecentCard(entry: AppEntry, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(16.dp)
    Box(
        Modifier
            .focusHighlight(interaction, shape, 1.05f)
            .size(100.dp)
            .clip(shape)
            .clickable(interactionSource = interaction, indication = LocalIndication.current, onClick = onClick)
    ) {
        TileArt(entry, Modifier.fillMaxSize())
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f))))
                .padding(horizontal = 8.dp, vertical = 6.dp)
        ) {
            Text(entry.label, color = Color.White, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}
