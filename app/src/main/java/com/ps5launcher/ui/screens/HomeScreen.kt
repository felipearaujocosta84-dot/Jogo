package com.ps5launcher.ui.screens

import android.text.format.DateUtils
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ps5launcher.data.AppRepository
import com.ps5launcher.data.LauncherSettings
import com.ps5launcher.ui.AppEntry
import com.ps5launcher.ui.HomeTab
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.Screen
import com.ps5launcher.ui.components.Avatar
import com.ps5launcher.ui.components.BatteryGlyph
import com.ps5launcher.ui.components.LocalBattery
import com.ps5launcher.ui.components.LocalNow
import com.ps5launcher.ui.components.PsButton
import com.ps5launcher.ui.components.PsIconButton
import com.ps5launcher.ui.components.focusHighlight
import com.ps5launcher.ui.components.formattedTime
import com.ps5launcher.ui.components.rememberAppIcon
import com.ps5launcher.ui.components.rememberAppTint
import com.ps5launcher.ui.components.rememberStoredImage
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.PsNavy
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary

/** Cada item da fileira: "Explorar" no começo, os jogos/apps e a Biblioteca no final. */
private sealed interface HomeTileItem {
    val key: String
}

private object StoreTile : HomeTileItem {
    override val key = "__store"
}

private object LibraryTileItem : HomeTileItem {
    override val key = "__library"
}

private class AppTile(val entry: AppEntry) : HomeTileItem {
    override val key: String get() = entry.key
}

private fun HomeTileItem.label(): String = when (this) {
    is AppTile -> entry.label
    StoreTile -> "Explorar"
    LibraryTileItem -> "Biblioteca de jogos"
}

/** Sombra suave nos textos, para ficarem legíveis sobre qualquer arte de fundo. */
private val TextShadow = Shadow(Color.Black.copy(alpha = 0.7f), blurRadius = 10f)

/**
 * Tela inicial no estilo do dashboard do console:
 * - topo: abas Jogos/Mídia, ícones, avatar e hora
 * - fileira de cartões com o selecionado maior e o nome logo abaixo
 * - arte do jogo ocupando a tela toda
 * - embaixo à esquerda: título, frase e botão Jogar
 * - embaixo à direita: cartão grande com a capa e painel de progresso
 */
