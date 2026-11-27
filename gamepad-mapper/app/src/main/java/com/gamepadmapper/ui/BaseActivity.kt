package com.gamepadmapper.ui

import android.app.Activity
import android.os.Bundle
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import com.gamepadmapper.input.ControllerState
import com.gamepadmapper.input.GamepadEventParser
import com.gamepadmapper.input.PhysicalInput

/**
 * Base das telas: entrega eventos do controle para [onGamepadInput] e configura o botao voltar do cabecalho.
 * Dentro do proprio app, o servico de acessibilidade nao consome os botoes (para o teste/editor funcionarem).
 */
abstract class BaseActivity : Activity() {
    protected val padState = ControllerState()

    /** Telas que querem eventos do controle retornam true para consumir. */
    protected open val consumesGamepad: Boolean = false

    /** Chamado a cada mudanca no estado do controle. [input] = botao que mudou (se tecla). */
    protected open fun onGamepadInput(input: PhysicalInput?, rawKeyCode: Int?, event: Any) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
    }

    protected fun bindBackButton() {
        findViewById<View?>(com.gamepadmapper.R.id.btnBack)?.setOnClickListener { finish() }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (consumesGamepad && GamepadEventParser.isGamepadKey(event)) {
            val input = GamepadEventParser.handleKey(event, padState)
            if (event.repeatCount == 0) onGamepadInput(input, event.keyCode, event)
            return true
        }
        if (consumesGamepad && KeyEvent.isGamepadButton(event.keyCode)) {
            // Botao de controle sem mapeamento padrao (ex.: BUTTON_1..16 de controles genericos).
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) onGamepadInput(null, event.keyCode, event)
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
        if (consumesGamepad && GamepadEventParser.handleMotion(event, padState)) {
            onGamepadInput(null, null, event)
            return true
        }
        return super.dispatchGenericMotionEvent(event)
    }
}
