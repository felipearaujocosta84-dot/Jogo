package com.ps5launcher.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.graphics.Color

// Paleta "console premium": azul profundo, brilhos azuis e vidro translúcido.
val PsNavy = Color(0xFF050B1F)
val PsDeep = Color(0xFF0A1A44)
val PsBlue = Color(0xFF1F6BFF)
val PsGlow = Color(0xFF4DA3FF)
val PsSurface = Color(0xFF0D1834)
val PsSurfaceStrong = Color(0xF20B1530)
val TextPrimary = Color(0xFFF2F5FF)
val TextSecondary = Color(0xFFAEB8D6)
val GlassFill = Color(0x1FFFFFFF)
val GlassFillStrong = Color(0x33FFFFFF)
val GlassStroke = Color(0x33FFFFFF)

data class AccentOption(val name: String, val color: Color)

val AccentOptions = listOf(
    AccentOption("Azul", PsBlue),
    AccentOption("Ciano", Color(0xFF00B4F0)),
    AccentOption("Roxo", Color(0xFF7B5CFF)),
    AccentOption("Carmesim", Color(0xFFE0365A)),
    AccentOption("Dourado", Color(0xFFE6A23C)),
)

/** Cor de destaque escolhida nas configurações, disponível para qualquer tela. */
val LocalAccent = compositionLocalOf { PsBlue }

@Composable
fun PS5Theme(accentIndex: Int, content: @Composable () -> Unit) {
    val accent = AccentOptions.getOrElse(accentIndex) { AccentOptions[0] }.color
    val scheme = darkColorScheme(
        primary = accent,
        onPrimary = Color.White,
        secondary = PsGlow,
        background = PsNavy,
        onBackground = TextPrimary,
        surface = PsSurface,
        onSurface = TextPrimary,
        surfaceVariant = Color(0xFF16213F),
        onSurfaceVariant = TextSecondary,
        outline = GlassStroke,
    )
    CompositionLocalProvider(LocalAccent provides accent) {
        MaterialTheme(colorScheme = scheme, typography = Typography(), content = content)
    }
}