@Composable
fun HomeScreen(
    vm: LauncherViewModel,
    settings: LauncherSettings,
    games: List<AppEntry>,
    media: List<AppEntry>,
    totalApps: Int,
    appsLoaded: Boolean,
    onRequestDefault: () -> Unit,
) {
    val items = if (vm.homeTab == HomeTab.GAMES) games else media
    val tiles: List<HomeTileItem> = remember(items) {
        buildList {
            add(StoreTile)
            items.forEach { add(AppTile(it)) }
            add(LibraryTileItem)
        }
    }
    val selection = vm.homeSelection.coerceIn(0, tiles.lastIndex)
    val selected = tiles[selection]
    val selectedEntry = (selected as? AppTile)?.entry

    val listState = rememberLazyListState()
    val selectedFocus = remember { FocusRequester() }

    // Escolher capa direto pelo cartão grande da direita.
    var coverTarget by remember { mutableStateOf<AppEntry?>(null) }
    val coverPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val target = coverTarget
        if (uri != null && target != null) vm.setCover(target, uri)
        coverTarget = null
    }

    LaunchedEffect(vm.homeResetSignal, vm.homeTab) { listState.scrollToItem(0) }
    // Coloca o foco no cartão selecionado (necessário para o controle Bluetooth).
    LaunchedEffect(vm.homeResetSignal, vm.resumeTick, vm.homeTab, tiles.size) {
        runCatching { selectedFocus.requestFocus() }
    }
    // Mantém o cartão selecionado visível ao tocar num cartão escondido pela metade.
    LaunchedEffect(selection) {
        val info = listState.layoutInfo
        val item = info.visibleItemsInfo.firstOrNull { it.index == selection }
        if (item == null || item.offset < 0 || item.offset + item.size > info.viewportEndOffset - 200) {
            listState.animateScrollToItem((selection - 1).coerceAtLeast(0))
        }
    }

    val tint = selectedEntry?.let { rememberAppTint(it.app) }
    LaunchedEffect(tint) { vm.backgroundTint = tint }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val landscape = maxWidth > maxHeight
        val compact = maxHeight < 430.dp
        val tileSize = if (compact) 54.dp else 70.dp
        val selectedSize = if (compact) 82.dp else 108.dp
        val cardSize = if (compact) 148.dp else 210.dp
        val side = if (landscape) 40.dp else 20.dp

        HeroArt(selectedEntry)

        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(top = 8.dp, bottom = 14.dp)
        ) {
            HomeTopBar(vm, settings, onRequestDefault, Modifier.padding(horizontal = side))
            Spacer(Modifier.height(if (compact) 8.dp else 16.dp))

            // Fileira de cartões + nome do selecionado logo abaixo dos cartões menores
            Box(Modifier.fillMaxWidth().height(selectedSize + 6.dp)) {
                LazyRow(
                    state = listState,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.Top,
                    contentPadding = PaddingValues(start = side, end = 240.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    itemsIndexed(tiles, key = { _, t -> t.key }) { index, tile ->
                        TileSlot(
                            tile = tile,
                            selected = index == selection,
                            normalSize = tileSize,
                            selectedSize = selectedSize,
                            modifier = if (index == selection) Modifier.focusRequester(selectedFocus) else Modifier,
                            onFocused = { vm.selectHome(index) },
                            onClick = {
                                if (index != selection) {
                                    vm.selectHome(index)
                                } else {
                                    when (tile) {
                                        is AppTile -> vm.launch(tile.entry)
                                        StoreTile -> vm.openStore()
                                        LibraryTileItem -> vm.navigate(Screen.LIBRARY)
                                    }
                                }
                            },
                            onLongClick = { if (tile is AppTile) vm.showOptions(tile.entry) },
                        )
                    }
                }

                val labelX by remember(selection) {
                    derivedStateOf {
                        listState.layoutInfo.visibleItemsInfo
                            .firstOrNull { it.index == selection }
                            ?.let { it.offset + it.size }
                    }
                }
                labelX?.let { x ->
                    Text(
                        selected.label(),
                        color = TextPrimary,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = TextStyle(shadow = TextShadow),
                        modifier = Modifier
                            .offset { IntOffset(x + 12.dp.roundToPx(), (tileSize + 10.dp).roundToPx()) }
                            .widthIn(max = 300.dp),
                    )
                }
            }

            // Parte de baixo: informações à esquerda, cartão grande à direita
            Box(
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = side)
            ) {
                Crossfade(
                    targetState = selected,
                    animationSpec = tween(250),
                    label = "heroInfo",
                    modifier = Modifier.align(Alignment.BottomStart).fillMaxWidth(0.58f),
                ) { tile ->
                    HeroInfo(
                        tile = tile,
                        compact = compact,
                        tab = vm.homeTab,
                        itemsEmpty = items.isEmpty(),
                        appsLoaded = appsLoaded,
                        gameCount = games.size,
                        totalApps = totalApps,
                        onPlay = { vm.launch(it) },
                        onOptions = { vm.showOptions(it) },
                        onStore = { vm.openStore() },
                        onLibrary = { vm.navigate(Screen.LIBRARY) },
                    )
                }
                Crossfade(
                    targetState = selected,
                    animationSpec = tween(250),
                    label = "sideCard",
                    modifier = Modifier.align(Alignment.BottomEnd),
                ) { tile ->
                    SideCard(
                        tile = tile,
                        cardSize = cardSize,
                        gameCount = games.size,
                        totalApps = totalApps,
                        onClick = {
                            when (tile) {
                                is AppTile -> {
                                    coverTarget = tile.entry
                                    coverPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                                }
                                StoreTile -> vm.openStore()
                                LibraryTileItem -> vm.navigate(Screen.LIBRARY)
                            }
                        },
                    )
                }
            }
        }
    }
}

// ------------------------------------------------------------
// Barra superior
// ------------------------------------------------------------

