package com.ps5launcher

import android.app.Application
import com.ps5launcher.data.AppRepository
import com.ps5launcher.data.ImageStore
import com.ps5launcher.data.SettingsRepository
import com.ps5launcher.system.SoundManager
import com.ps5launcher.system.TorchController

/**
 * Ponto de partida do app. Cria uma única vez as peças que todo o launcher usa:
 * lista de apps, configurações, imagens salvas, sons e lanterna.
 */
class LauncherApplication : Application() {

    lateinit var apps: AppRepository
        private set
    lateinit var settings: SettingsRepository
        private set
    lateinit var images: ImageStore
        private set
    lateinit var sounds: SoundManager
        private set
    val torch: TorchController by lazy { TorchController(this) }

    /** Garante que o som de abertura toque só uma vez por inicialização. */
    var startupSoundPlayed = false

    override fun onCreate() {
        super.onCreate()
        settings = SettingsRepository(this)
        apps = AppRepository(this)
        images = ImageStore(this)
        sounds = SoundManager(this)
    }
}
