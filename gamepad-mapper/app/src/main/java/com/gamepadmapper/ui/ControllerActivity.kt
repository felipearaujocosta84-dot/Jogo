package com.gamepadmapper.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.gamepadmapper.R
import com.gamepadmapper.input.ControllerDetector
import com.gamepadmapper.input.GamepadEventParser
import com.gamepadmapper.input.PhysicalInput

/** Lista os controles conectados e mostra em tempo real os botoes pressionados. */
class ControllerActivity : BaseActivity() {
    private lateinit var detector: ControllerDetector
    private lateinit var gamepadView: GamepadView
    private lateinit var pressedText: TextView
    private lateinit var axesText: TextView
    private lateinit var rawText: TextView

    override val consumesGamepad = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_controller)
        bindBackButton()
        detector = ControllerDetector(this)
        gamepadView = findViewById(R.id.gamepadView)
        pressedText = findViewById(R.id.pressedText)
        axesText = findViewById(R.id.axesText)
        rawText = findViewById(R.id.rawText)

        findViewById<Button>(R.id.btnPairBt).setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
            } catch (e: Exception) {
                Toast.makeText(this, "Configurações de Bluetooth indisponíveis neste aparelho", Toast.LENGTH_LONG).show()
            }
        }
        findViewById<Button>(R.id.btnRefresh).setOnClickListener {
            refreshList()
            Toast.makeText(this, "Lista atualizada", Toast.LENGTH_SHORT).show()
        }
        updateTester()
    }

    override fun onResume() {
        super.onResume()
        refreshList()
        detector.startListening { refreshList() }
    }

    override fun onPause() {
        super.onPause()
        detector.stopListening()
        padState.reset()
        updateTester()
    }

    private fun refreshList() {
        val container = findViewById<LinearLayout>(R.id.controllerList)
        container.removeAllViews()
        val list = detector.connectedControllers()
        findViewById<View>(R.id.controllerEmpty).visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
        val inflater = LayoutInflater.from(this)
        for (c in list) {
            val item = inflater.inflate(R.layout.item_controller, container, false)
            item.findViewById<TextView>(R.id.ctrlName).text = c.name
            val features = buildList {
                if (c.hasLeftStick) add("analógico esq.")
                if (c.hasRightStick) add("analógico dir.")
                if (c.hasAnalogTriggers) add("gatilhos analógicos")
                if (c.hasDpadHat) add("direcional (HAT)")
            }.joinToString(", ").ifEmpty { "somente botões digitais" }
            item.findViewById<TextView>(R.id.ctrlDetails).text =
                "Tipo: ${c.brand.label}\nConexão: ${c.connection.label}\nVID:PID ${c.vidPid}\nRecursos: $features"
            container.addView(item)
        }
    }

    override fun onGamepadInput(input: PhysicalInput?, rawKeyCode: Int?, event: Any) {
        if (input == null && rawKeyCode != null) {
            rawText.text = getString(R.string.controller_unknown_key, GamepadEventParser.keyName(rawKeyCode))
        }
        updateTester()
    }

    private fun updateTester() {
        gamepadView.update(padState)
        val pressed = padState.pressedInputs()
        pressedText.text = if (pressed.isEmpty()) getString(R.string.controller_pressed_none)
        else getString(R.string.controller_pressed, pressed.joinToString("  ") { it.shortLabel })
        axesText.text = String.format(
            "Esq  X %+.2f  Y %+.2f\nDir  X %+.2f  Y %+.2f\nL2 %.2f   R2 %.2f   HAT %+.0f %+.0f",
            padState.lx, padState.ly, padState.rx, padState.ry, padState.lt, padState.rt, padState.hatX, padState.hatY,
        )
    }
}
