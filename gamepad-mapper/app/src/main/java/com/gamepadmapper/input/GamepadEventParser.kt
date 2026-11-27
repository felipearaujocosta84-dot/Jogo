package com.gamepadmapper.input

import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent

/** Traduz KeyEvent/MotionEvent do Android para o [ControllerState]. */
object GamepadEventParser {

    fun keyToInput(keyCode: Int): PhysicalInput? = when (keyCode) {
        KeyEvent.KEYCODE_BUTTON_A -> PhysicalInput.A
        KeyEvent.KEYCODE_BUTTON_B -> PhysicalInput.B
        KeyEvent.KEYCODE_BUTTON_X -> PhysicalInput.X
        KeyEvent.KEYCODE_BUTTON_Y -> PhysicalInput.Y
        KeyEvent.KEYCODE_BUTTON_L1 -> PhysicalInput.L1
        KeyEvent.KEYCODE_BUTTON_R1 -> PhysicalInput.R1
        KeyEvent.KEYCODE_BUTTON_L2 -> PhysicalInput.L2
        KeyEvent.KEYCODE_BUTTON_R2 -> PhysicalInput.R2
        KeyEvent.KEYCODE_BUTTON_THUMBL -> PhysicalInput.L3
        KeyEvent.KEYCODE_BUTTON_THUMBR -> PhysicalInput.R3
        KeyEvent.KEYCODE_BUTTON_START -> PhysicalInput.START
        KeyEvent.KEYCODE_BUTTON_SELECT -> PhysicalInput.SELECT
        KeyEvent.KEYCODE_DPAD_UP -> PhysicalInput.DPAD_UP
        KeyEvent.KEYCODE_DPAD_DOWN -> PhysicalInput.DPAD_DOWN
        KeyEvent.KEYCODE_DPAD_LEFT -> PhysicalInput.DPAD_LEFT
        KeyEvent.KEYCODE_DPAD_RIGHT -> PhysicalInput.DPAD_RIGHT
        else -> null
    }

    fun isFromGamepad(source: Int): Boolean =
        (source and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD ||
            (source and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK ||
            (source and InputDevice.SOURCE_DPAD) == InputDevice.SOURCE_DPAD

    /** Evento de tecla vindo de um controle (exclui teclados comuns, exceto se o dispositivo tambem for gamepad). */
    fun isGamepadKey(event: KeyEvent): Boolean {
        if (KeyEvent.isGamepadButton(event.keyCode)) return true
        val device = event.device ?: return false
        if (device.isVirtual) return false
        val src = device.sources
        val isPad = (src and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD ||
            (src and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
        return isPad && keyToInput(event.keyCode) != null
    }

    /**
     * Atualiza o estado com uma tecla.
     * @return o botao fisico reconhecido (ou null se a tecla nao for de controle).
     */
    fun handleKey(event: KeyEvent, state: ControllerState): PhysicalInput? {
        val input = keyToInput(event.keyCode) ?: return null
        when (event.action) {
            KeyEvent.ACTION_DOWN -> state.keysDown += input
            KeyEvent.ACTION_UP -> state.keysDown -= input
        }
        return input
    }

    fun isJoystickMotion(event: MotionEvent): Boolean =
        (event.source and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK &&
            event.action == MotionEvent.ACTION_MOVE

    /** Atualiza os eixos a partir de um MotionEvent de joystick. @return true se foi tratado. */
    fun handleMotion(event: MotionEvent, state: ControllerState): Boolean {
        if (!isJoystickMotion(event)) return false
        val device = event.device
        state.lx = axis(event, device, MotionEvent.AXIS_X)
        state.ly = axis(event, device, MotionEvent.AXIS_Y)

        // Analogico direito: padrao Android = Z/RZ (Xbox, DualShock 4/DualSense em kernels recentes).
        // Alguns controles usam RX/RY para o analogico direito.
        val hasZ = device?.getMotionRange(MotionEvent.AXIS_Z, event.source) != null
        val hasRx = device?.getMotionRange(MotionEvent.AXIS_RX, event.source) != null
        val hasLTrigger = device?.getMotionRange(MotionEvent.AXIS_LTRIGGER, event.source) != null ||
            device?.getMotionRange(MotionEvent.AXIS_BRAKE, event.source) != null
        if (hasZ || !hasRx) {
            state.rx = axis(event, device, MotionEvent.AXIS_Z)
            state.ry = axis(event, device, MotionEvent.AXIS_RZ)
        } else {
            state.rx = axis(event, device, MotionEvent.AXIS_RX)
            state.ry = axis(event, device, MotionEvent.AXIS_RY)
        }

        var lt = maxOf(event.getAxisValue(MotionEvent.AXIS_LTRIGGER), event.getAxisValue(MotionEvent.AXIS_BRAKE))
        var rt = maxOf(event.getAxisValue(MotionEvent.AXIS_RTRIGGER), event.getAxisValue(MotionEvent.AXIS_GAS))
        if (!hasLTrigger && hasZ && hasRx) {
            // Mapeamento antigo de alguns controles PlayStation: gatilhos em RX/RY (-1..1).
            lt = (event.getAxisValue(MotionEvent.AXIS_RX) + 1f) / 2f
            rt = (event.getAxisValue(MotionEvent.AXIS_RY) + 1f) / 2f
        }
        state.lt = lt.coerceIn(0f, 1f)
        state.rt = rt.coerceIn(0f, 1f)
        state.hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X)
        state.hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y)
        return true
    }

    /** Valor do eixo ignorando a faixa "flat" (ruido em repouso) informada pelo proprio dispositivo. */
    private fun axis(event: MotionEvent, device: InputDevice?, axis: Int): Float {
        val value = event.getAxisValue(axis)
        val flat = device?.getMotionRange(axis, event.source)?.flat ?: 0f
        return if (kotlin.math.abs(value) > flat) value else 0f
    }

    fun keyName(keyCode: Int): String = KeyEvent.keyCodeToString(keyCode).removePrefix("KEYCODE_")
}
