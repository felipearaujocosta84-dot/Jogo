package com.ps5launcher.ui.components

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.text.format.DateFormat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.ps5launcher.LauncherApplication
import com.ps5launcher.data.AppRepository
import com.ps5launcher.data.InstalledApp
import com.ps5launcher.ui.theme.GlassFill
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.PsGlow
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary
import java.util.Date
import java.util.Locale

// ------------------------------------------------------------
// Acesso aos dados a partir das telas
// ------------------------------------------------------------

@Composable
fun launcherApp(): LauncherApplication = LocalContext.current.applicationContext as LauncherApplication

@Composable
fun rememberAppIcon(app: InstalledApp, sizeDp: Int = AppRepository.TILE_ICON_DP): ImageBitmap? {
    val repo = launcherApp().apps
    val state = produceState(initialValue = repo.cachedIcon(app.key, sizeDp), app.key, sizeDp) {
        if (value == null) value = repo.icon(app, sizeDp)
    }
    return state.value
}

@Composable
fun rememberAppTint(app: InstalledApp): Color? {
    val repo = launcherApp().apps
    val state = produceState(initialValue = repo.cachedColor(app.key), app.key) {
        if (value == null) value = repo.color(app)
    }
    return state.value?.let { Color(it) }
}

@Composable
fun rememberStoredImage(path: String?, maxSize: Int): ImageBitmap? {
    val store = launcherApp().images
    val state = produceState(initialValue = path?.let { store.cached(it, maxSize) }, path, maxSize) {
        value = path?.let { store.load(it, maxSize) }
    }
    return state.value
}

// ------------------------------------------------------------
// Relógio e bateria (compartilhados por todas as telas)
// ------------------------------------------------------------

data class BatteryInfo(val percent: Int, val charging: Boolean)

val LocalNow = staticCompositionLocalOf { System.currentTimeMillis() }
val LocalBattery = staticCompositionLocalOf { BatteryInfo(-1, false) }

/** Hora atual, atualizada a cada minuto pelo próprio Android (sem gastar bateria). */
@Composable
fun rememberNow(refreshKey: Any): Long {
    val context = LocalContext.current
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    DisposableEffect(refreshKey) {
        now = System.currentTimeMillis()
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                now = System.currentTimeMillis()
            }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_TIME_TICK)
            addAction(Intent.ACTION_TIME_CHANGED)
            addAction(Intent.ACTION_TIMEZONE_CHANGED)
        }
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        onDispose { runCatching { context.unregisterReceiver(receiver) } }
    }
    return now
}

@Composable
fun rememberBattery(): BatteryInfo {
    val context = LocalContext.current
    var info by remember { mutableStateOf(BatteryInfo(-1, false)) }
    DisposableEffect(Unit) {
        fun parse(intent: Intent): BatteryInfo {
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100).coerceAtLeast(1)
            val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
            return BatteryInfo(if (level < 0) -1 else level * 100 / scale, charging)
        }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                info = parse(intent)
            }
        }
        val sticky = ContextCompat.registerReceiver(
            context, receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED
        )
        if (sticky != null) info = parse(sticky)
        onDispose { runCatching { context.unregisterReceiver(receiver) } }
    }
    return info
}

@Composable
fun formattedTime(now: Long): String {
    val context = LocalContext.current
    return remember(now) { DateFormat.getTimeFormat(context).format(Date(now)) }
}

@Composable
fun formattedDate(now: Long): String = remember(now) {
    val pattern = DateFormat.getBestDateTimePattern(Locale.getDefault(), "EEEEdMMMM")
    DateFormat.format(pattern, now).toString().replaceFirstChar { it.titlecase(Locale.getDefault()) }
}

/** Desenho da bateria com o nível preenchido (e um raio quando está carregando). */
@Composable
fun BatteryGlyph(info: BatteryInfo, modifier: Modifier = Modifier, color: Color = TextPrimary) {
    val level = if (info.percent < 0) 1f else info.percent / 100f
    val fillColor = when {
        info.charging -> Color(0xFF3DDC84)
        info.percent in 0..15 -> Color(0xFFFF5A5A)
        else -> color
    }
    Canvas(modifier.size(width = 26.dp, height = 13.dp)) {
        val stroke = 1.5.dp.toPx()
        val tip = 2.5.dp.toPx()
        val bodyW = size.width - tip
        drawRoundRect(
            color = color.copy(alpha = 0.8f),
            size = Size(bodyW, size.height),
            cornerRadius = CornerRadius(3.dp.toPx()),
            style = Stroke(stroke),
        )
        drawRoundRect(
            color = color.copy(alpha = 0.8f),
            topLeft = Offset(bodyW, size.height * 0.3f),
            size = Size(tip, size.height * 0.4f),
            cornerRadius = CornerRadius(1.dp.toPx()),
        )
        val pad = stroke * 1.6f
        drawRoundRect(
            color = fillColor,
            topLeft = Offset(pad, pad),
            size = Size((bodyW - pad * 2) * level.coerceIn(0.04f, 1f), size.height - pad * 2),
            cornerRadius = CornerRadius(1.5.dp.toPx()),
        )
    }
}

