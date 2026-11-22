package com.ps5launcher.ui.screens

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.AirplanemodeActive
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BrightnessMedium
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashlightOff
import androidx.compose.material.icons.filled.FlashlightOn
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.LightMode
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ps5launcher.system.Brightness
import com.ps5launcher.system.SystemPanels
import com.ps5launcher.system.Volume
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.Screen
import com.ps5launcher.ui.components.BatteryGlyph
import com.ps5launcher.ui.components.LocalBattery
import com.ps5launcher.ui.components.LocalNow
import com.ps5launcher.ui.components.PsButton
import com.ps5launcher.ui.components.PsIconButton
import com.ps5launcher.ui.components.focusHighlight
import com.ps5launcher.ui.components.formattedDate
import com.ps5launcher.ui.components.formattedTime
import com.ps5launcher.ui.components.launcherApp
import com.ps5launcher.ui.theme.GlassFill
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.PsSurfaceStrong
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary
import kotlin.math.roundToInt

/**
 * Central de controle (abre pelo ícone de ajustes, ou pelo botão Start/central do controle).
 * Volume e lanterna funcionam direto. Wi-Fi, Bluetooth e modo avião abrem o painel oficial
 * do Android, porque o sistema não permite que apps comuns os liguem sozinhos.
 */
@Composable
fun ControlCenter(vm: LauncherViewModel) {
    val context = LocalContext.current
    val torch = launcherApp().torch
    val now = LocalNow.current
    val battery = LocalBattery.current
    val accent = LocalAccent.current

    val maxVolume = remember { Volume.max(context).coerceAtLeast(1) }
    var volume by remember { mutableIntStateOf(Volume.get(context)) }
    var canWriteBrightness by remember { mutableStateOf(Brightness.canWrite(context)) }
    var brightness by remember { mutableFloatStateOf(Brightness.get(context)) }
    val firstFocus = remember { FocusRequester() }

    // Ao voltar da tela de permissão, verifica de novo se o brilho já pode ser ajustado.
    LaunchedEffect(vm.resumeTick) {
        canWriteBrightness = Brightness.canWrite(context)
        brightness = Brightness.get(context)
        volume = Volume.get(context)
    }
    LaunchedEffect(Unit) { runCatching { firstFocus.requestFocus() } }

    Box(Modifier.fillMaxSize()) {
        // Área escura atrás do painel: tocar nela fecha a central.
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.55f))
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                    vm.closeControlCenter()
                }
        )

        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(12.dp)
                .widthIn(max = 760.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(28.dp))
                .background(PsSurfaceStrong)
                .border(1.dp, GlassStroke, RoundedCornerShape(28.dp))
                // Impede que toques dentro do painel o fechem.
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Cabeçalho: hora, data e bateria
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(formattedTime(now), color = TextPrimary, fontSize = 34.sp, fontWeight = FontWeight.Bold)
                    Text(formattedDate(now), color = TextSecondary, fontSize = 14.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BatteryGlyph(battery)
                    Spacer(Modifier.width(8.dp))
                    val batteryText = when {
                        battery.percent < 0 -> "--"
                        battery.charging -> "${battery.percent}% · carregando"
                        else -> "${battery.percent}%"
                    }
                    Text(batteryText, color = TextPrimary, fontSize = 15.sp)
                }
                Spacer(Modifier.width(14.dp))
                PsIconButton(Icons.Filled.Close, "Fechar", { vm.closeControlCenter() }, size = 40.dp)
            }

            // Atalhos rápidos
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (torch.available) {
                    QuickTile(
                        if (torch.isOn.value) Icons.Filled.FlashlightOn else Icons.Filled.FlashlightOff,
                        "Lanterna",
                        active = torch.isOn.value,
                        modifier = Modifier.focusRequester(firstFocus),
                    ) { torch.toggle() }
                }
                QuickTile(
                    Icons.Filled.Wifi, "Wi-Fi",
                    modifier = if (torch.available) Modifier else Modifier.focusRequester(firstFocus),
                ) { SystemPanels.wifi(context) }
                QuickTile(Icons.Filled.Language, "Internet") { SystemPanels.internet(context) }
                QuickTile(Icons.Filled.Bluetooth, "Bluetooth") { SystemPanels.bluetooth(context) }
                QuickTile(Icons.Filled.AirplanemodeActive, "Modo avião") { SystemPanels.airplane(context) }
                QuickTile(Icons.Filled.LightMode, "Tela") { SystemPanels.display(context) }
                QuickTile(Icons.Filled.BatteryFull, "Bateria") { SystemPanels.battery(context) }
                QuickTile(Icons.Filled.PhoneAndroid, "Android") { SystemPanels.androidSettings(context) }
            }

            // Volume
            SliderRow(Icons.AutoMirrored.Filled.VolumeUp, "Volume") {
                Slider(
                    value = volume.toFloat(),
                    onValueChange = {
                        volume = it.roundToInt()
                        Volume.set(context, volume)
                    },
                    valueRange = 0f..maxVolume.toFloat(),
                    colors = sliderColors(accent),
                )
            }

            // Brilho
            SliderRow(Icons.Filled.BrightnessMedium, "Brilho") {
                if (canWriteBrightness) {
                    Slider(
                        value = brightness,
                        onValueChange = {
                            brightness = it
                            Brightness.set(context, it)
                        },
                        valueRange = 0.02f..1f,
                        colors = sliderColors(accent),
                    )
                } else {
                    PsButton(
                        "Permitir ajuste de brilho",
                        { SystemPanels.writeSettingsPermission(context) },
                        primary = false,
                    )
                }
            }

            // Navegação rápida dentro do launcher
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PsButton("Biblioteca", { vm.navigate(Screen.LIBRARY) }, icon = Icons.Filled.Apps, primary = false)
                PsButton("Perfil", { vm.navigate(Screen.PROFILE) }, icon = Icons.Filled.Person, primary = false)
                PsButton("Configurações", { vm.navigate(Screen.SETTINGS) }, icon = Icons.Filled.Settings, primary = false)
            }
        }
    }
}

@Composable
private fun sliderColors(accent: Color) = SliderDefaults.colors(
    thumbColor = Color.White,
    activeTrackColor = accent,
    inactiveTrackColor = GlassStroke,
)

@Composable
private fun SliderRow(icon: ImageVector, label: String, content: @Composable () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = label, tint = TextPrimary, modifier = Modifier.size(24.dp))
        Spacer(Modifier.width(10.dp))
        Text(label, color = TextSecondary, fontSize = 14.sp, modifier = Modifier.width(64.dp))
        Box(Modifier.weight(1f)) { content() }
    }
}

@Composable
private fun QuickTile(
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier,
    active: Boolean = false,
    onClick: () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val accent = LocalAccent.current
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier
            .focusHighlight(interaction, shape, 1.06f)
            .width(88.dp)
            .height(88.dp)
            .clip(shape)
            .background(if (active) accent else GlassFill)
            .border(1.dp, if (active) accent else GlassStroke, shape)
            .clickable(interactionSource = interaction, indication = LocalIndication.current, onClick = onClick)
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(28.dp))
        Spacer(Modifier.height(6.dp))
        Text(label, color = TextPrimary, fontSize = 12.sp, textAlign = TextAlign.Center, maxLines = 1)
    }
}
