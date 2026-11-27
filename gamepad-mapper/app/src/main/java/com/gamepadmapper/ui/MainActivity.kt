package com.gamepadmapper.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import com.gamepadmapper.R
import com.gamepadmapper.input.ControllerDetector
import com.gamepadmapper.profile.ProfileRepository
import com.gamepadmapper.service.MapperRuntime
import com.gamepadmapper.settings.AppSettings

class MainActivity : BaseActivity() {
    private lateinit var detector: ControllerDetector
    private val refresher: () -> Unit = { runOnUiThread { refreshStatus() } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        detector = ControllerDetector(this)

        findViewById<Button>(R.id.btnConnect).setOnClickListener {
            startActivity(Intent(this, ControllerActivity::class.java))
        }
        findViewById<Button>(R.id.btnMyGames).setOnClickListener {
            startActivity(Intent(this, ProfilesActivity::class.java))
        }
        findViewById<Button>(R.id.btnCreate).setOnClickListener {
            ProfileForm.showCreate(this) { profile ->
                startActivity(EditorActivity.intent(this, profile.id))
            }
        }
        findViewById<Button>(R.id.btnSettings).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        findViewById<android.view.View>(R.id.statusCard).setOnClickListener {
            if (!MapperRuntime.isServiceRunning) {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            } else {
                startActivity(Intent(this, SettingsActivity::class.java))
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
        detector.startListening { refreshStatus() }
        MapperRuntime.addListener(refresher)
        ProfileRepository.get(this).addListener(refresher)
    }

    override fun onPause() {
        super.onPause()
        detector.stopListening()
        MapperRuntime.removeListener(refresher)
        ProfileRepository.get(this).removeListener(refresher)
    }

    private fun refreshStatus() {
        val service = findViewById<TextView>(R.id.statusService)
        val controller = findViewById<TextView>(R.id.statusController)
        val profile = findViewById<TextView>(R.id.statusProfile)

        when {
            MapperRuntime.isServiceRunning -> {
                service.setText(R.string.status_service_on); service.setTextColor(getColor(R.color.ok_green))
            }
            MapperRuntime.isServiceEnabledInSettings(this) -> {
                service.setText(R.string.status_service_enabled_not_running); service.setTextColor(getColor(R.color.warn_amber))
            }
            else -> {
                service.setText(R.string.status_service_off); service.setTextColor(getColor(R.color.danger_red))
            }
        }
        val list = detector.connectedControllers()
        controller.text = when (list.size) {
            0 -> getString(R.string.status_no_controller)
            1 -> getString(R.string.status_controller, list[0].name)
            else -> getString(R.string.status_controllers, list.size)
        }
        controller.setTextColor(getColor(if (list.isEmpty()) R.color.text_secondary else R.color.ok_green))

        val active = ProfileRepository.get(this).activeProfile
        profile.text = if (!AppSettings.get(this).mappingEnabled) getString(R.string.status_paused)
        else active?.let { getString(R.string.status_profile, it.name) } ?: getString(R.string.status_no_profile)
    }
}
