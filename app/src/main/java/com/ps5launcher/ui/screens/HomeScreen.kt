package com.ps5launcher.ui.screens

import android.text.format.DateUtils
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ps5launcher.data.AppRepository
import com.ps5launcher.data.LauncherSettings
import com.ps5launcher.ui.AppEntry
import com.ps5launcher.ui.HomeTab
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.Screen
import com.ps5launcher.ui.components.Avatar
import com.ps5launcher.ui.components.GlassPanel
import com.ps5launcher.ui.components.LocalNow
import com.ps5launcher.ui.components.PsButton
import com.ps5launcher.ui.components.PsIconButton
import com.ps5launcher.ui.components.StatusCluster
import com.ps5launcher.ui.components.focusHighlight
import com.ps5launcher.ui.components.rememberAppIcon
import com.ps5launcher.ui.components.rememberAppTint
import com.ps5launcher.ui.components.rememberStoredImage
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.PsNavy
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary

/** Cada cartão da fileira: a Loja no começo, os jogos/apps e a Biblioteca no final. */
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

/**
 * Tela inicial no estilo do console (pensada para a horizontal):
 * abas no topo, fileira de cartões, a arte do jogo ocupando o fundo,
 * título grande com o botão "Jogar" e cartões de informação logo abaixo.
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
    val scroll = rememberScrollState()
    val selectedFocus = remember { FocusRequester() }

    // Escolher capa direto pelo cartão "Capa".
    var coverTarget by remember { mutableStateOf<AppEntry?>(null) }
    val coverPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val target = coverTarget
        if (uri != null && target != null) vm.setCover(target, uri)
        coverTarget = null
    }

    LaunchedEffect(vm.homeResetSignal, vm.homeTab) {
        listState.scrollToItem(0)
        scroll.scrollTo(0)
    }
    // Coloca o foco no cartão selecionado (necessário para o controle Bluetooth).
    LaunchedEffect(vm.homeResetSignal, vm.resumeTick, vm.homeTab, tiles.size) {
        runCatching { selectedFocus.requestFocus() }
    }
    // Mantém o cartão selecionado visível ao tocar num cartão escondido pela metade.
    LaunchedEffect(selection) {
        val info = listState.layoutInfo
        val item = info.visibleItemsInfo.firstOrNull { it.index == selection }
        if (item == null || item.offset < 0 || item.offset + item.size > info.viewportEndOffset) {
            listState.animateScrollToItem((selection - 1).coerceAtLeast(0))
        }
    }

    val tint = selectedEntry?.let { rememberAppTint(it.app) }
    LaunchedEffect(tint) { vm.backgroundTint = tint }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val landscape = maxWidth > maxHeight
        val compact = maxHeight < 430.dp
        val tileSize = if (compact) 62.dp else 78.dp
        val selectedSize = if (compact) 86.dp else 108.dp
        val sidePadding = if (landscape) 40.dp else 20.dp

        HeroArt(selectedEntry, landscape)

        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .verticalScroll(scroll)
                .padding(vertical = 10.dp)
        ) {
            HomeTopBar(vm, settings, Modifier.padding(horizontal = sidePadding))
            Spacer(Modifier.height(if (compact) 8.dp else 16.dp))

            LazyRow(
                state = listState,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top,
                contentPadding = PaddingValues(start = sidePadding, end = 160.dp),
                modifier = Modifier.fillMaxWidth().height(selectedSize + 8.dp),
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

            Spacer(Modifier.height(if (compact) 10.dp else 22.dp))

            Crossfade(
                targetState = selected,
                animationSpec = tween(250),
                label = "hero",
                modifier = Modifier.padding(horizontal = sidePadding),
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

            Spacer(Modifier.height(if (compact) 14.dp else 22.dp))

            InfoCards(
                tile = selected,
                gameCount = games.size,
                mediaCount = media.size,
                totalApps = totalApps,
                sidePadding = sidePadding,
                onPickCover = { entry ->
                    coverTarget = entry
                    coverPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                },
                onAppInfo = { vm.openAppInfo(it) },
                onLibrary = { vm.navigate(Screen.LIBRARY) },
                onStore = { vm.openStore() },
            )

            if (!vm.isDefaultLauncher) {
                Spacer(Modifier.height(18.dp))
                DefaultLauncherBanner(onRequestDefault, Modifier.padding(horizontal = sidePadding))
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

// ------------------------------------------------------------
// Barra superior
// ------------------------------------------------------------

@Composable
private fun HomeTopBar(vm: LauncherViewModel, settings: LauncherSettings, modifier: Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        TabLabel("Jogos", vm.homeTab == HomeTab.GAMES) { vm.setTab(HomeTab.GAMES) }
        Spacer(Modifier.width(26.dp))
        TabLabel("Mídia", vm.homeTab == HomeTab.MEDIA) { vm.setTab(HomeTab.MEDIA) }
        Spacer(Modifier.weight(1f))
        PsIconButton(Icons.Filled.Search, "Buscar", { vm.navigate(Screen.LIBRARY) }, size = 38.dp, plain = true)
        Spacer(Modifier.width(4.dp))
        PsIconButton(Icons.Filled.Tune, "Central de controle", { vm.openControlCenter() }, size = 38.dp, plain = true)
        Spacer(Modifier.width(4.dp))
        PsIconButton(Icons.Filled.Settings, "Configurações", { vm.navigate(Screen.SETTINGS) }, size = 38.dp, plain = true)
        Spacer(Modifier.width(10.dp))
        val interaction = remember { MutableInteractionSource() }
        Box(
            Modifier
                .focusHighlight(interaction, CircleShape, 1.1f)
                .clip(CircleShape)
                .clickableCompat(interaction, onClick = { vm.navigate(Screen.PROFILE) })
        ) {
            Avatar(settings.avatarPath, settings.userName, 32.dp)
        }
        Spacer(Modifier.width(18.dp))
        StatusCluster()
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
            .padding(horizontal = 4.dp, vertical = 4.dp),
    ) {
        Text(
            text,
            color = if (active) TextPrimary else TextSecondary.copy(alpha = 0.55f),
            fontSize = 19.sp,
            fontWeight = if (active) FontWeight.Medium else FontWeight.Light,
        )
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
    val size by animateDpAsState(if (selected) selectedSize else normalSize, tween(220), label = "tileSize")
    val outer = RoundedCornerShape(18.dp)
    val inner = RoundedCornerShape(14.dp)
    val interaction = remember { MutableInteractionSource() }
    val label = when (tile) {
        is AppTile -> tile.entry.label
        StoreTile -> "Loja"
        LibraryTileItem -> "Biblioteca de jogos"
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier
                .size(size)
                .onFocusChanged { if (it.isFocused) onFocused() }
                // Contorno branco com uma pequena folga, como o cartão selecionado do console.
                .then(if (selected) Modifier.border(2.dp, Color.White, outer).padding(4.dp) else Modifier)
                .clip(inner)
                .alpha(if (selected) 1f else 0.88f)
                .clickableCompat(interaction, onClick, onLongClick)
        ) {
            when (tile) {
                is AppTile -> TileArt(tile.entry, Modifier.fillMaxSize())
                StoreTile -> Box(
                    Modifier.fillMaxSize().background(
                        Brush.linearGradient(listOf(Color(0xFF2D7BFF), Color(0xFF0B3EA8)))
                    ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.ShoppingBag, contentDescription = "Loja", tint = Color.White, modifier = Modifier.fillMaxSize(0.45f))
                }
                LibraryTileItem -> Box(
                    Modifier.fillMaxSize().background(Color(0xFF1A2340)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.Apps, contentDescription = "Biblioteca", tint = Color.White, modifier = Modifier.fillMaxSize(0.45f))
                }
            }
        }
        AnimatedVisibility(visible = selected) {
            Text(
                label,
                color = TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(start = 16.dp, end = 8.dp).widthIn(max = 240.dp),
            )
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
// Arte de fundo
// ------------------------------------------------------------

@Composable
private fun HeroArt(entry: AppEntry?, landscape: Boolean) {
    Crossfade(targetState = entry, animationSpec = tween(450), label = "heroArt") { current ->
        if (current != null) HeroArtContent(current, landscape)
    }
}

@Composable
private fun HeroArtContent(entry: AppEntry, landscape: Boolean) {
    val cover = rememberStoredImage(entry.coverPath, 1280)
    Box(Modifier.fillMaxSize()) {
        if (cover != null) {
            // Capa ocupando a tela toda, como a arte do jogo no console.
            Image(
                cover,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().alpha(0.9f),
            )
            Box(
                Modifier.fillMaxSize().background(
                    Brush.horizontalGradient(
                        0f to PsNavy.copy(alpha = 0.92f),
                        0.45f to PsNavy.copy(alpha = 0.55f),
                        1f to Color.Transparent,
                    )
                )
            )
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(
                        0f to Color.Black.copy(alpha = 0.55f),
                        0.3f to Color.Transparent,
                        1f to PsNavy.copy(alpha = 0.9f),
                    )
                )
            )
        } else {
            // Sem capa: o ícone do jogo, grande e desfocado, vira a "arte" de fundo.
            val icon = rememberAppIcon(entry.app, AppRepository.HERO_ICON_DP)
            if (icon != null) {
                Image(
                    icon,
                    contentDescription = null,
                    modifier = Modifier
                        .align(if (landscape) Alignment.CenterEnd else Alignment.BottomEnd)
                        .padding(end = 40.dp, bottom = if (landscape) 0.dp else 120.dp)
                        .fillMaxHeight(if (landscape) 0.75f else 0.3f)
                        .aspectRatio(1f)
                        .blur(22.dp)
                        .alpha(0.32f),
                )
            }
        }
    }
}

// ------------------------------------------------------------
// Título, botão Jogar e cartões de informação
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
    val titleSize = if (compact) 30.sp else 40.sp
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when (tile) {
            is AppTile -> {
                val entry = tile.entry
                Text(
                    entry.label,
                    color = TextPrimary,
                    fontSize = titleSize,
                    fontWeight = FontWeight.Light,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    PsButton(
                        text = if (entry.isGame) "Jogar" else "Abrir",
                        onClick = { onPlay(entry) },
                        modifier = Modifier.widthIn(min = 180.dp),
                    )
                    PsIconButton(Icons.Filled.MoreHoriz, "Opções", { onOptions(entry) }, size = 46.dp)
                }
            }
            StoreTile -> {
                Text("Loja", color = TextPrimary, fontSize = titleSize, fontWeight = FontWeight.Light)
                Text("Encontre novos jogos e apps na Google Play.", color = TextSecondary, fontSize = 14.sp)
                Spacer(Modifier.height(4.dp))
                PsButton("Abrir loja", onStore, modifier = Modifier.widthIn(min = 180.dp))
            }
            LibraryTileItem -> {
                Text("Biblioteca de jogos", color = TextPrimary, fontSize = titleSize, fontWeight = FontWeight.Light)
                val subtitle = when {
                    !appsLoaded -> "Carregando seus jogos…"
                    itemsEmpty && tab == HomeTab.GAMES ->
                        "Nenhum jogo encontrado. Na biblioteca, toque e segure um app e escolha \"Marcar como jogo\"."
                    itemsEmpty -> "Nenhum app de mídia. Adicione pela biblioteca."
                    else -> "$gameCount jogos · $totalApps apps instalados"
                }
                Text(subtitle, color = TextSecondary, fontSize = 14.sp)
                Spacer(Modifier.height(4.dp))
                PsButton("Abrir", onLibrary, modifier = Modifier.widthIn(min = 180.dp))
            }
        }
    }
}

@Composable
private fun InfoCards(
    tile: HomeTileItem,
    gameCount: Int,
    mediaCount: Int,
    totalApps: Int,
    sidePadding: Dp,
    onPickCover: (AppEntry) -> Unit,
    onAppInfo: (AppEntry) -> Unit,
    onLibrary: () -> Unit,
    onStore: () -> Unit,
) {
    val now = LocalNow.current
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = sidePadding),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        when (tile) {
            is AppTile -> {
                val entry = tile.entry
                val usage = entry.usage
                val count = usage?.count ?: 0
                InfoCard(
                    Icons.Filled.SportsEsports, "Sua atividade",
                    when (count) {
                        0 -> "Ainda não aberto"
                        1 -> "Aberto 1 vez"
                        else -> "Aberto $count vezes"
                    },
                )
                InfoCard(
                    Icons.Filled.History, "Última sessão",
                    if (usage != null) {
                        DateUtils.getRelativeTimeSpanString(usage.lastLaunched, now, DateUtils.MINUTE_IN_MILLIS).toString()
                    } else {
                        "Nunca"
                    },
                )
                InfoCard(
                    Icons.Filled.Image, "Capa",
                    if (entry.coverPath != null) "Trocar a capa" else "Escolher da galeria",
                    onClick = { onPickCover(entry) },
                )
                InfoCard(Icons.Filled.Info, "Informações", "Detalhes no Android", onClick = { onAppInfo(entry) })
            }
            StoreTile -> {
                InfoCard(Icons.Filled.ShoppingBag, "Google Play", "Jogos em destaque", onClick = onStore)
                InfoCard(Icons.Filled.SportsEsports, "Dica", "Jogos instalados aparecem sozinhos aqui")
            }
            LibraryTileItem -> {
                InfoCard(Icons.Filled.SportsEsports, "Jogos", "$gameCount instalados", onClick = onLibrary)
                InfoCard(Icons.Filled.Movie, "Mídia", "$mediaCount apps", onClick = onLibrary)
                InfoCard(Icons.Filled.Apps, "Todos os apps", "$totalApps no celular", onClick = onLibrary)
            }
        }
    }
}

@Composable
private fun InfoCard(icon: ImageVector, title: String, value: String, onClick: (() -> Unit)? = null) {
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(16.dp)
    Column(
        Modifier
            .width(200.dp)
            .height(86.dp)
            .focusHighlight(interaction, shape, 1.04f)
            .clip(shape)
            .background(Color.Black.copy(alpha = 0.35f))
            .border(1.dp, GlassStroke, shape)
            .then(if (onClick != null) Modifier.clickableCompat(interaction, onClick) else Modifier)
            .padding(14.dp),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(title, color = TextSecondary, fontSize = 12.sp)
        }
        Text(value, color = TextPrimary, fontSize = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 18.sp)
    }
}

@Composable
private fun DefaultLauncherBanner(onRequestDefault: () -> Unit, modifier: Modifier) {
    GlassPanel(modifier.fillMaxWidth()) {
        Row(
            Modifier.padding(horizontal = 18.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Use como tela inicial", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                Text(
                    "Defina o PS5 Launcher como tela inicial padrão do Android.",
                    color = TextSecondary, fontSize = 13.sp,
                )
            }
            Spacer(Modifier.width(12.dp))
            PsButton("Definir", onRequestDefault, primary = false)
        }
    }
}
