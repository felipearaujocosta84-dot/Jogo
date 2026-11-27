package com.gamepadmapper.service

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.TextView
import com.gamepadmapper.input.GamepadEventParser

/**
 * Pequena janela TYPE_ACCESSIBILITY_OVERLAY (nao exige permissao "sobrepor outros apps").
 *
 * Modo focavel: recebe o foco de entrada para que os MotionEvent dos analogicos cheguem aqui.
 * Ela e FLAG_NOT_TOUCHABLE, entao os toques reais e os gestos injetados atravessam para o jogo.
 * Efeito colateral documentado: o jogo perde o foco de janela (alguns jogos pausam com isso).
 */
class InputCaptureOverlay(
    private val service: AccessibilityService,
    private val onMotion: (MotionEvent) -> Boolean,
) {
    private val wm = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var view: CaptureView? = null
    private var currentFocusable: Boolean? = null
    private var currentVisible: Boolean? = null

    val isFocusableMode: Boolean get() = view != null && currentFocusable == true

    private inner class CaptureView(ctx: Context) : TextView(ctx) {
        init {
            isFocusable = true
            isFocusableInTouchMode = true
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            val pad = (6 * resources.displayMetrics.density).toInt()
            setPadding(pad * 2, pad / 2, pad * 2, pad / 2)
            background = GradientDrawable().apply {
                cornerRadius = 40f
                setColor(0xAA0A0F1A.toInt())
                setStroke(2, 0xFF00D4FF.toInt())
            }
        }

        override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
            if (GamepadEventParser.isJoystickMotion(event) && onMotion(event)) return true
            return super.dispatchGenericMotionEvent(event)
        }

        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
            // As teclas de controle ja passaram pelo filtro de acessibilidade. As que sobraram
            // (nao mapeadas) sao engolidas aqui para nao gerar navegacao inesperada.
            if (KeyEvent.isGamepadButton(event.keyCode)) return true
            return super.dispatchKeyEvent(event)
        }
    }

    fun show(focusable: Boolean, text: String, visibleIndicator: Boolean) {
        val v = view
        if (v != null && currentFocusable == focusable && currentVisible == visibleIndicator) {
            v.text = text
            return
        }
        remove()
        val nv = CaptureView(service)
        nv.text = text
        nv.alpha = if (visibleIndicator) 1f else 0f
        var flags = WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
        if (!focusable) flags = flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            flags,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = (4 * service.resources.displayMetrics.density).toInt()
        }
        try {
            wm.addView(nv, lp)
            view = nv
            currentFocusable = focusable
            currentVisible = visibleIndicator
            if (focusable) nv.post { nv.requestFocus() }
        } catch (e: Exception) {
            view = null; currentFocusable = null; currentVisible = null
        }
    }

    fun remove() {
        view?.let { runCatching { wm.removeView(it) } }
        view = null
        currentFocusable = null
        currentVisible = null
    }
}