@Composable
private fun HomeTopBar(
    vm: LauncherViewModel,
    settings: LauncherSettings,
    onRequestDefault: () -> Unit,
    modifier: Modifier,
) {
    val now = LocalNow.current
    val battery = LocalBattery.current
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        TabLabel("Jogos", vm.homeTab == HomeTab.GAMES) { vm.setTab(HomeTab.GAMES) }
        Spacer(Modifier.width(28.dp))
        TabLabel("Mídia", vm.homeTab == HomeTab.MEDIA) { vm.setTab(HomeTab.MEDIA) }
        Spacer(Modifier.weight(1f))
        if (!vm.isDefaultLauncher) {
            SmallChip("Definir como tela inicial", onRequestDefault)
            Spacer(Modifier.width(12.dp))
        }
        PsIconButton(Icons.Filled.Search, "Buscar", { vm.navigate(Screen.LIBRARY) }, size = 40.dp, plain = true)
        Spacer(Modifier.width(6.dp))
        PsIconButton(Icons.Filled.Tune, "Central de controle", { vm.openControlCenter() }, size = 40.dp, plain = true)
        Spacer(Modifier.width(6.dp))
        PsIconButton(Icons.Filled.Settings, "Configurações", { vm.navigate(Screen.SETTINGS) }, size = 40.dp, plain = true)
        Spacer(Modifier.width(12.dp))
        val interaction = remember { MutableInteractionSource() }
        Box(
            Modifier
                .focusHighlight(interaction, CircleShape, 1.1f)
                .clickableCompat(interaction, onClick = { vm.navigate(Screen.PROFILE) })
        ) {
            Avatar(settings.avatarPath, settings.userName, 34.dp)
            // Bolinha verde de "online"
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF3DDC84))
                    .border(1.5.dp, PsNavy, CircleShape)
            )
        }
        Spacer(Modifier.width(26.dp))
        BatteryGlyph(battery)
        Spacer(Modifier.width(12.dp))
        Text(
            formattedTime(now),
            color = TextPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.Light,
            style = TextStyle(shadow = TextShadow),
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Modifier.clickableCompat(
    interaction: MutableInteractionSource,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)? = null,
): Modifier = this.combinedClickable(
    interactionSource = interaction,
    indication = LocalIndication.current,
    onLongClick = onLongClick,
    onClick = onClick,
)

@Composable
private fun TabLabel(text: String, active: Boolean, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        Modifier
            .focusHighlight(interaction, RoundedCornerShape(8.dp), 1.05f)
            .clip(RoundedCornerShape(8.dp))
            .clickableCompat(interaction, onClick)
            .padding(horizontal = 4.dp, vertical = 2.dp),
    ) {
        Text(
            text,
            color = if (active) TextPrimary else TextSecondary.copy(alpha = 0.6f),
            fontSize = 21.sp,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Light,
            style = TextStyle(shadow = TextShadow),
        )
    }
}

@Composable
private fun SmallChip(text: String, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(50)
    Box(
        Modifier
            .focusHighlight(interaction, shape, 1.05f)
            .clip(shape)
            .background(Color.White.copy(alpha = 0.12f))
            .border(1.dp, GlassStroke, shape)
            .clickableCompat(interaction, onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp)
    ) {
        Text(text, color = TextPrimary, fontSize = 12.sp)
    }
}

// ------------------------------------------------------------
// Cartões da fileira
// ------------------------------------------------------------

@Composable
private fun TileSlot(
    tile: HomeTileItem,
    selected: Boolean,
    normalSize: Dp,
    selectedSize: Dp,
    modifier: Modifier,
    onFocused: () -> Unit,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    val size by animateDpAsState(if (selected) selectedSize else normalSize, tween(200), label = "tileSize")
    val interaction = remember { MutableInteractionSource() }

    if (tile is StoreTile) {
        // "Explorar": ícone redondo no começo da fileira
        Box(
            modifier
                .size(size)
                .onFocusChanged { if (it.isFocused) onFocused() }
                .then(
                    if (selected) Modifier.border(2.dp, Color.White, CircleShape).padding(4.dp)
                    else Modifier.padding(size * 0.12f)
                )
                .clip(CircleShape)
                .background(if (selected) Color(0xFF2D7BFF) else Color.White.copy(alpha = 0.10f))
                .clickableCompat(interaction, onClick, onLongClick),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Explore, contentDescription = "Explorar", tint = Color.White, modifier = Modifier.fillMaxSize(0.55f))
        }
    } else {
        val outer = RoundedCornerShape(16.dp)
        val inner = RoundedCornerShape(12.dp)
        Box(
            modifier
                .size(size)
                .onFocusChanged { if (it.isFocused) onFocused() }
                // Contorno branco com uma pequena folga, como o cartão selecionado do console.
                .then(if (selected) Modifier.border(2.5.dp, Color.White, outer).padding(4.dp) else Modifier)
                .clip(inner)
                .clickableCompat(interaction, onClick, onLongClick)
        ) {
            when (tile) {
                is AppTile -> TileArt(tile.entry, Modifier.fillMaxSize())
                else -> Box(
                    Modifier.fillMaxSize().background(Color(0xFF1C2541).copy(alpha = 0.92f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.Apps, contentDescription = "Biblioteca", tint = Color.White, modifier = Modifier.fillMaxSize(0.5f))
                }
            }
        }
    }
}

