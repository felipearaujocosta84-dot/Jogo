package com.gamepadmapper.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.gamepadmapper.R
import com.gamepadmapper.service.MapperRuntime
import com.gamepadmapper.settings.AppSettings

class SettingsActivity : BaseActivity() {
    private lateinit var settings: AppSettings
    private val refresher: () -> Unit = { runOnUiThread { refreshServiceStatus() } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        bindBackButton()
        settings = AppSettings.get(this)

        findViewById<Button>(R.id.btnOpenAccessibility).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }
        findViewById<Button>(R.id.btnAppInfo).setOnClickListener {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        }

        bindSwitch(R.id.swMapping, { settings.mappingEnabled }) { settings.mappingEnabled = it }
        bindSwitch(R.id.swCapture, { settings.captureAnalogs }) { settings.captureAnalogs = it }
        bindSwitch(R.id.swIndicator, { settings.showIndicator }) { settings.showIndicator = it }
        bindSwitch(R.id.swAutoSwitch, { settings.autoSwitchProfile }) { settings.autoSwitchProfile = it }
        bindSwitch(R.id.swPassUnmapped, { settings.passUnmappedButtons }) { settings.passUnmappedButtons = it }
        bindSwitch(R.id.swCompat, { settings.compatTaps }) { settings.compatTaps = it }

        val target = findViewById<Button>(R.id.testTarget)
        target.setOnClickListener {
            if (testPending) {
                testPending = false
                showTestResult(true)
            } else {
                Toast.makeText(this, "Este é o alvo: use os botões de teste abaixo", Toast.LENGTH_SHORT).show()
            }
        }
        findViewById<Button>(R.id.btnTestTap).setOnClickListener { runTouchTest(hold = false) }
        findViewById<Button>(R.id.btnTestHold).setOnClickListener { runTouchTest(hold = true) }

        val dzLabel = findViewById<TextView>(R.id.defaultDeadzoneLabel)
        val dz = findViewById<SeekBar>(R.id.defaultDeadzone)
        dz.progress = (settings.defaultDeadzone * 100).toInt()
        dzLabel.text = getString(R.string.settings_default_deadzone, dz.progress)
        dz.setOnSeekBarChangeListener(SimpleSeek { fromUser ->
            dzLabel.text = getString(R.string.settings_default_deadzone, dz.progress)
            if (fromUser) settings.defaultDeadzone = dz.progress / 100f
        })

        val sLabel = findViewById<TextView>(R.id.defaultSensitivityLabel)
        val s = findViewById<SeekBar>(R.id.defaultSensitivity)
        s.progress = ((settings.defaultSensitivity - 0.1f) * 100).toInt()
        sLabel.text = getString(R.string.settings_default_sensitivity, settings.defaultSensitivity)
        s.setOnSeekBarChangeListener(SimpleSeek { fromUser ->
            val v = 0.1f + s.progress / 100f
            sLabel.text = getString(R.string.settings_default_sensitivity, v)
            if (fromUser) settings.defaultSensitivity = v
        })

