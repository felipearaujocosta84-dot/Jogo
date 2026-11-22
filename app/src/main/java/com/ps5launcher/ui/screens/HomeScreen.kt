package com.ps5launcher.ui.screens

import android.text.format.DateUtils
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import com.ps5launcher.ui.theme.GlassFill
import com.ps5launcher.ui.theme.GlassStroke
import com.ps5launcher.ui.theme.LocalAccent
import com.ps5launcher.ui.theme.PsNavy
import com.ps5launcher.ui.theme.TextPrimary
import com.ps5launcher.ui.theme.TextSecondary

/**
 * Tela inicial no estilo do console:
 * abas Jogos/Mídia no topo, fileira de cartões e, abaixo, o destaque do item selecionado
 * com o botão "Jogar". A arte de fundo muda conforme o jogo selecionado.
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
    val tileCount = items.size + 1 // +1 = cartão da Biblioteca no final
    val selection = vm.homeSelection.coerceIn(0, tileCount - 1)
    val selectedEntry = items.getOrNull(selection)
    val listState = rememberLazyListState()
    val firstTileFocus = remember { FocusRequester() }

    // Ao voltar para a tela inicial: rola para o começo e coloca o foco no primeiro cartão
    // (necessário para navegar com controle Bluetooth).
    LaunchedEffect(vm.homeResetSignal, vm.homeTab) {
        listState.scrollToItem(0)
    }
    LaunchedEffect(vm.homeResetSignal, vm.resumeTick, vm.homeTab, items.isEmpty()) {
        runCatching { firstTileFocus.requestFocus() }
    }
    // Mantém o cartão selecionado visível quando você toca num cartão parcialmente escondido.
    LaunchedEffect(selection) {
        val info = listState.layoutInfo
        val item = info.visibleItemsInfo.firstOrNull { it.index == selection }
        if (item == null || item.offset < 0 || item.offset + item.size > info.viewportEndOffset) {
            listState.animateScrollToItem(selection)
        }
    }

    val tint = selectedEntry?.let { rememberAppTint(it.app) }
    LaunchedEffect(tint) { vm.backgroundTint = tint }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val landscape = maxWidth > maxHeight
        val tileSize = if (landscape) 84.dp else 74.dp
        val selectedSize = if (landscape) 116.dp else 100.dp

        HeroArt(selectedEntry, landscape)

        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(horizontal = 24.dp, vertical = 12.dp)
        ) {
            HomeTopBar(vm, settings, landscape)
            Spacer(Modifier.height(if (landscape) 18.dp else 28.dp))

            LazyRow(
                state = listState,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.Top,
                contentPadding = PaddingValues(end = 64.dp),
                modifier = Modifier.fillMaxWidth().height(selectedSize + 8.dp),
            ) {
                itemsIndexed(items, key = { _, e -> e.key }) { index, entry ->
                    HomeTile(
                        entry = entry,
                        selected = index == selection,
                        normalSize = tileSize,
                        selectedSize = selectedSize,
                        modifier = if (index == 0) Modifier.focusRequester(firstTileFocus) else Modifier,
                        onFocused = { vm.selectHome(index) },
                        onClick = { if (index == selection) vm.launch(entry) else vm.selectHome(index) },
                        onLongClick = { vm.showOptions(entry) },
                    )
                }
                item(key = "library") {
                    val libIndex = items.size
                    LibraryTile(
                        selected = selection == libIndex,
                        normalSize = tileSize,
                        selectedSize = selectedSize,
                        modifier = if (items.isEmpty()) Modifier.focusRequester(firstTileFocus) else Modifier,
                        onFocused = { vm.selectHome(libIndex) },
                        onClick = {
                            if (selection == libIndex) vm.navigate(Screen.LIBRARY) else vm.selectHome(libIndex)
                        },
                    )
                }
            }

            Spacer(Modifier.height(if (landscape) 20.dp else 32.dp))

            Crossfade(targetState = selectedEntry, animationSpec = tween(250), label = "hero") { entry ->
                HeroInfo(
                    entry = entry,
                    tab = vm.homeTab,
                    itemsEmpty = items.isEmpty(),
                    appsLoaded = appsLoaded,
                    gameCount = games.size,
                    totalApps = totalApps,
                    onPlay = { e -> vm.launch(e) },
                    onOptions = { e -> vm.showOptions(e) },
                    onLibrary = { vm.navigate(Screen.LIBRARY) },
                )
            }

            Spacer(Modifier.weight(1f))

            if (!vm.isDefaultLauncher) {
                DefaultLauncherBanner(onRequestDefault)
            }
        }
    }
}

@Composable
private fun HomeTopBar(vm: LauncherViewModel, settings: LauncherSettings, landscape: Boolean) {
    Column {
        if (!landscape) {
            Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), horizontalArrangement = Arrangement.End) {
                StatusCluster()
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            TabLabel("Jogos", vm.homeTab == HomeTab.GAMES) { vm.setTab(HomeTab.GAMES) }
            Spacer(Modifier.width(22.dp))
            TabLabel("Mídia", vm.homeTab == HomeTab.MEDIA) { vm.setTab(HomeTab.MEDIA) }
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                PsIconButton(Icons.Filled.Search, "Buscar", { vm.navigate(Screen.LIBRARY) }, size = 40.dp)
                PsIconButton(Icons.Filled.Tune, "Central de controle", { vm.openControlCenter() }, size = 40.dp)
                PsIconButton(Icons.Filled.Settings, "Configurações", { vm.navigate(Screen.SETTINGS) }, size = 40.dp)
                val interaction = remember { MutableInteractionSource() }
                Box(
                    Modifier
                        .focusHighlight(interaction, CircleShape, 1.1f)
                        .clip(CircleShape)
                        .combinedClickableCompat(interaction, onClick = { vm.navigate(Screen.PROFILE) })
                ) {
                    Avatar(settings.avatarPath, settings.userName, 40.dp)
                }
            }
            if (landscape) {
                Spacer(Modifier.width(18.dp))
                StatusCluster()
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Modifier.combinedClickableCompat(
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
    Column(
        Modifier
            .focusHighlight(interaction, RoundedCornerShape(8.dp), 1.05f)
            .clip(RoundedCornerShape(8.dp))
            .combinedClickableCompat(interaction, onClick)
            .padding(horizontal = 6.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text,
            color = if (active) TextPrimary else TextSecondary.copy(alpha = 0.7f),
            fontSize = if (active) 22.sp else 19.sp,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
        )
        Spacer(Modifier.height(4.dp))
        Box(
            Modifier
                .width(if (active) 28.dp else 0.dp)
                .height(3.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Color.White)
        )
    }
}

@Composable
private fun HomeTile(
    entry: AppEntry,
    selected: Boolean,
    normalSize: Dp,
    selectedSize: Dp,
    modifier: Modifier,
    onFocused: () -> Unit,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    val size by animateDpAsState(if (selected) selectedSize else normalSize, label = "tileSize")
    val shape = RoundedCornerShape(16.dp)
    val interaction = remember { MutableInteractionSource() }
    Row(verticalAlignment = Alignment.Bottom) {
        Box(
            modifier
                .size(size)
                .onFocusChanged { if (it.isFocused) onFocused() }
                .clip(shape)
                .border(if (selected) 2.5.dp else 1.dp, if (selected) Color.White else GlassStroke, shape)
                .combinedClickableCompat(interaction, onClick, onLongClick)
        ) {
            TileArt(entry, Modifier.fillMaxSize())
        }
        AnimatedVisibility(visible = selected) {
            Text(
                entry.label,
                color = TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(start = 14.dp, bottom = 6.dp).widthIn(max = 220.dp),
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

@Composable
private fun LibraryTile(
    selected: Boolean,
    normalSize: Dp,
    selectedSize: Dp,
    modifier: Modifier,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    val size by animateDpAsState(if (selected) selectedSize else normalSize, label = "libSize")
    val shape = RoundedCornerShape(16.dp)
    val interaction = remember { MutableInteractionSource() }
    Row(verticalAlignment = Alignment.Bottom) {
        Box(
            modifier
                .size(size)
                .onFocusChanged { if (it.isFocused) onFocused() }
                .clip(shape)
                .background(GlassFill)
                .border(if (selected) 2.5.dp else 1.dp, if (selected) Color.White else GlassStroke, shape)
                .combinedClickableCompat(interaction, onClick),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Apps, contentDescription = "Biblioteca", tint = TextPrimary, modifier = Modifier.size(size * 0.42f))
        }
        AnimatedVisibility(visible = selected) {
            Text(
                "Biblioteca",
                color = TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(start = 14.dp, bottom = 6.dp),
            )
        }
    }
}

/** Arte grande no fundo, do lado direito, como no dashboard do console. */
@Composable
private fun HeroArt(entry: AppEntry?, landscape: Boolean) {
    Crossfade(targetState = entry, animationSpec = tween(400), label = "heroArt") { current ->
        if (current != null) HeroArtContent(current, landscape)
    }
}