/** Arte do cartão: a capa escolhida por você ou o ícone sobre a cor do app. */
@Composable
fun TileArt(entry: AppEntry, modifier: Modifier = Modifier) {
    val cover = rememberStoredImage(entry.coverPath, 512)
    if (cover != null) {
        Image(cover, contentDescription = entry.label, modifier = modifier, contentScale = ContentScale.Crop)
    } else {
        val tint = rememberAppTint(entry.app) ?: LocalAccent.current
        val icon = rememberAppIcon(entry.app)
        Box(
            modifier.background(
                Brush.linearGradient(listOf(tint.copy(alpha = 0.95f), tint.copy(alpha = 0.45f), PsNavy))
            ),
            contentAlignment = Alignment.Center,
        ) {
            if (icon != null) {
                Image(icon, contentDescription = entry.label, modifier = Modifier.fillMaxSize(0.66f))
            }
        }
    }
}

// ------------------------------------------------------------
// Arte de fundo (tela inteira)
// ------------------------------------------------------------

@Composable
private fun HeroArt(entry: AppEntry?) {
    Crossfade(targetState = entry, animationSpec = tween(450), label = "heroArt") { current ->
        Box(Modifier.fillMaxSize()) {
            if (current != null) HeroArtImage(current)
            // Escurece a esquerda e a parte de baixo para o texto ficar legível.
            Box(
                Modifier.fillMaxSize().background(
                    Brush.horizontalGradient(
                        0f to Color.Black.copy(alpha = 0.55f),
                        0.5f to Color.Black.copy(alpha = 0.15f),
                        1f to Color.Transparent,
                    )
                )
            )
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(
                        0f to Color.Black.copy(alpha = 0.45f),
                        0.28f to Color.Transparent,
                        0.65f to Color.Transparent,
                        1f to Color.Black.copy(alpha = 0.6f),
                    )
                )
            )
        }
    }
}

