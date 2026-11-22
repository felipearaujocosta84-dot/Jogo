package com.ps5launcher.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.components.PsButton
import com.ps5launcher.ui.theme.GlassFill
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary

/** Primeira abertura: pergunta o nome e oferece definir como tela inicial. */
@Composable
fun WelcomeScreen(vm: LauncherViewModel, onRequestDefault: () -> Unit) {
    var step by rememberSaveable { mutableIntStateOf(0) }
    var name by rememberSaveable { mutableStateOf("") }
    val keyboard = LocalSoftwareKeyboardController.current
    val accent = LocalAccent.current

    Box(
        Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .verticalScroll(rememberScrollState())
            .padding(28.dp),
        contentAlignment = Alignment.Center,
    ) {
        AnimatedContent(
            targetState = step,
            transitionSpec = { (fadeIn() + slideInHorizontally { it / 4 }) togetherWith fadeOut() },
            label = "welcome",
        ) { current ->
            Column(
                Modifier.widthIn(max = 520.dp).fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                LogoMark()
                if (current == 0) {
                    Text("Bem-vindo ao PS5 Launcher", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Text(
                        "Sua tela inicial com cara de console. Como você quer ser chamado?",
                        color = TextSecondary, fontSize = 16.sp, textAlign = TextAlign.Center,
                    )
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it.take(24) },
                        singleLine = true,
                        placeholder = { Text("Nome do jogador", color = TextSecondary) },
                        shape = RoundedCornerShape(16.dp),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { keyboard?.hide() }),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = accent,
                            unfocusedBorderColor = GlassStroke,
                            focusedContainerColor = GlassFill,
                            unfocusedContainerColor = GlassFill,
                            cursorColor = accent,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(4.dp))
                    PsButton("Continuar", {
                        keyboard?.hide()
                        step = 1
                    }, icon = Icons.AutoMirrored.Filled.ArrowForward)
                } else {
                    Text("Use como tela inicial", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Text(
                        "Para o PS5 Launcher aparecer sempre que você apertar o botão Início, " +
                            "escolha-o como \"Tela inicial\" na próxima tela do Android. " +
                            "Você pode voltar para a tela inicial antiga quando quiser em Configurações > Apps padrão.",
                        color = TextSecondary, fontSize = 15.sp, textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        PsButton("Agora não", { vm.completeWelcome(name) }, primary = false)
                        PsButton("Definir agora", {
                            vm.completeWelcome(name)
                            onRequestDefault()
                        }, icon = Icons.Filled.Home)
                    }
                }
            }
        }
    }
}

/** Logotipo original do launcher: anel com um "play" no centro. */
@Composable
fun LogoMark(modifier: Modifier = Modifier) {
    val accent = LocalAccent.current
    Canvas(modifier.size(96.dp)) {
        val c = Offset(size.width / 2, size.height / 2)
        drawCircle(accent.copy(alpha = 0.35f), radius = size.minDimension * 0.5f, center = c)
        drawCircle(Color.White, radius = size.minDimension * 0.36f, center = c, style = Stroke(width = 4.dp.toPx()))
        val s = size.minDimension
        val play = Path().apply {
            moveTo(c.x - s * 0.09f, c.y - s * 0.15f)
            lineTo(c.x + s * 0.16f, c.y)
            lineTo(c.x - s * 0.09f, c.y + s * 0.15f)
            close()
        }
        drawPath(play, Color.White)
    }
}
