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
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Gamepad
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.ScreenRotation
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ps5launcher.data.LauncherSettings
import com.ps5launcher.data.SettingsRepository
import com.ps5launcher.system.SystemPanels
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.Screen
import com.ps5launcher.ui.components.ChoiceChip
import com.ps5launcher.ui.components.ScreenHeader
import com.ps5launcher.ui.components.SectionTitle
import com.ps5launcher.ui.components.focusHighlight
import com.ps5launcher.ui.theme.AccentOptions
import com.ps5launcher.ui.theme.GlassFill
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary

/** Configurações próprias do launcher. */
@Composable
fun SettingsScreen(vm: LauncherViewModel, settings: LauncherSettings, onRequestDefault: () -> Unit) {
    val context = LocalContext.current
    LazyColumn(
        Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item { ScreenHeader("Configurações", onBack = { vm.back() }) }

        item { SectionTitle("Tela inicial") }
        item {
            SettingRow(
                icon = if (vm.isDefaultLauncher) Icons.Filled.CheckCircle else Icons.Filled.Home,
                title = "Tela inicial padrão",
                subtitle = if (vm.isDefaultLauncher) "O PS5 Launcher já é a sua tela inicial. Toque para trocar."
                else "Toque para definir o PS5 Launcher como tela inicial do Android.",
                onClick = onRequestDefault,
            )
        }
        item {
            SettingRow(Icons.Filled.Person, "Perfil", "Nome do jogador e avatar", onClick = { vm.navigate(Screen.PROFILE) })
        }

        item { SectionTitle("Aparência") }
        item {
            SettingChoices(
                Icons.Filled.Palette, "Cor de destaque",
                AccentOptions.map { it.name }, settings.accentIndex,
            ) { vm.setAccent(it) }
        }
        item {
            SettingSwitch(
                Icons.Filled.AutoAwesome, "Fundo animado",
                "Desligue para economizar bateria em celulares mais simples.",
                settings.animatedBackground,
            ) { vm.setBoolean(SettingsRepository.K_ANIMATED_BG, it) }
        }
        item {
            SettingSwitch(
                Icons.Filled.Fullscreen, "Tela cheia",
                "Esconde a barra de status. Deslize do topo para ver as notificações.",
                settings.fullscreen,
            ) { vm.setBoolean(SettingsRepository.K_FULLSCREEN, it) }
        }
        item {
            val portrait = settings.orientation == SettingsRepository.ORIENTATION_PORTRAIT
            SettingChoices(
                Icons.Filled.ScreenRotation, "Orientação",
                listOf("Horizontal", "Vertical"), if (portrait) 1 else 0,
            ) {
                vm.setOrientation(
                    if (it == 1) SettingsRepository.ORIENTATION_PORTRAIT else SettingsRepository.ORIENTATION_LANDSCAPE
                )
            }
        }

        item {
            SettingSwitch(
                Icons.Filled.PlayCircle, "Tela de abertura",
                "Logo e \"Quem está jogando?\" quando o launcher liga (ex.: ao reiniciar o celular).",
                settings.bootScreen,
            ) { vm.setBoolean(SettingsRepository.K_BOOT_SCREEN, it) }
        }

        item { SectionTitle("Som") }
        item {
            SettingSwitch(
                Icons.Filled.MusicNote, "Efeitos sonoros",
                "Sons ao navegar, abrir jogos e voltar.",
                settings.soundsEnabled,
            ) { vm.setBoolean(SettingsRepository.K_SOUNDS, it) }
        }
        item {
            SettingSwitch(
                Icons.Filled.PowerSettingsNew, "Som de abertura",
                "Toca quando o launcher inicia.",
                settings.startupSound,
            ) { vm.setBoolean(SettingsRepository.K_STARTUP_SOUND, it) }
        }

        item { SectionTitle("Controle Bluetooth") }
        item {
            SettingRow(
                Icons.Filled.Gamepad, "Como usar o controle",
                "A = confirmar · B = voltar · X = opções do app · Y = biblioteca · " +
                    "L1/R1 = trocar aba · Start ou botão central = central de controle · Select = configurações",
                onClick = null,
            )
        }
        item {
            SettingRow(Icons.Filled.Bluetooth, "Parear um controle", "Abre o Bluetooth do Android", onClick = {
                SystemPanels.bluetooth(context)
            })
        }

        item { SectionTitle("Sistema") }
        item {
            SettingRow(Icons.Filled.PhoneAndroid, "Configurações do Android", "Abre as configurações do celular", onClick = {
                SystemPanels.androidSettings(context)
            })
        }
        item {
            SettingRow(
                Icons.Filled.Info, "PS5 Launcher 1.2",
                "Projeto pessoal inspirado no visual de consoles. Não é afiliado à Sony. " +
                    "O launcher nunca apaga nem modifica seus apps.",
                onClick = null,
            )
        }
    }
}

@Composable
private fun SettingContainer(onClick: (() -> Unit)?, content: @Composable () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(18.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .focusHighlight(interaction, shape, 1.015f)
            .clip(shape)
            .background(GlassFill)
            .border(1.dp, GlassStroke, shape)
            .then(
                if (onClick != null) Modifier.clickable(
                    interactionSource = interaction,
                    indication = LocalIndication.current,
                    onClick = onClick,
                ) else Modifier
            )
            .padding(horizontal = 16.dp, vertical = 14.dp)
    ) { content() }
}

@Composable
private fun SettingIcon(icon: ImageVector) {
    val accent = LocalAccent.current
    Box(
        Modifier.size(38.dp).clip(CircleShape).background(accent.copy(alpha = 0.25f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun SettingRow(icon: ImageVector, title: String, subtitle: String, onClick: (() -> Unit)?) {
    SettingContainer(onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SettingIcon(icon)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Text(subtitle, color = TextSecondary, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun SettingSwitch(icon: ImageVector, title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val accent = LocalAccent.current
    SettingContainer(onClick = { onChange(!checked) }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SettingIcon(icon)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Text(subtitle, color = TextSecondary, fontSize = 13.sp)
            }
            Spacer(Modifier.width(12.dp))
            // onCheckedChange = null: quem responde ao toque é a linha inteira.
            Switch(
                checked = checked,
                onCheckedChange = null,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = accent,
                    uncheckedThumbColor = TextSecondary,
                    uncheckedTrackColor = GlassFill,
                    uncheckedBorderColor = GlassStroke,
                ),
            )
        }
    }
}

@Composable
private fun SettingChoices(
    icon: ImageVector,
    title: String,
    options: List<String>,
    selected: Int,
    onSelect: (Int) -> Unit,
) {
    SettingContainer(onClick = null) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SettingIcon(icon)
                Spacer(Modifier.width(14.dp))
                Text(title, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                options.forEachIndexed { index, label ->
                    ChoiceChip(label, selected = index == selected, onClick = { onSelect(index) })
                }
            }
        }
    }
}
