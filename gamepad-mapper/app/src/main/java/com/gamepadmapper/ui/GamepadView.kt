package com.gamepadmapper.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import com.gamepadmapper.input.ControllerState
import com.gamepadmapper.input.PhysicalInput
import kotlin.math.min

/** Desenho de um controle que acende os botoes pressionados e mostra a posicao dos analogicos. */
class GamepadView @JvmOverloads constructor(ctx: Context, attrs: AttributeSet? = null) : View(ctx, attrs) {
    private var state = ControllerState()
    private val neon = 0xFF00D4FF.toInt()
    private val purple = 0xFF7C4DFF.toInt()
    private val dim = 0xFF1E2B40.toInt()
    private val body = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF0B1220.toInt() }
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = neon; strokeWidth = 4f }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFE8F4FF.toInt(); textAlign = Paint.Align.CENTER; isFakeBoldText = true }
    private val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = neon; alpha = 90 }

    fun update(s: ControllerState) { state = s.copy(); invalidate() }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat(); val h = height.toFloat()
        val u = min(w / 16f, h / 10f) // unidade
        val ox = (w - 16 * u) / 2f; val oy = (h - 10 * u) / 2f
        fun X(v: Float) = ox + v * u
        fun Y(v: Float) = oy + v * u
        text.textSize = u * 0.55f

        // Gatilhos e bumpers
        trigger(canvas, RectF(X(1.5f), Y(0.2f), X(4.5f), Y(1.0f)), state.lt, state.isPressed(PhysicalInput.L2), "L2")
        trigger(canvas, RectF(X(11.5f), Y(0.2f), X(14.5f), Y(1.0f)), state.rt, state.isPressed(PhysicalInput.R2), "R2")
        pill(canvas, RectF(X(1.5f), Y(1.2f), X(4.5f), Y(1.9f)), state.isPressed(PhysicalInput.L1), "L1")
        pill(canvas, RectF(X(11.5f), Y(1.2f), X(14.5f), Y(1.9f)), state.isPressed(PhysicalInput.R1), "R1")

        // Corpo
        val bodyRect = RectF(X(0.5f), Y(2.2f), X(15.5f), Y(9.6f))
        canvas.drawRoundRect(bodyRect, 3 * u, 3 * u, body)
        canvas.drawRoundRect(bodyRect, 3 * u, 3 * u, stroke)

        // Direcional
        val dc = floatArrayOf(X(3.4f), Y(4.6f)); val ds = 0.75f * u
        dpad(canvas, dc[0], dc[1] - 1.1f * u, ds, state.isPressed(PhysicalInput.DPAD_UP), "↑")
        dpad(canvas, dc[0], dc[1] + 1.1f * u, ds, state.isPressed(PhysicalInput.DPAD_DOWN), "↓")
        dpad(canvas, dc[0] - 1.1f * u, dc[1], ds, state.isPressed(PhysicalInput.DPAD_LEFT), "←")
        dpad(canvas, dc[0] + 1.1f * u, dc[1], ds, state.isPressed(PhysicalInput.DPAD_RIGHT), "→")

        // ABXY
        val bc = floatArrayOf(X(12.6f), Y(4.6f)); val br = 0.6f * u
        round(canvas, bc[0], bc[1] + 1.1f * u, br, state.isPressed(PhysicalInput.A), "A")
        round(canvas, bc[0] + 1.1f * u, bc[1], br, state.isPressed(PhysicalInput.B), "B")
        round(canvas, bc[0] - 1.1f * u, bc[1], br, state.isPressed(PhysicalInput.X), "X")
        round(canvas, bc[0], bc[1] - 1.1f * u, br, state.isPressed(PhysicalInput.Y), "Y")

        // Select / Start
        pill(canvas, RectF(X(6.2f), Y(3.6f), X(7.6f), Y(4.2f)), state.isPressed(PhysicalInput.SELECT), "SE")
        pill(canvas, RectF(X(8.4f), Y(3.6f), X(9.8f), Y(4.2f)), state.isPressed(PhysicalInput.START), "ST")

        // Analogicos
        stick(canvas, X(5.6f), Y(7.4f), 1.3f * u, state.lx, state.ly, state.isPressed(PhysicalInput.L3), "L")
        stick(canvas, X(10.4f), Y(7.4f), 1.3f * u, state.rx, state.ry, state.isPressed(PhysicalInput.R3), "R")
    }

    private fun round(c: Canvas, x: Float, y: Float, r: Float, on: Boolean, label: String) {
        if (on) c.drawCircle(x, y, r * 1.5f, glow)
        fill.color = if (on) neon else dim
        c.drawCircle(x, y, r, fill)
        text.color = if (on) 0xFF070B14.toInt() else 0xFFE8F4FF.toInt()
        c.drawText(label, x, y + text.textSize / 3, text)
    }

    private fun dpad(c: Canvas, x: Float, y: Float, s: Float, on: Boolean, label: String) {
        fill.color = if (on) neon else dim
        c.drawRoundRect(RectF(x - s, y - s, x + s, y + s), s / 3, s / 3, fill)
        text.color = if (on) 0xFF070B14.toInt() else 0xFFE8F4FF.toInt()
        c.drawText(label, x, y + text.textSize / 3, text)
    }

    private fun pill(c: Canvas, r: RectF, on: Boolean, label: String) {
        fill.color = if (on) neon else dim
        c.drawRoundRect(r, r.height() / 2, r.height() / 2, fill)
        text.color = if (on) 0xFF070B14.toInt() else 0xFFE8F4FF.toInt()
        c.drawText(label, r.centerX(), r.centerY() + text.textSize / 3, text)
    }

    private fun trigger(c: Canvas, r: RectF, value: Float, on: Boolean, label: String) {
        fill.color = dim
        c.drawRoundRect(r, 8f, 8f, fill)
        val v = if (on && value < 0.05f) 1f else value
        fill.color = purple
        c.drawRoundRect(RectF(r.left, r.top, r.left + r.width() * v.coerceIn(0f, 1f), r.bottom), 8f, 8f, fill)
        text.color = 0xFFE8F4FF.toInt()
        c.drawText(label, r.centerX(), r.centerY() + text.textSize / 3, text)
    }

    private fun stick(c: Canvas, x: Float, y: Float, r: Float, ax: Float, ay: Float, pressed: Boolean, label: String) {
        fill.color = 0xFF070B14.toInt()
        c.drawCircle(x, y, r, fill)
        c.drawCircle(x, y, r, stroke)
        val kx = x + ax * r * 0.7f; val ky = y + ay * r * 0.7f
        if (pressed) c.drawCircle(kx, ky, r * 0.7f, glow)
        fill.color = if (ax * ax + ay * ay > 0.01f || pressed) neon else dim
        c.drawCircle(kx, ky, r * 0.42f, fill)
        text.color = 0xFF070B14.toInt()
        c.drawText(label, kx, ky + text.textSize / 3, text)
    }
}
