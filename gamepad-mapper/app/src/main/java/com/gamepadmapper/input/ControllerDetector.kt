package com.gamepadmapper.input

import android.content.Context
import android.hardware.input.InputManager
import android.hardware.usb.UsbManager
import android.os.Handler
import android.os.Looper
import android.view.InputDevice
import android.view.MotionEvent

enum class ControllerBrand(val label: String) {
    XBOX("Xbox / Microsoft"),
    PLAYSTATION("PlayStation / Sony"),
    NINTENDO("Nintendo"),
    GENERIC("Genérico / outro fabricante"),
}

enum class ConnectionType(val label: String) {
    USB("USB (OTG)"),
    BLUETOOTH("Bluetooth"),
    UNKNOWN("Bluetooth ou interno (não identificado)"),
}

data class ControllerInfo(
    val deviceId: Int,
    val name: String,
    val vendorId: Int,
    val productId: Int,
    val brand: ControllerBrand,
    val connection: ConnectionType,
    val hasLeftStick: Boolean,
    val hasRightStick: Boolean,
    val hasAnalogTriggers: Boolean,
    val hasDpadHat: Boolean,
) {
    val vidPid: String get() = String.format("%04X:%04X", vendorId, productId)
}

/**
 * Detecta controles conectados via APIs publicas do Android (InputManager/InputDevice).
 * Bluetooth HID e USB HID (OTG) aparecem para o sistema como InputDevice — o kernel faz o driver.
 */
class ControllerDetector(context: Context) {
    private val appContext = context.applicationContext
    private val inputManager = appContext.getSystemService(Context.INPUT_SERVICE) as InputManager
    private var listener: InputManager.InputDeviceListener? = null

    fun connectedControllers(): List<ControllerInfo> {
        val result = ArrayList<ControllerInfo>()
        val seen = HashSet<String>()
        for (id in InputDevice.getDeviceIds()) {
            val device: InputDevice = InputDevice.getDevice(id) ?: continue
            if (!isController(device)) continue
            // Um mesmo controle pode aparecer como varios InputDevice (ex.: touchpad do DualShock).
            if (!seen.add(device.descriptor ?: id.toString())) continue
            result += toInfo(device)
        }
        return result
    }

    fun startListening(onChange: () -> Unit) {
        stopListening()
        val l = object : InputManager.InputDeviceListener {
            override fun onInputDeviceAdded(deviceId: Int) = onChange()
            override fun onInputDeviceRemoved(deviceId: Int) = onChange()
            override fun onInputDeviceChanged(deviceId: Int) = onChange()
        }
        listener = l
        inputManager.registerInputDeviceListener(l, Handler(Looper.getMainLooper()))
    }

    fun stopListening() {
        listener?.let { inputManager.unregisterInputDeviceListener(it) }
        listener = null
    }

    private fun toInfo(d: InputDevice): ControllerInfo {
        fun has(axis: Int) = d.motionRanges.any { it.axis == axis }
        return ControllerInfo(
            deviceId = d.id,
            name = d.name ?: "Controle",
            vendorId = d.vendorId,
            productId = d.productId,
            brand = brandOf(d.vendorId, d.name ?: ""),
            connection = connectionOf(d),
            hasLeftStick = has(MotionEvent.AXIS_X) && has(MotionEvent.AXIS_Y),
            hasRightStick = (has(MotionEvent.AXIS_Z) && has(MotionEvent.AXIS_RZ)) || (has(MotionEvent.AXIS_RX) && has(MotionEvent.AXIS_RY)),
            hasAnalogTriggers = has(MotionEvent.AXIS_LTRIGGER) || has(MotionEvent.AXIS_BRAKE) || has(MotionEvent.AXIS_GAS),
            hasDpadHat = has(MotionEvent.AXIS_HAT_X),
        )
    }

    /** O Android nao expoe o barramento do InputDevice; se o VID/PID estiver na lista USB, e OTG. */
    private fun connectionOf(d: InputDevice): ConnectionType {
        val usb = appContext.getSystemService(Context.USB_SERVICE) as? UsbManager
        val usbMatch = runCatching {
            usb?.deviceList?.values?.any { it.vendorId == d.vendorId && it.productId == d.productId } == true
        }.getOrDefault(false)
        if (usbMatch) return ConnectionType.USB
        return if (android.os.Build.VERSION.SDK_INT >= 29 && d.isExternal) ConnectionType.BLUETOOTH else ConnectionType.UNKNOWN
    }

    companion object {
        fun isController(d: InputDevice): Boolean {
            if (d.isVirtual) return false
            val s = d.sources
            return (s and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD ||
                (s and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
        }

        fun brandOf(vendorId: Int, name: String): ControllerBrand {
            val n = name.lowercase()
            return when {
                vendorId == 0x045E || "xbox" in n -> ControllerBrand.XBOX
                vendorId == 0x054C || "dualshock" in n || "dualsense" in n ||
                    n == "wireless controller" || "playstation" in n -> ControllerBrand.PLAYSTATION
                vendorId == 0x057E || "nintendo" in n || "pro controller" in n || "joy-con" in n -> ControllerBrand.NINTENDO
                else -> ControllerBrand.GENERIC
            }
        }
    }
}