@Composable
private fun HeroArtContent(entry: AppEntry, landscape: Boolean) {
    val cover = rememberStoredImage(entry.coverPath, 1280)
    Box(Modifier.fillMaxSize()) {
        if (cover != null) {
            Image(
                cover,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().alpha(0.55f),
            )
            // Degradês para misturar a capa com o fundo e deixar o texto legível
            Box(
                Modifier.fillMaxSize().background(
                    Brush.horizontalGradient(listOf(PsNavy.copy(alpha = 0.92f), PsNavy.copy(alpha = 0.35f), Color.Transparent))
                )
            )
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(listOf(PsNavy.copy(alpha = 0.6f), Color.Transparent, PsNavy.copy(alpha = 0.85f)))
                )
            )
        } else {
            val icon = rememberAppIcon(entry.app, AppRepository.HERO_ICON_DP)
            if (icon != null) {
                Image(
                    icon,
                    contentDescription = null,
                    modifier = Modifier
                        .align(if (landscape) Alignment.CenterEnd else Alignment.BottomEnd)
                        .padding(end = 24.dp, bottom = if (landscape) 0.dp else 120.dp)
                        .fillMaxHeight(if (landscape) 0.62f else 0.3f)
                        .aspectRatio(1f)
                        .blur(18.dp)
                        .alpha(0.28f),
                )
            }
        }
    }
}