/** Relógio + bateria, como no canto da tela do console. */
@Composable
fun StatusCluster(modifier: Modifier = Modifier) {
    val now = LocalNow.current
    val battery = LocalBattery.current
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        BatteryGlyph(battery)
        if (battery.percent >= 0) {
            Spacer(Modifier.width(6.dp))
            Text("${battery.percent}%", color = TextSecondary, fontSize = 13.sp)
        }
        Spacer(Modifier.width(14.dp))
        Text(formattedTime(now), color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Medium)
    }
}

// ------------------------------------------------------------
// Elementos visuais reutilizáveis
// ------------------------------------------------------------

/** Destaque usado quando um item está selecionado pelo controle: aumenta e ganha borda branca. */
@Composable
fun Modifier.focusHighlight(
    interaction: MutableInteractionSource,
    shape: Shape,
    scaleUp: Float = 1.06f,
): Modifier {
    val focused by interaction.collectIsFocusedAsState()
    val scale by animateFloatAsState(if (focused) scaleUp else 1f, label = "focusScale")
    return this
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .then(if (focused) Modifier.border(2.dp, Color.White, shape) else Modifier)
}

/** Botão em formato de pílula, como o "Jogar" do console. */
@Composable
fun PsButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    primary: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(50)
    val content = if (primary) Color(0xFF0A0F1E) else TextPrimary
    Row(
        modifier
            .focusHighlight(interaction, shape, 1.05f)
            .clip(shape)
            .background(if (primary) Color.White else GlassFill)
            .then(if (primary) Modifier else Modifier.border(1.dp, GlassStroke, shape))
            .clickable(interactionSource = interaction, indication = LocalIndication.current, onClick = onClick)
            .padding(horizontal = 26.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, color = content, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

/** Botão redondo só com ícone. */
@Composable
fun PsIconButton(
    icon: ImageVector,
    description: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    active: Boolean = false,
    plain: Boolean = false,
) {
    val interaction = remember { MutableInteractionSource() }
    val accent = LocalAccent.current
    Box(
        modifier
            .focusHighlight(interaction, CircleShape, 1.1f)
            .size(size)
            .clip(CircleShape)
            .background(if (active) accent else if (plain) Color.Transparent else GlassFill)
            .clickable(interactionSource = interaction, indication = LocalIndication.current, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = description, tint = TextPrimary, modifier = Modifier.size(size * if (plain) 0.6f else 0.5f))
    }
}

/** Painel de "vidro" translúcido. */
@Composable
fun GlassPanel(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(20.dp),
    content: @Composable () -> Unit,
) {
    Box(
        modifier
            .clip(shape)
            .background(GlassFill)
            .border(1.dp, GlassStroke, shape)
    ) { content() }
}

/** Foto do perfil (ou a inicial do nome, se não houver foto). */
@Composable
fun Avatar(path: String?, name: String, size: Dp, modifier: Modifier = Modifier) {
    val image = rememberStoredImage(path, 384)
    val accent = LocalAccent.current
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(accent, PsGlow)))
            .border(2.dp, Color.White.copy(alpha = 0.75f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (image != null) {
            Image(image, contentDescription = "Avatar", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        } else {
            Text(
                name.trim().take(1).uppercase().ifEmpty { "J" },
                color = Color.White,
                fontSize = (size.value * 0.42f).sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

/** Ícone de um app (com um espaço reservado enquanto carrega). */
@Composable
fun AppIconImage(app: InstalledApp, modifier: Modifier = Modifier, sizeDp: Int = AppRepository.TILE_ICON_DP) {
    val icon = rememberAppIcon(app, sizeDp)
    if (icon != null) {
        Image(icon, contentDescription = app.label, modifier = modifier, contentScale = ContentScale.Fit)
    } else {
        Box(modifier.clip(RoundedCornerShape(30)).background(GlassFill))
    }
}

/** Cabeçalho das telas internas: botão voltar + título. */
@Composable
fun ScreenHeader(title: String, onBack: () -> Unit, modifier: Modifier = Modifier, trailing: @Composable () -> Unit = {}) {
    Row(
        modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PsIconButton(Icons.AutoMirrored.Filled.ArrowBack, "Voltar", onBack)
        Spacer(Modifier.width(16.dp))
        Text(
            title,
            color = TextPrimary,
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        trailing()
        Spacer(Modifier.width(12.dp))
        StatusCluster()
    }
}

/** Opção selecionável em formato de "chip". */
@Composable
fun ChoiceChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val interaction = remember { MutableInteractionSource() }
    val accent = LocalAccent.current
    val shape = RoundedCornerShape(50)
    Box(
        modifier
            .focusHighlight(interaction, shape, 1.05f)
            .clip(shape)
            .background(if (selected) accent else GlassFill)
            .border(1.dp, if (selected) accent else GlassStroke, shape)
            .clickable(interactionSource = interaction, indication = LocalIndication.current, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 9.dp),
    ) {
        Text(label, color = TextPrimary, fontSize = 14.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text.uppercase(),
        color = TextSecondary,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.5.sp,
        modifier = modifier.padding(top = 20.dp, bottom = 8.dp, start = 4.dp),
    )
}

@Composable
fun StatCard(value: String, label: String, modifier: Modifier = Modifier) {
    GlassPanel(modifier) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(value, color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Bold)
            Text(label, color = TextSecondary, fontSize = 13.sp)
        }
    }
}
