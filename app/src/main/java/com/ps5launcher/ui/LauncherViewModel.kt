package com.ps5launcher.ui

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ps5launcher.LauncherApplication
import com.ps5launcher.data.AppUsage
import com.ps5launcher.data.InstalledApp
import com.ps5launcher.data.LauncherSettings
import com.ps5launcher.data.SettingsRepository
import com.ps5launcher.system.DefaultLauncher
import com.ps5launcher.system.SoundManager.Sfx
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class Screen { HOME, LIBRARY, PROFILE, SETTINGS }
enum class HomeTab { GAMES, MEDIA }

/** Um app já combinado com as suas escolhas (é jogo? está oculto? tem capa?). */
data class AppEntry(
    val app: InstalledApp,
    val isGame: Boolean,
    val isMedia: Boolean,
    val isHidden: Boolean,
    val coverPath: String?,
    val usage: AppUsage?,
) {
    val key: String get() = app.key
    val label: String get() = app.label
}

/**
 * O "cérebro" do launcher: guarda em qual tela você está, qual jogo está selecionado
 * e executa as ações (abrir jogo, marcar como jogo, trocar capa...).
 */
class LauncherViewModel(application: Application) : AndroidViewModel(application) {

    private val launcher = application as LauncherApplication
    private val repo = launcher.apps
    private val settingsRepo = launcher.settings
    private val images = launcher.images
    private val sounds = launcher.sounds

    val settings: StateFlow<LauncherSettings> = settingsRepo.state
    val appsLoaded: StateFlow<Boolean> = repo.loaded

    val entries: StateFlow<List<AppEntry>> = combine(repo.apps, settingsRepo.state) { apps, s ->
        apps.map { toEntry(it, s) }
    }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val byRecent = compareByDescending<AppEntry> { it.usage?.lastLaunched ?: 0L }
        .thenBy { it.label.lowercase() }

