package com.ps5launcher.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ps5launcher.data.LauncherSettings
import com.ps5launcher.ui.AppEntry
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.components.Avatar
import com.ps5launcher.ui.components.GlassPanel
import com.ps5launcher.ui.components.PsButton
import com.ps5launcher.ui.components.ScreenHeader
import com.ps5launcher.ui.components.SectionTitle
import com.ps5launcher.ui.components.StatCard
import com.ps5launcher.ui.components.focusHighlight
import com.ps5launcher.ui.theme.GlassFill
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary
import kotlinx.coroutines.delay

/** Perfil do jogador: avatar, nome e estatísticas de uso. */
@Composable
fun ProfileScreen(vm: LauncherViewModel, settings: LauncherSettings, entries: List<AppEntry>) {
    // O seletor de fotos oficial do Android: não precisa de permissão de armazenamento.
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) vm.setAvatar(uri)
    }
    var name by remember { mutableStateOf(settings.userName) }
    val keyboard = LocalSoftwareKeyboardController.current
    val accent = LocalAccent.current

    // Salva o nome automaticamente meio segundo depois que você para de digitar.
    LaunchedEffect(name) {
        delay(500)
        if (name.isNotBlank() && name.trim() != settings.userName) vm.setUserName(name)
    }

    val games = entries.count { it.isGame }
    val totalLaunches = entries.sumOf { it.usage?.count ?: 0 }
    val mostPlayed = entries.filter { it.isGame && it.usage != null }.maxByOrNull { it.usage?.count ?: 0 }
    val recent = entries.filter { it.usage != null }.sortedByDescending { it.usage?.lastLaunched ?: 0L }.take(12)

    Column(
        Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(horizontal = 20.dp, vertical = 8.dp)
            .verticalScroll(rememberScrollState())
    ) {
        ScreenHeader("Perfil", onBack = { vm.back() })
        Spacer(Modifier.height(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            val interaction = remember { MutableInteractionSource() }
            Box(
                Modifier
                    .focusHighlight(interaction, CircleShape, 1.05f)
                    .clip(CircleShape)
                    .clickable(interactionSource = interaction, indication = LocalIndication.current) {
                        picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    }
            ) {
                Avatar(settings.avatarPath, settings.userName, 112.dp)
            }
            Spacer(Modifier.width(20.dp))
            Column(Modifier.weight(1f)) {
                Text(settings.userName, color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Toque na foto para trocar o avatar", color = TextSecondary, fontSize = 13.sp)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PsButton(
                        "Escolher foto",
                        { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                        icon = Icons.Filled.PhotoCamera,
                        primary = false,
                    )
                    if (settings.avatarPath != null) {
                        PsButton("Remover", { vm.removeAvatar() }, icon = Icons.Filled.Delete, primary = false)
                    }
                }
            }
        }

        SectionTitle("Nome do jogador")
        OutlinedTextField(
            value = name,
            onValueChange = { name = it.take(24) },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = {
                vm.setUserName(name)
                keyboard?.hide()
            }),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = accent,
                unfocusedBorderColor = GlassStroke,
                focusedContainerColor = GlassFill,
                unfocusedContainerColor = GlassFill,
                cursorColor = accent,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
            ),
            modifier = Modifier.fillMaxWidth().widthIn(max = 520.dp),
        )

        SectionTitle("Estatísticas")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard("$games", "Jogos", Modifier.weight(1f))
            StatCard("${entries.size}", "Apps", Modifier.weight(1f))
            StatCard("$totalLaunches", "Aberturas", Modifier.weight(1f))
        }

        if (mostPlayed != null) {
            SectionTitle("Mais jogado")
            GlassPanel(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(64.dp).clip(RoundedCornerShape(14.dp))) {
                        TileArt(mostPlayed, Modifier.fillMaxSize())
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(mostPlayed.label, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("Aberto ${mostPlayed.usage?.count ?: 0} vezes", color = TextSecondary, fontSize = 13.sp)
                    }
                    PsButton("Jogar", { vm.launch(mostPlayed) })
                }
            }
        }

        if (recent.isNotEmpty()) {
            SectionTitle("Abertos recentemente")
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(end = 20.dp),
            ) {
                items(recent, key = { it.key }) { entry ->
                    val interaction = remember { MutableInteractionSource() }
                    val shape = RoundedCornerShape(14.dp)
                    Column(
                        Modifier
                            .width(84.dp)
                            .focusHighlight(interaction, shape)
                            .clip(shape)
                            .clickable(interactionSource = interaction, indication = LocalIndication.current) { vm.launch(entry) }
                            .padding(4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(Modifier.size(76.dp).clip(shape)) { TileArt(entry, Modifier.fillMaxSize()) }
                        Spacer(Modifier.height(4.dp))
                        Text(entry.label, color = TextSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        Spacer(Modifier.height(32.dp))
    }
}
