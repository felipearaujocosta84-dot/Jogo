package com.ps5launcher.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ps5launcher.ui.AppEntry
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.components.focusHighlight
import com.ps5launcher.ui.theme.GlassFill
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.PsSurfaceStrong
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary
import androidx.compose.foundation.layout.Box

/** Menu de opções de um app (toque e segure, ou botão X do controle). */
@Composable
fun AppOptionsDialog(vm: LauncherViewModel, entry: AppEntry) {
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) vm.setCover(entry, uri)
        vm.dismissOptions()
    }
    val firstFocus = remember { FocusRequester() }

    LaunchedEffect(Unit) { runCatching { firstFocus.requestFocus() } }
    // Desenhado dentro do launcher (e não como janela separada), para girar junto com a tela.
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.6f))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                vm.dismissOptions()
            }
            .padding(16.dp),
        contentAlignment = Alignment.Center,
    ) {
        val shape = RoundedCornerShape(26.dp)
        Column(
            Modifier
                .widthIn(max = 440.dp)
                .fillMaxWidth()
                .clip(shape)
                .background(PsSurfaceStrong)
                .border(1.dp, GlassStroke, shape)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 10.dp)) {
                Box(Modifier.size(56.dp).clip(RoundedCornerShape(14.dp))) {
                    TileArt(entry, Modifier.size(56.dp))
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(entry.label, color = TextPrimary, fontSize = 19.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(entry.app.packageName, color = TextSecondary, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }

            OptionRow(Icons.Filled.PlayArrow, if (entry.isGame) "Jogar" else "Abrir", Modifier.focusRequester(firstFocus)) {
                vm.launch(entry)
            }
            OptionRow(Icons.Filled.SportsEsports, if (entry.isGame) "Remover dos jogos" else "Marcar como jogo") {
                vm.toggleGame(entry)
                vm.dismissOptions()
            }
            OptionRow(Icons.Filled.Movie, if (entry.isMedia) "Remover de Mídia" else "Adicionar em Mídia") {
                vm.toggleMedia(entry)
                vm.dismissOptions()
            }
            OptionRow(Icons.Filled.Image, if (entry.coverPath != null) "Trocar capa" else "Escolher capa da galeria") {
                picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            }
            if (entry.coverPath != null) {
                OptionRow(Icons.Filled.Delete, "Remover capa") {
                    vm.removeCover(entry)
                    vm.dismissOptions()
                }
            }
            OptionRow(
                if (entry.isHidden) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                if (entry.isHidden) "Mostrar novamente" else "Ocultar do launcher",
            ) {
                vm.toggleHidden(entry)
                vm.dismissOptions()
            }
            OptionRow(Icons.Filled.Info, "Informações do app (Android)") {
                vm.openAppInfo(entry)
            }

            Spacer(Modifier.height(6.dp))
            Text(
                "Ocultar só esconde o app aqui no launcher. Nenhum app é apagado ou alterado.",
                color = TextSecondary,
                fontSize = 12.sp,
            )
        }
    }
}

@Composable
private fun OptionRow(icon: ImageVector, text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier
            .fillMaxWidth()
            .focusHighlight(interaction, shape, 1.02f)
            .clip(shape)
            .background(GlassFill)
            .clickable(interactionSource = interaction, indication = LocalIndication.current, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Text(text, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Medium)
    }
}