    val games: StateFlow<List<AppEntry>> = entries.map { list ->
        list.filter { it.isGame && !it.isHidden }.sortedWith(byRecent)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val media: StateFlow<List<AppEntry>> = entries.map { list ->
        list.filter { it.isMedia && !it.isHidden }.sortedWith(byRecent)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    // ---- Estado da interface ----
    var screen by mutableStateOf(Screen.HOME)
        private set
    var homeTab by mutableStateOf(HomeTab.GAMES)
        private set
    // Índice 0 é a Loja; 1 é o jogo mais recente (como no console).
    var homeSelection by mutableIntStateOf(1)
        private set
    var controlCenterOpen by mutableStateOf(false)
        private set
    var optionsFor by mutableStateOf<AppEntry?>(null)
        private set
    var backgroundTint by mutableStateOf<Color?>(null)
    var focusedLibraryEntry: AppEntry? = null
    var homeResetSignal by mutableIntStateOf(0)
        private set
    var resumeTick by mutableIntStateOf(0)
        private set
    var isDefaultLauncher by mutableStateOf(true)
        private set

    /** 0 = logo de abertura, 1 = escolha de perfil, 2 = launcher pronto. */
    var bootStage by mutableIntStateOf(BOOT_DONE)
        private set
    private val booting: Boolean get() = bootStage < BOOT_DONE

    init {
        viewModelScope.launch {
            settings.collect { sounds.enabled = it.soundsEnabled }
        }
        refreshDefaultStatus()
        val s = settings.value
        if (s.firstRunDone && s.bootScreen && !launcher.bootShown) bootStage = BOOT_LOGO
        launcher.bootShown = true
    }

    fun bootToProfile() {
        if (bootStage == BOOT_LOGO) bootStage = BOOT_PROFILE
    }

    fun finishBoot() {
        if (bootStage == BOOT_DONE) return
        bootStage = BOOT_DONE
        sounds.play(Sfx.SELECT)
    }

    private fun toEntry(app: InstalledApp, s: LauncherSettings): AppEntry {
        val key = app.key
        val isGame = when (key) {
            in s.forcedGames -> true
            in s.forcedNotGames -> false
            else -> app.detectedGame
        }
        val isMedia = when (key) {
            in s.forcedMedia -> true
            in s.forcedNotMedia -> false
            else -> app.detectedMedia && !isGame
        }
        return AppEntry(app, isGame, isMedia, key in s.hidden, s.covers[key], s.usage[key])
    }

    private fun currentHomeItems(): List<AppEntry> =
        if (homeTab == HomeTab.GAMES) games.value else media.value

    // ---- Navegação ----
    fun navigate(target: Screen) {
        if (booting) return
        if (screen == target && !controlCenterOpen) return
        controlCenterOpen = false
        screen = target
        sounds.play(Sfx.SELECT)
    }

    /** Botão voltar. Na tela inicial não faz nada (um launcher não pode "fechar"). */
    fun back() {
        when {
            optionsFor != null -> { optionsFor = null; sounds.play(Sfx.BACK) }
            controlCenterOpen -> { controlCenterOpen = false; sounds.play(Sfx.BACK) }
            screen != Screen.HOME -> { screen = Screen.HOME; sounds.play(Sfx.BACK) }
        }
    }

    fun setTab(tab: HomeTab) {
        if (homeTab == tab) return
        homeTab = tab
        homeSelection = 1
        sounds.play(Sfx.MOVE)
    }

    fun switchTab(delta: Int) {
        if (booting || screen != Screen.HOME || controlCenterOpen) return
        val tabs = HomeTab.entries
        setTab(tabs[(homeTab.ordinal + delta + tabs.size) % tabs.size])
    }

    fun selectHome(index: Int) {
        if (index == homeSelection) return
        homeSelection = index
        sounds.play(Sfx.MOVE)
    }

    fun toggleControlCenter() {
        if (controlCenterOpen) closeControlCenter() else openControlCenter()
    }

    fun openControlCenter() {
        if (!settings.value.firstRunDone || booting) return
        controlCenterOpen = true
        sounds.play(Sfx.PANEL)
    }

    fun closeControlCenter() {
        controlCenterOpen = false
        sounds.play(Sfx.BACK)
    }

    // ---- Ações com apps ----
    fun launch(entry: AppEntry) {
        sounds.play(Sfx.SELECT)
        optionsFor = null
        if (repo.launch(entry.app)) {
            viewModelScope.launch {
                // Pequena espera para a lista não "pular" enquanto o jogo abre.
                delay(700)
                settingsRepo.recordLaunch(entry.key)
            }
        } else {
            toast("Não foi possível abrir ${entry.label}")
        }
    }

    /** Abre a Google Play (o equivalente da loja do console). */
    fun openStore() {
        sounds.play(Sfx.SELECT)
        val intent = launcher.packageManager.getLaunchIntentForPackage("com.android.vending")
        try {
            if (intent != null) launcher.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            else toast("Google Play não encontrada neste celular")
        } catch (e: Exception) {
            toast("Não foi possível abrir a loja")
        }
    }

    /** Botão "Início" da central de controle. */
    fun goHome() {
        controlCenterOpen = false
        optionsFor = null
        screen = Screen.HOME
        sounds.play(Sfx.BACK)
    }

    fun showOptions(entry: AppEntry) {
        optionsFor = entry
        sounds.play(Sfx.PANEL)
    }

    fun dismissOptions() {
        optionsFor = null
    }

    /** Botão X do controle: abre as opções do item em foco. */
    fun openOptionsForFocused() {
        if (booting || controlCenterOpen || optionsFor != null) return
        val entry = when (screen) {
            Screen.HOME -> currentHomeItems().getOrNull(homeSelection - 1)
            Screen.LIBRARY -> focusedLibraryEntry
            else -> null
        }
        entry?.let { showOptions(it) }
    }

    fun toggleGame(entry: AppEntry) {
        val makeGame = !entry.isGame
        settingsRepo.setMembership(SettingsRepository.K_FORCED_GAMES, entry.key, makeGame)
        settingsRepo.setMembership(SettingsRepository.K_FORCED_NOT_GAMES, entry.key, !makeGame)
        toast(if (makeGame) "${entry.label} agora aparece em Jogos" else "${entry.label} saiu de Jogos")
    }

    fun toggleMedia(entry: AppEntry) {
        val makeMedia = !entry.isMedia
        settingsRepo.setMembership(SettingsRepository.K_FORCED_MEDIA, entry.key, makeMedia)
        settingsRepo.setMembership(SettingsRepository.K_FORCED_NOT_MEDIA, entry.key, !makeMedia)
    }

    fun toggleHidden(entry: AppEntry) {
        settingsRepo.setMembership(SettingsRepository.K_HIDDEN, entry.key, !entry.isHidden)
    }

    fun setCover(entry: AppEntry, uri: Uri) {
        viewModelScope.launch {
            val path = images.import(uri, "cover_${entry.key}", 1280)
            if (path != null) {
                images.delete(entry.coverPath)
                settingsRepo.setCover(entry.key, path)
                toast("Capa atualizada")
            } else {
                toast("Não foi possível usar essa imagem")
            }
        }
    }

    fun removeCover(entry: AppEntry) {
        images.delete(entry.coverPath)
        settingsRepo.setCover(entry.key, null)
    }

    fun openAppInfo(entry: AppEntry) {
        optionsFor = null
        if (!repo.openAppInfo(entry.app)) toast("Não foi possível abrir as informações")
    }

    // ---- Perfil e configurações ----
    fun setUserName(name: String) {
        if (name.isNotBlank()) settingsRepo.setUserName(name)
    }

    fun setAvatar(uri: Uri) {
        viewModelScope.launch {
            val old = settings.value.avatarPath
            val path = images.import(uri, "avatar", 512)
            if (path != null) {
                images.delete(old)
                settingsRepo.setAvatar(path)
            } else {
                toast("Não foi possível usar essa imagem")
            }
        }
    }

    fun removeAvatar() {
        images.delete(settings.value.avatarPath)
        settingsRepo.setAvatar(null)
    }

    fun setBoolean(key: String, value: Boolean) {
        settingsRepo.setBoolean(key, value)
        // Atualiza imediatamente, para o som de confirmação respeitar a nova escolha.
        if (key == SettingsRepository.K_SOUNDS) sounds.enabled = value
        sounds.play(Sfx.MOVE)
    }

    fun setOrientation(value: Int) = settingsRepo.setOrientation(value)
    fun setAccent(index: Int) = settingsRepo.setAccent(index)

    fun completeWelcome(name: String) {
        if (name.isNotBlank()) settingsRepo.setUserName(name)
        settingsRepo.setFirstRunDone()
        sounds.play(Sfx.SELECT)
    }

    fun playStartupSoundOnce() {
        if (launcher.startupSoundPlayed) return
        launcher.startupSoundPlayed = true
        if (settings.value.startupSound && settings.value.firstRunDone) sounds.play(Sfx.STARTUP)
    }

    // ---- Ciclo de vida ----
    fun refreshDefaultStatus() {
        isDefaultLauncher = DefaultLauncher.isDefault(launcher)
    }

    fun onResume() {
        refreshDefaultStatus()
        resumeTick++
        repo.refresh()
    }

    /** Chamado quando você aperta o botão "Início" do Android estando no launcher. */
    fun onHomePressed() {
        optionsFor = null
        controlCenterOpen = false
        screen = Screen.HOME
        homeTab = HomeTab.GAMES
        homeSelection = 1
        homeResetSignal++
    }

    companion object {
        const val BOOT_LOGO = 0
        const val BOOT_PROFILE = 1
        const val BOOT_DONE = 2
    }

    private fun toast(message: String) {
        Toast.makeText(launcher, message, Toast.LENGTH_SHORT).show()
    }
}
