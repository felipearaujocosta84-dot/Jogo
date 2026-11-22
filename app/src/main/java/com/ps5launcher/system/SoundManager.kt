package com.ps5launcher.system

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.SystemClock
import com.ps5launcher.R
import java.util.Collections

/** Toca os efeitos sonoros curtos do launcher (sons originais, criados para este projeto). */
class SoundManager(context: Context) {

    enum class Sfx { MOVE, SELECT, BACK, PANEL, STARTUP }

    var enabled: Boolean = true

    private val pool: SoundPool = SoundPool.Builder()
        .setMaxStreams(4)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        )
        .build()

    private val loaded: MutableSet<Int> = Collections.synchronizedSet(mutableSetOf())
    private var pendingStartup = false
    private var lastMove = 0L

    private val ids: Map<Sfx, Int>

    init {
        ids = mapOf(
            Sfx.MOVE to pool.load(context, R.raw.sfx_move, 1),
            Sfx.SELECT to pool.load(context, R.raw.sfx_select, 1),
            Sfx.BACK to pool.load(context, R.raw.sfx_back, 1),
            Sfx.PANEL to pool.load(context, R.raw.sfx_panel, 1),
            Sfx.STARTUP to pool.load(context, R.raw.sfx_startup, 1),
        )
        pool.setOnLoadCompleteListener { _, sampleId, status ->
            if (status == 0) {
                loaded.add(sampleId)
                if (pendingStartup && sampleId == ids[Sfx.STARTUP]) {
                    pendingStartup = false
                    play(Sfx.STARTUP)
                }
            }
        }
    }

    fun play(sfx: Sfx) {
        if (!enabled) return
        val id = ids[sfx] ?: return
        if (id !in loaded) {
            if (sfx == Sfx.STARTUP) pendingStartup = true
            return
        }
        if (sfx == Sfx.MOVE) {
            val now = SystemClock.uptimeMillis()
            if (now - lastMove < 45) return
            lastMove = now
        }
        val volume = when (sfx) {
            Sfx.MOVE -> 0.45f
            Sfx.STARTUP -> 0.7f
            else -> 0.8f
        }
        pool.play(id, volume, volume, 1, 0, 1f)
    }
}