        val version = runCatching { packageManager.getPackageInfo(packageName, 0).versionName }.getOrNull() ?: "?"
        findViewById<TextView>(R.id.aboutText).text = getString(R.string.settings_about, version)
    }

    private var testPending = false
    private var testHold = false
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    private fun runTouchTest(hold: Boolean) {
        val svc = MapperRuntime.service
        val result = findViewById<TextView>(R.id.testResult)
        if (svc == null) {
            result.text = "✗ Serviço de acessibilidade desativado — ative-o primeiro."
            result.setTextColor(getColor(R.color.danger_red))
            return
        }
        val target = findViewById<Button>(R.id.testTarget)
        val loc = IntArray(2)
        target.getLocationOnScreen(loc)
        val x = loc[0] + target.width / 2f
        val y = loc[1] + target.height / 2f
        testPending = true
        testHold = hold
        result.text = "Testando…"
        result.setTextColor(getColor(R.color.text_secondary))
        svc.testTouch(x, y, hold) { completed ->
            handler.postDelayed({
                if (testPending) {
                    testPending = false
                    showTestResult(false, if (completed) "o sistema executou o gesto, mas o toque não chegou ao alvo" else "o sistema cancelou/recusou o gesto")
                }
            }, 400)
        }
    }

    private fun showTestResult(ok: Boolean, reason: String = "") {
        val result = findViewById<TextView>(R.id.testResult)
        val kind = if (testHold) "mantido" else "simples"
        if (ok) {
            result.text = "✓ Toque $kind funcionou neste aparelho."
            result.setTextColor(getColor(R.color.ok_green))
            findViewById<Button>(R.id.testTarget).text = "✓ ALVO TOCADO PELO APP"
        } else {
            result.text = "✗ Toque $kind falhou: $reason." + if (testHold) "\nLigue o “Modo de compatibilidade de toque”." else ""
            result.setTextColor(getColor(R.color.danger_red))
        }
    }

    private fun bindSwitch(id: Int, get: () -> Boolean, set: (Boolean) -> Unit) {
        val sw = findViewById<Switch>(id)
        sw.isChecked = get()
        sw.setOnCheckedChangeListener { _, checked -> set(checked) }
    }

    override fun onResume() {
        super.onResume()
        findViewById<Switch>(R.id.swMapping).isChecked = settings.mappingEnabled
        refreshServiceStatus()
        MapperRuntime.addListener(refresher)
    }

    override fun onPause() {
        super.onPause()
        MapperRuntime.removeListener(refresher)
    }

    private fun refreshServiceStatus() {
        val live = findViewById<TextView>(R.id.liveDiag)
        val svcNow = MapperRuntime.service
        live.text = if (svcNow == null) "Serviço parado: sem diagnóstico ao vivo." else buildString {
            append("Botões recebidos do controle: ").append(svcNow.keysReceived)
            append("\nÚltimo botão: ").append(svcNow.lastKey ?: "—")
            append("\nÚltimo app aberto: ").append(svcNow.foregroundPackage ?: "—")
            val p = svcNow.activeProfile
            append("\nPerfil ativo: ").append(p?.name ?: "nenhum")
            p?.packageName?.let { append(" (jogo: ").append(it).append(")") }
            append("\nMapeamento agindo agora: ").append(if (svcNow.mappingActiveNow) "SIM" else "não")
            append("\nToques enviados: ").append(svcNow.gesturesDispatched)
            append("\nAnalógicos: ").append(when {
                svcNow.nativeMotionCapture -> "captura nativa (Android 14+), eventos: ${svcNow.motionEventsReceived}"
                svcNow.isCapturingAnalogs -> "janela de foco (modo antigo)"
                else -> "desligados"
            })
        }
        val status = findViewById<TextView>(R.id.serviceStatus)
        val diag = findViewById<TextView>(R.id.serviceDiag)
        val svc = MapperRuntime.service
        when {
            svc != null -> {
                status.text = "● Serviço ativo — toques e leitura de botões disponíveis"
                status.setTextColor(getColor(R.color.ok_green))
                diag.text = buildString {
                    append("Perfil em uso: ").append(svc.activeProfile?.name ?: "nenhum")
                    append("\nCaptura de analógicos: ").append(
                        if (svc.nativeMotionCapture) "nativa do Android 14+ (não tira o foco do jogo)"
                        else if (svc.isCapturingAnalogs) "janela de foco ativa"
                        else "desligada (Android < 14: ligue a janela de foco abaixo, se o jogo aceitar)")
                    append("\nGestos enviados: ").append(svc.gesturesDispatched)
                    svc.engineError?.let { append("\nÚltimo aviso: ").append(it) }
                }
            }
            MapperRuntime.isServiceEnabledInSettings(this) -> {
                status.text = "● Ativado nas configurações, aguardando o sistema iniciar o serviço"
                status.setTextColor(getColor(R.color.warn_amber))
                diag.text = "Se continuar assim, desative e ative novamente o serviço."
            }
            else -> {
                status.text = "● Serviço desativado — os toques não funcionarão"
                status.setTextColor(getColor(R.color.danger_red))
                diag.text = "Abra Acessibilidade › Apps instalados › Gamepad Mapper e ative."
            }
        }
    }
}
