package com.ps5launcher.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import com.ps5launcher.ui.theme.PsDeep
import com.ps5launcher.ui.theme.PsNavy
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

private class Particle(val x: Float, val y: Float, val r: Float, val speed: Float, val alpha: Float)

/**
 * Fundo azul-escuro com luzes suaves, ondas e partículas subindo devagar.
 * Tudo é desenhado direto na tela (sem imagens), o que é leve para celulares simples.
 * Com "Fundo animado" desligado nas configurações, fica parado e não gasta processamento.
 */
@Composable
fun AnimatedBackground(tint: Color, animated: Boolean, modifier: Modifier = Modifier) {
    val time: State<Float> = if (animated) {
        val transition = rememberInfiniteTransition(label = "background")
        transition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(30_000, easing = LinearEasing), RepeatMode.Restart),
            label = "time",
        )
    } else {
        remember { mutableFloatStateOf(0.2f) }
    }

    val particles = remember {
        val rnd = Random(7)
        List(22) {
            Particle(
                x = rnd.nextFloat(),
                y = rnd.nextFloat(),
                r = 1f + rnd.nextFloat() * 2.2f,
                speed = 0.5f + rnd.nextFloat(),
                alpha = 0.15f + rnd.nextFloat() * 0.35f,
            )
        }
    }
    val wave = remember { Path() }

    Canvas(modifier.fillMaxSize()) {
        val t = time.value
        val angle = t * 2f * PI.toFloat()
        val w = size.width
        val h = size.height

        // 1. Degradê base
        drawRect(Brush.verticalGradient(listOf(PsDeep, PsNavy, Color(0xFF02040C))))

        // 2. Luzes suaves que se movem (a principal segue a cor do jogo selecionado)
        val c1 = Offset(w * (0.72f + 0.08f * cos(angle)), h * (0.28f + 0.06f * sin(angle)))
        val r1 = maxOf(w, h) * 0.55f
        drawCircle(Brush.radialGradient(listOf(tint.copy(alpha = 0.42f), Color.Transparent), c1, r1), r1, c1)

        val c2 = Offset(w * (0.18f + 0.06f * sin(angle * 2)), h * (0.85f + 0.05f * cos(angle)))
        val r2 = maxOf(w, h) * 0.45f
        drawCircle(Brush.radialGradient(listOf(Color(0xFF1E5BFF).copy(alpha = 0.28f), Color.Transparent), c2, r2), r2, c2)

        val c3 = Offset(w * (0.45f + 0.1f * cos(angle + 1.7f)), h * (0.55f + 0.08f * sin(angle * 3)))
        val r3 = maxOf(w, h) * 0.3f
        drawCircle(Brush.radialGradient(listOf(Color(0xFF00B4F0).copy(alpha = 0.10f), Color.Transparent), c3, r3), r3, c3)

        // 3. Ondas de luz fininhas
        for (i in 0 until 3) {
            wave.reset()
            val baseY = h * (0.62f + i * 0.07f)
            val amp = h * (0.035f + i * 0.01f)
            val steps = 36
            for (s in 0..steps) {
                val x = w * s / steps
                val y = baseY + amp * sin(x / w * 2f * PI.toFloat() * (1.2f + i * 0.3f) + angle * (1 + i))
                if (s == 0) wave.moveTo(x, y) else wave.lineTo(x, y)
            }
            drawPath(wave, Color.White.copy(alpha = 0.05f + i * 0.015f), style = Stroke(width = 1.2f + i * 0.6f))
        }

        // 4. Partículas subindo
        for (p in particles) {
            val y = ((p.y - t * p.speed * 2f) % 1f + 1f) % 1f
            val x = p.x + 0.01f * sin(angle * 3 + p.y * 10f)
            drawCircle(Color.White.copy(alpha = p.alpha), p.r * density, Offset(x * w, y * h))
        }

        // 5. Escurece um pouco a parte de baixo para o texto ficar legível
        drawRect(Brush.verticalGradient(0.6f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.35f)))
    }
}
