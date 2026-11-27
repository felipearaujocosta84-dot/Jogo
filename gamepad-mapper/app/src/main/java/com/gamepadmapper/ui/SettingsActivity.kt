package com.gamepadmapper.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
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
        val status = findViewById<TextView>(R.id.serviceStatus)
        val diag = findViewById<TextView>(R.id.serviceDiag)
        val svc = MapperRuntime.service
        when {
            svc != null -> {
                status.text = "● Serviço ativo — toques e leitura de botões disponíveis"
                status.setTextColor(getColor(R.color.ok_green))
                diag.text = buildString {
                    append("Perfil em uso: ").append(svc.activeProfile?.name ?: "nenhum")
                    append("\nCaptura de analógicos: ").append(if (svc.isCapturingAnalogs) "ativa" else "inativa (só fora deste app e com perfil ativo)")
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
