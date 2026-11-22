package com.ps5launcher.ui.components

import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Constraints

/**
 * Garante a tela deitada (horizontal).
 *
 * O launcher pede ao Android para ficar na horizontal. Alguns celulares ignoram esse
 * pedido quando o app é a tela inicial. Nesse caso a tela continua em pé, e este
 * componente gira o desenho do launcher 90°, para que ele apareça deitado do mesmo jeito.
 * Os toques continuam funcionando normalmente.
 *
 * @param force true quando o usuário quer horizontal.
 * @param onRotatedChange avisa se o giro manual está ativo (usado para corrigir o direcional do controle).
 */
@Composable
fun LandscapeFrame(
    force: Boolean,
    onRotatedChange: (Boolean) -> Unit,
    content: @Composable () -> Unit,
) {
    val configuration = LocalConfiguration.current
    val isPortrait = configuration.orientation == Configuration.ORIENTATION_PORTRAIT ||
        configuration.screenHeightDp > configuration.screenWidthDp
    val rotate = force && isPortrait
    SideEffect { onRotatedChange(rotate) }

    if (!rotate) {
        content()
    } else {
        Layout(content = content, modifier = Modifier) { measurables, constraints ->
            val w = constraints.maxWidth
            val h = constraints.maxHeight
            // Mede o conteúdo com largura e altura trocadas (como se a tela estivesse deitada)...
            val placeables = measurables.map { it.measure(Constraints.fixed(h, w)) }
            layout(w, h) {
                placeables.forEach { p ->
                    // ...e gira 90° em volta do centro para ocupar a tela inteira.
                    p.placeWithLayer(x = (w - h) / 2, y = (h - w) / 2) {
                        rotationZ = 90f
                    }
                }
            }
        }
    }
}