@Composable
private fun HeroArtImage(entry: AppEntry) {
    val cover = rememberStoredImage(entry.coverPath, 1280)
    if (cover != null) {
        // Capa ocupando a tela toda, como a arte do jogo no console.
        Image(cover, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
    } else {
        // Sem capa: o ícone do jogo, ampliado e bem desfocado, vira a arte de fundo.
        val icon = rememberAppIcon(entry.app, AppRepository.HERO_ICON_DP)
        if (icon != null) {
            Image(
                icon,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().blur(48.dp).alpha(0.45f),
            )
        }
    }
}

// ------------------------------------------------------------
// Parte de baixo: informações (esquerda) e cartão grande (direita)
// ------------------------------------------------------------

@Composable
private fun HeroInfo(
    tile: HomeTileItem,
    compact: Boolean,
    tab: HomeTab,
    itemsEmpty: Boolean,
    appsLoaded: Boolean,
    gameCount: Int,
    totalApps: Int,
    onPlay: (AppEntry) -> Unit,
    onOptions: (AppEntry) -> Unit,
    onStore: () -> Unit,
    onLibrary: () -> Unit,
) {
    val now = LocalNow.current
    val titleSize = if (compact) 32.sp else 44.sp
    val title: String
    val subtitle: String
    when (tile) {
        is AppTile -> {
            val entry = tile.entry
            title = entry.label
            val last = entry.usage?.let {
                DateUtils.getRelativeTimeSpanString(
                    it.lastLaunched, now, DateUtils.MINUTE_IN_MILLIS, DateUtils.FORMAT_ABBREV_RELATIVE
                ).toString()
            }
            subtitle = when {
                last != null -> "Jogado pela última vez $last"
                entry.isGame -> "Pronto para jogar"
                else -> "Toque em Abrir para começar"
            }
        }
        StoreTile -> {
            title = "Explorar"
            subtitle = "Descubra novos jogos na Google Play"
        }
        LibraryTileItem -> {
            title = "Biblioteca de jogos"
            subtitle = when {
                !appsLoaded -> "Carregando seus jogos…"
                itemsEmpty && tab == HomeTab.GAMES -> "Nenhum jogo encontrado. Marque seus jogos na biblioteca."
                itemsEmpty -> "Nenhum app de mídia. Adicione pela biblioteca."
                else -> "$gameCount jogos · $totalApps apps instalados"
            }
        }
    }

    Column(Modifier.fillMaxWidth()) {
        Text(
            title,
            color = TextPrimary,
            fontSize = titleSize,
            fontWeight = FontWeight.Bold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            lineHeight = titleSize * 1.05f,
            style = TextStyle(shadow = TextShadow),
        )
        Spacer(Modifier.height(6.dp))
        Text(
            subtitle,
            color = TextPrimary.copy(alpha = 0.9f),
            fontSize = 15.sp,
            fontWeight = FontWeight.Light,
            maxLines = 2,
            style = TextStyle(shadow = TextShadow),
        )
        Spacer(Modifier.height(if (compact) 12.dp else 18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            when (tile) {
                is AppTile -> {
                    PsButton(
                        text = if (tile.entry.isGame) "Jogar" else "Abrir",
                        onClick = { onPlay(tile.entry) },
                        modifier = Modifier.widthIn(min = 170.dp),
                    )
                    PsIconButton(Icons.Filled.MoreHoriz, "Opções", { onOptions(tile.entry) }, size = 46.dp)
                }
                StoreTile -> PsButton("Abrir loja", onStore, modifier = Modifier.widthIn(min = 170.dp))
                LibraryTileItem -> PsButton("Abrir", onLibrary, modifier = Modifier.widthIn(min = 170.dp))
            }
        }
    }
}

/** Cartão grande à direita (capa + selo) com o painel de progresso embaixo. */
@Composable
private fun SideCard(
    tile: HomeTileItem,
    cardSize: Dp,
    gameCount: Int,
    totalApps: Int,
    onClick: () -> Unit,
) {
    val now = LocalNow.current
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(14.dp)
    Column(Modifier.width(cardSize), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(
            Modifier
                .focusHighlight(interaction, shape, 1.04f)
                .size(cardSize)
                .clip(shape)
                .border(1.dp, GlassStroke, shape)
                .clickableCompat(interaction, onClick)
        ) {
            val badge: String
            val hint: String?
            when (tile) {
                is AppTile -> {
                    TileArt(tile.entry, Modifier.fillMaxSize())
                    badge = if (tile.entry.isGame) "Jogo instalado" else "App instalado"
                    hint = if (tile.entry.coverPath == null) "Toque para escolher a capa" else null
                }
                StoreTile -> {
                    Box(
                        Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF2D7BFF), Color(0xFF0B3EA8)))),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.Explore, contentDescription = null, tint = Color.White, modifier = Modifier.fillMaxSize(0.4f))
                    }
                    badge = "Google Play"
                    hint = null
                }
                LibraryTileItem -> {
                    Box(
                        Modifier.fillMaxSize().background(Color(0xFF1C2541)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.Apps, contentDescription = null, tint = Color.White, modifier = Modifier.fillMaxSize(0.4f))
                    }
                    badge = "Biblioteca"
                    hint = null
                }
            }
            Column(
                Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f))))
                    .padding(10.dp)
            ) {
                Box(
                    Modifier
                        .border(1.dp, Color.White, RoundedCornerShape(3.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(badge, color = Color.White, fontSize = 11.sp)
                }
                if (hint != null) {
                    Spacer(Modifier.height(4.dp))
                    Text(hint, color = Color.White.copy(alpha = 0.85f), fontSize = 10.sp, maxLines = 1)
                }
            }
        }

        // Painel de progresso
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.Black.copy(alpha = 0.5f))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            when (tile) {
                is AppTile -> {
                    val usage = tile.entry.usage
                    Stat(Icons.Filled.EmojiEvents, "Aberturas", "${usage?.count ?: 0}")
                    Stat(
                        Icons.Filled.History, "Última vez",
                        usage?.let {
                            DateUtils.getRelativeTimeSpanString(
                                it.lastLaunched, now, DateUtils.MINUTE_IN_MILLIS, DateUtils.FORMAT_ABBREV_RELATIVE
                            ).toString()
                        } ?: "—",
                    )
                }
                else -> {
                    Stat(Icons.Filled.SportsEsports, "Jogos", "$gameCount")
                    Stat(Icons.Filled.Apps, "Apps", "$totalApps")
                }
            }
        }
    }
}

@Composable
private fun Stat(icon: ImageVector, label: String, value: String) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(12.dp))
            Spacer(Modifier.width(4.dp))
            Text(label, color = TextSecondary, fontSize = 10.sp)
        }
        Text(value, color = TextPrimary, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