@Composable
private fun HeroInfo(
    entry: AppEntry?,
    tab: HomeTab,
    itemsEmpty: Boolean,
    appsLoaded: Boolean,
    gameCount: Int,
    totalApps: Int,
    onPlay: (AppEntry) -> Unit,
    onOptions: (AppEntry) -> Unit,
    onLibrary: () -> Unit,
) {
    val now = LocalNow.current
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        when {
            entry != null -> {
                Text(
                    entry.label,
                    color = TextPrimary,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                val usage = entry.usage
                val subtitle = if (usage != null) {
                    val ago = DateUtils.getRelativeTimeSpanString(usage.lastLaunched, now, DateUtils.MINUTE_IN_MILLIS)
                    val times = if (usage.count == 1) "1 vez" else "${usage.count} vezes"
                    "Aberto $times · Última vez $ago"
                } else if (entry.isGame) {
                    "Pronto para jogar"
                } else {
                    "Toque em Abrir para começar"
                }
                Text(subtitle, color = TextSecondary, fontSize = 15.sp)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    PsButton(
                        text = if (entry.isGame) "Jogar" else "Abrir",
                        icon = Icons.Filled.PlayArrow,
                        onClick = { onPlay(entry) },
                    )
                    PsIconButton(Icons.Filled.MoreHoriz, "Opções", { onOptions(entry) }, size = 48.dp)
                }
            }
            itemsEmpty && tab == HomeTab.GAMES -> {
                Text(
                    if (appsLoaded) "Nenhum jogo encontrado" else "Carregando seus jogos…",
                    color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold,
                )
                if (appsLoaded) {
                    Text(
                        "Na Biblioteca, toque e segure um app e escolha \"Marcar como jogo\".",
                        color = TextSecondary, fontSize = 15.sp,
                    )
                }
                Spacer(Modifier.height(6.dp))
                PsButton("Abrir biblioteca", onLibrary, icon = Icons.Filled.Apps)
            }
            itemsEmpty -> {
                Text("Nenhum app de mídia", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Text(
                    "Apps de vídeo e música aparecem aqui. Você também pode adicioná-los pela Biblioteca.",
                    color = TextSecondary, fontSize = 15.sp,
                )
                Spacer(Modifier.height(6.dp))
                PsButton("Abrir biblioteca", onLibrary, icon = Icons.Filled.Apps)
            }
            else -> {
                Text("Biblioteca", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                Text("$gameCount jogos · $totalApps apps instalados", color = TextSecondary, fontSize = 15.sp)
                Spacer(Modifier.height(6.dp))
                PsButton("Abrir", onLibrary, icon = Icons.Filled.Apps)
            }
        }
    }
}

@Composable
private fun DefaultLauncherBanner(onRequestDefault: () -> Unit) {
    GlassPanel(Modifier.fillMaxWidth()) {
        Row(
            Modifier.padding(horizontal = 18.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Use como tela inicial", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
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
