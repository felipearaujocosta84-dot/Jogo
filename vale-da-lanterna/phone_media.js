/* Vale da Lanterna — apps de mídia do celular: VilaGram (rede social com perfis, posts dos moradores a partir do que
   acontece no jogo, curtidas, comentários, seguir), Lanterna Vídeos (vídeos curtos animados com o próprio jogo, curtir,
   comentar, compartilhar, próximo/anterior, deslizar), Câmera (foto e vídeo da cena, zoom e enquadramento) e Galeria.
   Fotos e vídeos ficam em chaves próprias do localStorage, com limite de tamanho. */
'use strict';

// ---------------------------------------------------------------- armazenamento de fotos e vídeos
const PHOTO_KEY = 'vale-da-lanterna-fotos', VIDEO_KEY = 'vale-da-lanterna-videos', MAX_PHOTOS = 30, MAX_VIDEOS = 5;
let photoList = null, videoList = null;
const photoCache = new Map();
function photos() { if (!photoList) photoList = load(PHOTO_KEY) || []; return photoList; }
function videos() { if (!videoList) videoList = load(VIDEO_KEY) || []; return videoList; }
function storeMedia(key, list, max) {
  while (list.length > max) list.pop();
  for (let i = 0; i < 6; i++) { try { localStorage.setItem(key, JSON.stringify(list)); return true; } catch (e) { if (!list.length) break; list.pop(); } }
  toast('Sem espaço para guardar mais mídia.'); return false;
}
function photoImg(id) {
  if (photoCache.has(id)) return photoCache.get(id);
  const p = photos().find(q => q.id === id) || (videos().find(v => v.id === id) || {}).frames && { data: videos().find(v => v.id === id).frames[0] };
  if (!p) return null;
  const img = new Image(); img.src = p.data; photoCache.set(id, img);
  if (photoCache.size > 40) photoCache.delete(photoCache.keys().next().value);
  return img;
}
function frameImg(vid, i) { const k = vid.id + ':' + i; if (photoCache.has(k)) return photoCache.get(k); const img = new Image(); img.src = vid.frames[i]; photoCache.set(k, img); if (photoCache.size > 60) photoCache.delete(photoCache.keys().next().value); return img; }

// ---------------------------------------------------------------- VilaGram: dados
const GRAM_BIO = { 'Florista': 'Flores, sol e chá 🌸', 'Agricultor': 'Terra boa é terra cuidada.', 'Ferreiro': 'Ferro quente, coração quente 🔨', 'Padeira': 'Pão sai às 6h! 🥖', 'Pescadora': 'Vivendo no rio 🎣', 'Carpinteiro': 'Madeira e silêncio.',
  'Costureira': 'Sonhos em forma de vestido ✨', 'Guarda do vale': 'Protegendo o vale.', 'Cozinheira': 'Comida feita com amor 🍲', 'Lenhador': 'Corta, empilha, repete 🪓', 'Criança': 'Brincar é sério!', 'Comerciante': 'Compro, vendo e troco!',
  'Anciã do vale': 'Contadora de histórias do vale.', 'Professora': 'Educar é plantar 📚', 'Barqueiro': 'Rio calmo, peixe arisco.', 'Curandeira': 'Ervas e cuidados 🌿', 'Estudante': 'Escola de dia, futebol à tarde ⚽' };
const PROF_SCENE = { 'Florista': 'flores', 'Agricultor': 'horta', 'Ferreiro': 'forja', 'Padeira': 'pao', 'Pescadora': 'peixe', 'Barqueiro': 'peixe', 'Carpinteiro': 'madeira', 'Lenhador': 'madeira', 'Costureira': 'costura', 'Guarda do vale': 'praca',
  'Cozinheira': 'pao', 'Comerciante': 'loja', 'Anciã do vale': 'praca', 'Professora': 'escola', 'Curandeira': 'ervas', 'Estudante': 'selfie' };
const SCENE_TEXT = { flores: ['As flores-lume abriram hoje! 🌸', 'Jardim florido, coração feliz.'], horta: ['Olha essa horta! 🥬', 'Colheita boa esse ano.'], forja: ['Espada nova saindo! 🔨', 'Forja quente desde cedo.'], pao: ['Pão quentinho saindo! 🥖', 'Fornada do dia pronta.'],
  peixe: ['Olha o tamanho desse peixe! 🎣', 'Rio generoso hoje.'], madeira: ['Tábuas novinhas.', 'Dia de serra e serragem.'], costura: ['Vestido novo terminado ✨', 'Linha, agulha e paciência.'], praca: ['Fim de tarde na praça.', 'O vale está lindo hoje.'],
  loja: ['Chegou mercadoria nova!', 'Promoção no armazém hoje!'], escola: ['Aula de desenho hoje 🎨', 'Meus alunos são uns amores.'], ervas: ['Chá de flor-lume pronto 🌿', 'Colhendo ervas na mata.'], selfie: ['Mais um dia no vale 😎', 'Partiu treino!'],
  casa: ['Minha casinha hoje ☀', 'Lar, doce lar.'], chuva: ['Que chuva! ☔', 'Dia de ficar em casa.'], viagem: ['Conhecendo a cidade de ', 'Viagem rápida para '] };
function gramPost(by, text, scene, data, opt) {
  const P = phS();
  const post = Object.assign({ id: 'g' + Date.now() + Math.floor(Math.random() * 999), by, at: nowMin(), text, img: scene ? { k: 'scene', s: scene, d: data || null } : null, likes: [], liked: false, comments: [] }, opt || {});
  P.posts.unshift(post); if (P.posts.length > 150) P.posts.length = 150;
  // curtidas dos moradores ao longo do tempo
  const fans = RESIDENTS.filter(r => hasPhone(r.id) && r.id !== by && (hashStr(r.id + post.id) & 3) === 0).slice(0, 6);
  for (const r of fans) P.gq = (P.gq || []).concat([{ post: post.id, by: r.id, kind: 'like', wait: 4 + Math.random() * 40 }]);
  if (by !== 'kai' && P.follows.includes(by)) notify('social', 'VilaGram', RES_BY_ID[by].name + ' publicou: ' + text.slice(0, 40), { app: 'gpost', post: post.id });
  return post;
}
// reações dos moradores aos posts do Kai
function gramReactKai(post) {
  const P = phS();
  const pool = RESIDENTS.filter(r => hasPhone(r.id) && (P.followers.includes(r.id) || sm(r.id).friend >= 100));
  for (const r of pool) {
    const f = sm(r.id).friend;
    if (Math.random() < 0.45 + f / 1600) (P.gq = P.gq || []).push({ post: post.id, by: r.id, kind: 'like', wait: 3 + Math.random() * 25 });
    if (Math.random() < 0.18 + f / 3000) {
      const t = post.img && post.img.k === 'photo' ? ['Que foto linda! 😍', 'Uau, que lugar!', 'Ficou ótima!'] : post.img && post.img.k === 'vid' ? ['Hahaha amei!', 'Que vídeo legal!'] : ['Concordo!', 'Haha, verdade!', 'Que legal, Kai!'];
      P.gq.push({ post: post.id, by: r.id, kind: 'comment', text: (partnerOf(r.id) ? '❤ ' : '') + t[Math.floor(Math.random() * t.length)], wait: 6 + Math.random() * 40 });
    }
  }
}
const gramUnread = () => phS().gramNew || 0;
function gramNewDay() {
  const P = phS();
  // moradores postam sobre o próprio dia (de acordo com a profissão, a casa, o tempo)
  const pool = RESIDENTS.filter(r => hasPhone(r.id));
  const n = 2 + (S.time.day % 2);
  for (let i = 0; i < n; i++) {
    const r = pool[(hashStr('post' + S.time.day + i) >>> 0) % pool.length]; if (!r) continue;
    let s = PROF_SCENE[r.prof] || 'selfie', d = null;
    const roll = (hashStr(r.id + S.time.day) >>> 0) % 10;
    if (roll < 2) s = 'casa';
    if (valeRaining() && roll === 5) s = 'chuva';
    if ((r.id === 'iara' || r.id === 'gil') && roll === 7) { const ks = Object.values(S.cities || {}); d = ks.length ? ks[roll % ks.length] : ['Pedra Azul', 'Vento da Lua', 'Porto Novo'][S.time.day % 3]; s = 'viagem'; }
    const tx = SCENE_TEXT[s][(S.time.day + i) % SCENE_TEXT[s].length] + (s === 'viagem' ? d + '! ✈' : '');
    P.plan.push({ at: S.time.day * 1440 + (9 + i * 3 + (roll % 3)) * 60, chat: null, from: null, text: null, check: () => { gramPost(r.id, tx, s, d); return false; } });
  }
  // novos seguidores
  for (const r of pool) if (!P.followers.includes(r.id) && sm(r.id).friend >= 150) { P.followers.push(r.id); notify('social', 'VilaGram', r.name + ' começou a seguir você.', { app: 'gprofile', id: r.id }); }
}
// acontecimentos do jogo viram posts
function gramEvent(kind, data) {
  if (!S.phone) return;
  if (kind === 'futebol') {
    const ids = data.teams.a.concat(data.teams.b).filter(id => id !== 'kai' && hasPhone(id)).sort(() => Math.random() - 0.5).slice(0, 2);
    ids.forEach((id, i) => gramPost(id, i ? 'Que jogo hoje no campo! ⚽ ' + TEAM_NAMES[0] + ' ' + data.score[0] + ' × ' + data.score[1] + ' ' + TEAM_NAMES[1] : (data.kai && data.kai.goals ? 'O Kai fez gol hoje! 🔥 ' : 'Futebol de várzea é vida! ') + data.score.join(' × '), 'futebol', { score: data.score }));
    addVideoEvent('futebol', ids[0] || 'joca', 'Melhores momentos: ' + data.score.join(' × '));
  } else if (kind === 'festa') {
    const ids = RESIDENTS.filter(r => hasPhone(r.id) && r.area === 'world').sort(() => Math.random() - 0.5).slice(0, 2).map(r => r.id);
    ids.forEach(id => gramPost(id, data.name + ' na praça! 🎉', 'festa', { key: data.key }));
    if (ids[0]) addVideoEvent('danca', ids[0], 'Dançando na ' + data.name);
  } else if (kind === 'niver') gramPost(data.id, 'Obrigado(a) a todos pela festa! 🎂', 'niver', { who: data.id });
  else if (kind === 'kainiver') { for (const r of RESIDENTS.filter(q => hasPhone(q.id) && hearts(q.id) >= 3).slice(0, 2)) gramPost(r.id, 'Parabéns, Kai! 🎉🎂', 'niver', { who: 'kai' }); }
  else if (kind === 'casamento') { gramPost('aurora', 'Que casamento lindo! Kai e ' + RES_BY_ID[data.id].name + ' ❤', 'casamento', { a: 'kai', b: data.id }); if (hasPhone(data.id)) gramPost(data.id, 'O dia mais feliz da minha vida ❤', 'casamento', { a: 'kai', b: data.id }); }
  else if (kind === 'bebe') { if (S.romance && hasPhone(S.romance.id)) gramPost(S.romance.id, 'Bem-vindo(a) ao mundo, ' + data.name + '! 👶', 'bebe', { name: data.name }); }
  else if (kind === 'anonovo') { for (const r of RESIDENTS.filter(q => hasPhone(q.id)).slice(0, 2)) gramPost(r.id, 'Feliz ' + calOf().y + '! 🎆', 'fogos', null); }
}

// ---------------------------------------------------------------- cenas desenhadas (as "fotos" dos moradores)
function drawSprite(id, x, y, h) {
  const sp = id === 'kai' ? HERO.down[0] : id === 'floco' ? DOG[0] : NPC[id];
  if (!sp) return; ctx.imageSmoothingEnabled = false; const w = h * sp.w / sp.h; ctx.drawImage(sp.img, x - w / 2, y - h, w, h);
}
function drawScene(post, x, y, w, h) {
  const img = post.img; if (!img) return;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
  if (img.k === 'photo') { const im = photoImg(img.id); if (im && im.naturalWidth) ctx.drawImage(im, x, y, w, h); else { ctx.fillStyle = '#ccc'; ctx.fillRect(x, y, w, h); } ctx.restore(); return; }
  if (img.k === 'vid') { drawVideoThumb({ u: img.id }, x, y, w, h); ctx.restore(); return; }
  const s = img.s, d = img.d || {}, by = post.by;
  const sky = { chuva: ['#5a6a80', '#8a9ab0'], fogos: ['#0e1430', '#2a2a5a'], festa: ['#ffd7a0', '#ff9ec7'], futebol: ['#7ec8ff', '#bfe6ff'], niver: ['#ffd6e6', '#fff1c0'], casamento: ['#ffe0ec', '#fff6fa'], escola: ['#e8dcc0', '#f4ecd6'], forja: ['#3a2a2a', '#6a4a3a'], bebe: ['#dff0ff', '#fff'] }[s] || ['#9ad8ff', '#e0f6ff'];
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const gy = y + h * 0.72;
  if (!['escola', 'forja', 'bebe', 'niver'].includes(s)) { ctx.fillStyle = s === 'futebol' ? '#5aa646' : s === 'praca' || s === 'festa' ? '#b8a890' : '#6aaa4a'; ctx.fillRect(x, gy, w, h - (gy - y)); }
  const icon = (k, ix, iy, sz) => drawIcon(k, ix, iy, sz);
  switch (s) {
    case 'casa': { const r = RES_BY_ID[by], B = r && BUILDINGS.find(b => b.to === (r.home0 || r.home)); if (B && B.img) { const bh = h * 0.8, bw = bh * B.img.width / B.img.height; ctx.imageSmoothingEnabled = false; ctx.drawImage(B.img, x + w / 2 - bw / 2, gy + 6 - bh, bw, bh); } drawSprite(by, x + w * 0.82, gy + 10, h * 0.42); break; }
    case 'horta': for (let i = 0; i < 6; i++) icon(['couve', 'cenoura', 'tomate'][i % 3], x + w * (0.12 + i * 0.15), gy + 8, h * 0.18); drawSprite(by, x + w * 0.85, gy + 6, h * 0.5); break;
    case 'flores': ctx.fillStyle = '#3f8a37'; for (let i = 0; i < 9; i++) { const fx = x + w * (0.08 + i * 0.1); ctx.fillRect(fx - 1, gy - 10, 3, 14); ctx.fillStyle = FLOWER_COLS[i % 5]; ctx.beginPath(); ctx.arc(fx, gy - 12, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#3f8a37'; } drawSprite(by, x + w * 0.5, gy + 14, h * 0.5); break;
    case 'peixe': ctx.fillStyle = '#4a90e2'; ctx.fillRect(x, gy - 6, w, h); drawSprite(by, x + w * 0.35, gy + 4, h * 0.55); icon('carpa', x + w * 0.7, y + h * 0.45, h * 0.32); break;
    case 'forja': ctx.fillStyle = '#ff9a40'; ctx.beginPath(); ctx.arc(x + w * 0.25, gy - 10, h * 0.2, 0, 7); ctx.fill(); ctx.fillStyle = '#4f4c48'; ctx.fillRect(x + w * 0.5, gy - 16, w * 0.22, 16); drawSprite(by, x + w * 0.8, gy + 18, h * 0.55); icon('espada2', x + w * 0.6, y + h * 0.35, h * 0.3); break;
    case 'pao': for (let i = 0; i < 5; i++) icon(i % 2 ? 'pao' : 'torta', x + w * (0.12 + i * 0.13), gy - 6, h * 0.2); drawSprite(by, x + w * 0.84, gy + 10, h * 0.55); break;
    case 'madeira': for (let i = 0; i < 4; i++) icon('tabua', x + w * (0.15 + i * 0.12), gy - 4 - i * 6, h * 0.2); drawSprite(by, x + w * 0.78, gy + 10, h * 0.55); break;
    case 'costura': ctx.fillStyle = '#b59cff'; ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + h * 0.2); ctx.lineTo(x + w * 0.42, y + h * 0.2); ctx.lineTo(x + w * 0.5, gy); ctx.lineTo(x + w * 0.22, gy); ctx.fill(); drawSprite(by, x + w * 0.74, gy + 12, h * 0.55); break;
    case 'escola': ctx.fillStyle = '#2f4a3a'; ctx.fillRect(x + w * 0.1, y + h * 0.12, w * 0.55, h * 0.4); ptext('A B C 1 2 3', x + w * 0.37, y + h * 0.32, h * 0.1, '#e8eee4', 700, w * 0.5, 'center'); for (const k of ['lia', 'bento', 'nico']) drawSprite(k, x + w * (0.2 + ['lia', 'bento', 'nico'].indexOf(k) * 0.18), y + h * 0.98, h * 0.3); drawSprite(by, x + w * 0.82, y + h, h * 0.55); break;
    case 'ervas': for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#5fa65a' : '#7b9a4a'; ctx.beginPath(); ctx.ellipse(x + w * (0.1 + i * 0.12), gy - 6, 9, 14, 0, 0, 7); ctx.fill(); } drawSprite(by, x + w * 0.5, gy + 12, h * 0.55); break;
    case 'loja': for (let i = 0; i < 4; i++) icon(['ovo', 'leite', 'tabua', 'cristal'][i], x + w * (0.12 + i * 0.14), gy - 10, h * 0.2); drawSprite(by, x + w * 0.8, gy + 10, h * 0.55); break;
    case 'praca': ctx.fillStyle = '#9ad1ff'; ctx.beginPath(); ctx.ellipse(x + w * 0.5, gy, w * 0.18, h * 0.08, 0, 0, 7); ctx.fill(); drawSprite(by, x + w * 0.24, gy + 12, h * 0.5); drawSprite('teo', x + w * 0.78, gy + 10, h * 0.35); break;
    case 'selfie': drawSprite(by, x + w * 0.5, y + h * 1.1, h * 0.95); break;
    case 'chuva': ctx.strokeStyle = 'rgba(220,235,255,0.7)'; ctx.lineWidth = 1.5; for (let i = 0; i < 30; i++) { const rx = x + (i * 37) % w, ry = y + (i * 53) % h; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12); ctx.stroke(); } drawSprite(by, x + w * 0.5, gy + 12, h * 0.55); break;
    case 'viagem': { const B = BUILDINGS.filter(b => b.kind === 'house'); for (let i = 0; i < 3; i++) { const b = B[(i * 3 + 1) % B.length]; if (b && b.img) { const bh = h * 0.55, bw = bh * b.img.width / b.img.height; ctx.drawImage(b.img, x + w * (0.05 + i * 0.3), gy - bh + 8, bw, bh); } } drawSprite(by, x + w * 0.85, gy + 12, h * 0.5); ptext(d && d.city ? d.city : '', x + 8, y + 14, 11, '#2a2238', 700, w); break; }
    case 'futebol': ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x + w * 0.05, gy + 4, w * 0.9, h * 0.24); ctx.beginPath(); ctx.moveTo(x + w / 2, gy + 4); ctx.lineTo(x + w / 2, y + h); ctx.stroke(); drawSprite(by, x + w * 0.3, gy + 20, h * 0.5); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w * 0.45, gy + 14, 6, 0, 7); ctx.fill(); if (d.score) ptext(TEAM_NAMES[0] + ' ' + d.score[0] + ' × ' + d.score[1] + ' ' + TEAM_NAMES[1], x + w / 2, y + 16, 13, '#2a2238', 700, w, 'center'); break;
    case 'festa': case 'fogos': for (let i = 0; i < (s === 'fogos' ? 6 : 12); i++) { ctx.fillStyle = FLOWER_COLS[i % 5]; if (s === 'fogos') { for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; ctx.fillRect(x + w * (0.15 + i * 0.14) + Math.cos(a) * 16, y + h * 0.3 + Math.sin(a) * 16 + (i % 2) * 14, 3, 3); } } else { ctx.beginPath(); ctx.moveTo(x + i * w / 12, y + 10); ctx.lineTo(x + (i + 1) * w / 12, y + 10); ctx.lineTo(x + (i + 0.5) * w / 12, y + 24); ctx.fill(); } } drawSprite(by, x + w * 0.4, gy + 14, h * 0.5); drawSprite('mel', x + w * 0.65, gy + 12, h * 0.46); break;
    case 'niver': { const who = d.who || by; ctx.fillStyle = '#f4e8d8'; ctx.fillRect(x + w * 0.35, gy - 20, w * 0.3, 26); ctx.fillStyle = '#ff9ec7'; ctx.fillRect(x + w * 0.35, gy - 26, w * 0.3, 8); for (let i = 0; i < 3; i++) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + w * (0.42 + i * 0.07), gy - 38, 4, 10); } drawSprite(who, x + w * 0.18, gy + 22, h * 0.6); ptext('Feliz aniversário!', x + w / 2, y + 16, 13, '#c8423b', 700, w, 'center'); break; }
    case 'casamento': ctx.fillStyle = '#ff7aa6'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(x + w * (0.1 + i * 0.11), y + 18 + (i % 2) * 10, 5, 0, 7); ctx.fill(); } drawSprite(d.a || 'kai', x + w * 0.4, gy + 14, h * 0.55); drawSprite(d.b || by, x + w * 0.6, gy + 14, h * 0.55); break;
    case 'bebe': ctx.fillStyle = '#c99a6a'; ctx.fillRect(x + w * 0.35, gy - 20, w * 0.3, 30); ctx.fillStyle = '#9ad1ff'; ctx.fillRect(x + w * 0.37, gy - 16, w * 0.26, 18); ptext('👶 ' + (d.name || ''), x + w / 2, y + 18, 13, '#2a2238', 700, w, 'center'); drawSprite(by, x + w * 0.82, gy + 16, h * 0.55); break;
    default: drawSprite(by, x + w / 2, gy + 10, h * 0.6);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- VilaGram: telas
function profName(id) { return id === 'kai' ? 'Kai' : RES_BY_ID[id] ? RES_BY_ID[id].name : id; }
function profHandle(id) { return '@' + (id === 'kai' ? 'kai.do.vale' : id + '.vale'); }
function drawGram(x, y, w, h, st) {
  const P = phS(), tab = st.tab || 'feed';
  if (tab === 'feed') P.gramNew = 0;
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, 34);
  ptext('VilaGram', x + 14, y + 18, 18, '#e0507a', 700);
  [['feed', 'Início'], ['explore', 'Pessoas'], ['me', 'Meu perfil']].forEach(([k, t], i) => pbtn(t, x + w - 330 + i * 84, y + 6, 78, 22, () => { if (k === 'me') go('gprofile', { id: 'kai' }); else { st.tab = k; st.pg = 0; } }, tab === k ? 'on' : null, 11));
  pbtn('+ Postar', x + w - 76, y + 6, 70, 22, () => go('gnew', {}), 'red', 11);
  y += 38; h -= 38;
  if (tab === 'explore') {
    const ppl = RESIDENTS.filter(r => hasPhone(r.id));
    pageList(x, y, w, h, ppl, 44, (r, rx, ry, rw, rh) => {
      portrait(r.id, rx + 26, ry + rh / 2, 34); ptext(r.name, rx + 52, ry + 12, 13, '#2a2238', 700, rw * 0.4); ptext(profHandle(r.id) + ' · ' + (GRAM_BIO[r.prof] || ''), rx + 52, ry + 29, 10, '#6a6478', 500, rw * 0.45);
      const f = P.follows.includes(r.id);
      pbtn('Ver', rx + rw - 172, ry + 8, 56, 26, () => go('gprofile', { id: r.id }), null, 11);
      pbtn(f ? 'Seguindo' : 'Seguir', rx + rw - 110, ry + 8, 100, 26, () => toggleFollow(r.id), f ? null : 'on', 11);
    }, 'pg');
    return;
  }
  const feed = P.posts.filter(p => p.by === 'kai' || P.follows.includes(p.by));
  if (!feed.length) { ptext('Seu feed está vazio.', x + 16, y + 20, 13, '#2a2238', 700); ptext('Siga moradores em "Pessoas" para ver o que eles publicam.', x + 16, y + 40, 11, '#6a6478', 500, w - 32); return; }
  // dois posts por página (cards lado a lado)
  const per = 2, pages = Math.ceil(feed.length / per); st.pg = clamp(st.pg || 0, 0, pages - 1);
  const cw = (w - 30) / 2;
  feed.slice(st.pg * per, st.pg * per + per).forEach((p, i) => drawPostCard(p, x + 10 + i * (cw + 10), y + 2, cw, h - 34));
  ptext((st.pg + 1) + '/' + pages, x + w / 2, y + h - 14, 11, '#6a6478', 600, 60, 'center');
  pbtn('◀ Mais recentes', x + 10, y + h - 28, 130, 24, () => { st.pg--; }, st.pg > 0 ? null : 'off', 11);
  pbtn('Mais antigas ▶', x + w - 140, y + h - 28, 130, 24, () => { st.pg++; }, st.pg < pages - 1 ? null : 'off', 11);
}
function drawPostCard(p, x, y, w, h) {
  ctx.fillStyle = '#f6f4fa'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  portrait(p.by, x + 18, y + 18, 26);
  ptext(profName(p.by), x + 36, y + 13, 12, '#2a2238', 700, w * 0.5); ptext(timeLabel(p.at), x + 36, y + 26, 9, '#8a8496', 500);
  addBtn(x, y, w * 0.6, 32, () => go('gprofile', { id: p.by }));
  const ih = Math.min(h - 96, w * 0.62);
  if (p.img) { drawScene(p, x + 8, y + 36, w - 16, ih); addBtn(x + 8, y + 36, w - 16, ih, () => go('gpost', { post: p.id })); }
  let yy = y + 40 + (p.img ? ih : 0);
  ctx.font = `600 11px ${FONT}`;
  wrapLines(p.text, w - 20).slice(0, 2).forEach((l, i) => ptext(l, x + 10, yy + 8 + i * 13, 11, '#2a2238', 600, w - 20));
  const by = y + h - 28;
  pbtn((p.liked ? '❤ ' : '♡ ') + (p.likes.length + (p.liked ? 1 : 0)), x + 8, by, 70, 22, () => likePost(p), p.liked ? 'red' : null, 11);
  pbtn('💬 ' + p.comments.length, x + 84, by, 64, 22, () => go('gpost', { post: p.id }), null, 11);
  pbtn('↗', x + 154, by, 36, 22, () => go('pick', { purpose: 'share', text: 'Olha esse post de ' + profName(p.by) + ': "' + p.text.slice(0, 40) + '"', extra: p.img && p.img.k === 'photo' ? { photo: p.img.id } : null }), null, 11);
}
function likePost(p) {
  p.liked = !p.liked;
  if (p.liked && p.by !== 'kai' && !p.kaiLikedOnce) { p.kaiLikedOnce = true; addFriend(p.by, 1); }
  Audio.sfx('pick'); save();
}
function toggleFollow(id) {
  const P = phS(), i = P.follows.indexOf(id);
  if (i >= 0) P.follows.splice(i, 1); else { P.follows.push(id); if (!sm(id).followedOnce) { sm(id).followedOnce = true; addFriend(id, 2); } if (sm(id).friend >= 80 && !P.followers.includes(id)) { P.followers.push(id); notify('social', 'VilaGram', RES_BY_ID[id].name + ' seguiu você de volta.', { app: 'gprofile', id }); } }
  save();
}
function drawGPost(x, y, w, h, st) {
  const P = phS(), p = P.posts.find(q => q.id === st.post);
  if (!p) { ptext('Publicação não encontrada.', x + 16, y + 20, 12, '#6a6478'); return; }
  y = appHeader(x, y, w, profName(p.by) + ' · ' + timeLabel(p.at)); h -= 38;
  const iw = w * 0.5, ih = Math.min(h - 96, iw * 0.66);
  drawScene(p, x + 10, y + 2, iw, ih);
  ctx.font = `600 12px ${FONT}`; wrapLines(p.text, iw).slice(0, 2).forEach((l, i) => ptext(l, x + 12, y + ih + 16 + i * 14, 12, '#2a2238', 600, iw));
  pbtn((p.liked ? '❤ ' : '♡ ') + (p.likes.length + (p.liked ? 1 : 0)) + ' curtidas', x + 10, y + h - 30, 130, 26, () => likePost(p), p.liked ? 'red' : null, 11);
  const lk = p.likes.slice(-3).map(profName).join(', ');
  if (lk) ptext('Curtido por ' + lk, x + 148, y + h - 17, 10, '#6a6478', 500, iw - 140);
  // comentários
  const cx = x + iw + 22, cw = w - iw - 32;
  ptext('Comentários (' + p.comments.length + ')', cx, y + 10, 13, '#7b5aa6', 700);
  pageList(cx, y + 20, cw, h - 84, p.comments.slice().reverse(), 36, (c, rx, ry, rw) => {
    portrait(c.by, rx + 12, ry + 14, 22); ptext(profName(c.by), rx + 28, ry + 7, 11, '#2a2238', 700, rw - 40); ptext(c.t, rx + 28, ry + 21, 11, '#4a4458', 500, rw - 40);
  }, 'pg');
  const qs = p.by === 'kai' ? ['Obrigado, gente!', 'Valeu! ❤'] : ['Que lindo! 😍', 'Hahaha!', 'Parabéns!'];
  qs.forEach((q, i) => pbtn(q, cx + i * (cw / qs.length), y + h - 62, cw / qs.length - 6, 24, () => commentPost(p, q), null, 10));
  addBtn(cx, y + h - 32, cw, 26, () => phoneAsk('Seu comentário…', v => commentPost(p, v), [cx, y + h - 34, cw, 30]));
  ctx.fillStyle = 'rgba(123,90,166,0.2)'; ctx.beginPath(); ctx.roundRect(cx, y + h - 32, cw, 26, 13); ctx.fill(); ptext('✎ Escrever comentário…', cx + 12, y + h - 19, 11, '#4a4458', 600);
}
function commentPost(p, t) {
  const P = phS();
  p.comments.push({ by: 'kai', t, at: nowMin() });
  if (p.by !== 'kai') {
    const m = sm(p.by); if (m.gramDay !== S.time.day) { m.gramDay = S.time.day; addFriend(p.by, 3); }
    if (Math.random() < 0.6) (P.gq = P.gq || []).push({ post: p.id, by: p.by, kind: 'comment', text: ['Obrigado(a), Kai! 😊', 'Hehe, valeu!', '❤'][Math.floor(Math.random() * 3)], wait: 3 + Math.random() * 8 });
  }
  save();
}
function drawGProfile(x, y, w, h, st) {
  const P = phS(), id = st.id, me = id === 'kai';
  const r = RES_BY_ID[id];
  y = appHeader(x, y, w, profHandle(id)); h -= 38;
  portrait(me ? P.profile.avatar : id, x + 50, y + 44, 70);
  ptext(profName(id), x + 96, y + 20, 16, '#2a2238', 700, w * 0.35);
  ptext(me ? P.profile.bio : (GRAM_BIO[r && r.prof] || ''), x + 96, y + 40, 11, '#4a4458', 500, w * 0.35);
  const posts = P.posts.filter(p => p.by === id);
  const followers = me ? P.followers.length : 12 + ((hashStr('fol' + id) >>> 0) % 60) + (P.follows.includes(id) ? 1 : 0), following = me ? P.follows.length : 8 + ((hashStr('fwg' + id) >>> 0) % 30);
  ptext(posts.length + ' posts · ' + followers + ' seguidores · ' + following + ' seguindo', x + 96, y + 60, 11, '#2a2238', 700, w * 0.4);
  if (me) {
    pbtn('Editar bio', x + 96, y + 74, 90, 24, () => phoneAsk('Sua bio…', v => { P.profile.bio = v; save(); }, [x + 96, y + 74, 260, 28], P.profile.bio), null, 11);
    pbtn('Foto: Kai', x + 192, y + 74, 80, 24, () => { P.profile.avatar = 'kai'; save(); }, P.profile.avatar === 'kai' ? 'on' : null, 10);
    pbtn('Floco', x + 278, y + 74, 56, 24, () => { P.profile.avatar = 'floco'; save(); }, P.profile.avatar === 'floco' ? 'on' : null, 10);
    pbtn('Da galeria', x + 340, y + 74, 80, 24, () => go('gallery', { avatar: true }), typeof P.profile.avatar === 'string' && P.profile.avatar.startsWith('p') ? 'on' : null, 10);
  } else if (r) {
    const f = P.follows.includes(id);
    pbtn(f ? 'Deixar de seguir' : 'Seguir', x + 96, y + 74, 120, 24, () => toggleFollow(id), f ? null : 'on', 11);
    if (isContact(id)) pbtn('Mensagem', x + 222, y + 74, 90, 24, () => go('chat', { chat: id }), null, 11);
    ptext(P.followers.includes(id) ? 'Segue você' : '', x + 320, y + 86, 10, '#7b5aa6', 700);
  }
  // grade de posts
  const gy = y + 108, cols = 5, cell = (w - 20) / cols, rows = Math.max(1, Math.floor((h - 140) / (cell * 0.7)));
  const per = cols * rows, pages = Math.max(1, Math.ceil(posts.length / per)); st.pg = clamp(st.pg || 0, 0, pages - 1);
  posts.slice(st.pg * per, st.pg * per + per).forEach((p, i) => { const px = x + 10 + (i % cols) * cell, py = gy + Math.floor(i / cols) * cell * 0.7; if (p.img) drawScene(p, px + 2, py + 2, cell - 4, cell * 0.7 - 4); else { ctx.fillStyle = '#ece8f4'; ctx.fillRect(px + 2, py + 2, cell - 4, cell * 0.7 - 4); ctx.font = `600 10px ${FONT}`; wrapLines(p.text, cell - 12).slice(0, 3).forEach((l, j) => ptext(l, px + 6, py + 12 + j * 12, 10, '#2a2238', 600, cell - 10)); } addBtn(px, py, cell, cell * 0.7, () => go('gpost', { post: p.id })); });
  if (!posts.length) ptext(me ? 'Você ainda não publicou nada. Toque em "+ Postar".' : 'Ainda sem publicações.', x + 14, gy + 14, 11, '#6a6478', 500);
  if (pages > 1) { pbtn('◀', x + w / 2 - 60, y + h - 26, 44, 22, () => { st.pg--; }, st.pg ? null : 'off', 11); pbtn('▶', x + w / 2 + 16, y + h - 26, 44, 22, () => { st.pg++; }, st.pg < pages - 1 ? null : 'off', 11); }
}
function drawGNew(x, y, w, h, st) {
  const P = phS();
  y = appHeader(x, y, w, 'Nova publicação'); h -= 38;
  const iw = w * 0.42, ih = iw * 0.66;
  ctx.fillStyle = '#ece8f4'; ctx.beginPath(); ctx.roundRect(x + 12, y + 4, iw, ih, 10); ctx.fill();
  if (st.photo) drawScene({ img: { k: 'photo', id: st.photo } }, x + 12, y + 4, iw, ih);
  else if (st.vid) drawScene({ img: { k: 'vid', id: st.vid } }, x + 12, y + 4, iw, ih);
  else ptext('Sem imagem (só texto)', x + 12 + iw / 2, y + 4 + ih / 2, 12, '#6a6478', 600, iw, 'center');
  pbtn('Escolher da galeria', x + 12, y + ih + 12, iw, 26, () => go('gallery', { post: true }), null, 11);
  const tx = x + iw + 28, tw = w - iw - 40;
  ptext('Legenda', tx, y + 12, 13, '#7b5aa6', 700);
  ctx.fillStyle = '#f0eef6'; ctx.beginPath(); ctx.roundRect(tx, y + 24, tw, 70, 10); ctx.fill();
  ctx.font = `600 12px ${FONT}`; wrapLines(st.text || 'Toque para escrever…', tw - 20).slice(0, 4).forEach((l, i) => ptext(l, tx + 10, y + 38 + i * 15, 12, st.text ? '#2a2238' : '#8a8496', 600, tw - 20));
  addBtn(tx, y + 24, tw, 70, () => phoneAsk('Escreva a legenda…', v => { st.text = v; }, [tx, y + 24, tw, 32], st.text || ''));
  ['Que dia lindo no vale! ☀', 'Olha isso! 📷', 'Saudades da praça 🏮'].forEach((q, i) => pbtn(q, tx, y + 102 + i * 28, tw, 24, () => { st.text = q; }, null, 11));
  pbtn('Publicar', tx, y + h - 40, tw, 34, () => {
    if (!st.text && !st.photo && !st.vid) { toast('Escreva algo ou escolha uma foto.'); return; }
    const img = st.photo ? { k: 'photo', id: st.photo } : st.vid ? { k: 'vid', id: st.vid } : null;
    const post = gramPost('kai', st.text || '📷', null, null); post.img = img; gramReactKai(post);
    PH.stack.pop(); if (phTop().app !== 'gram') go('gram', {}); save(); toast('Publicado no VilaGram!');
  }, 'red', 14);
}

// ---------------------------------------------------------------- Lanterna Vídeos
const VIDEO_TYPES = ['danca', 'futebol', 'engracado', 'receita', 'horta', 'animais', 'vila'];
const VIDEO_TITLES = { danca: ['Desafio da dança da praça 💃', 'Passinho do vale', 'Dança da colheita'], futebol: ['Embaixadinhas! ⚽', 'Treino pra sexta', 'Desafio do chute'], engracado: ['O Floco atacou de novo 😂', 'Tropeção épico', 'Quando a galinha foge'],
  receita: ['Receita: sopa de cogumelo 🍲', 'Torta da Rosa em 3 passos', 'Omelete do sítio'], horta: ['Timelapse da horta 🌱', 'Do plantio à colheita', 'Morangos crescendo'], animais: ['Galinha mais fofa do vale 🐔', 'Hora da ração!', 'Ovelha tosada'], vila: ['Um dia na Vila do Rio', 'Pôr do sol na praça 🌇', 'Noite de lanternas'] };
const VIDEO_BY = { danca: ['mel', 'nina', 'bia', 'duda'], futebol: ['joca', 'pedro', 'iara', 'duda'], engracado: ['joca', 'pedro', 'teo', 'bento'], receita: ['rosa', 'bia', 'marta'], horta: ['tome', 'mel'], animais: ['tome', 'malu', 'lia'], vila: ['aurora', 'cida', 'zeca', 'gil'] };
function addVideoEvent(type, by, title) { const P = phS(); P.evVids = P.evVids || []; P.evVids.unshift({ id: 'e' + Date.now(), type, by, title, at: nowMin() }); if (P.evVids.length > 10) P.evVids.length = 10; }
// vídeo número i do feed: primeiro os do Kai e dos acontecimentos, depois os gerados (infinito)
function videoAt(i) {
  const P = phS(), mine = (P.myVids || []).map(id => videos().find(v => v.id === id)).filter(Boolean), ev = P.evVids || [];
  if (i < mine.length) { const v = mine[i]; return { key: 'u' + v.id, u: v.id, by: 'kai', title: v.title || 'Meu vídeo do vale', likes: (P.vids.kaiLikes || {})[v.id] || 0, type: 'user' }; }
  i -= mine.length;
  if (i < ev.length) { const v = ev[i]; return { key: v.id, by: v.by, title: v.title, type: v.type, likes: 20 + (hashStr(v.id) >>> 0) % 300 }; }
  i -= ev.length;
  const h = hashStr('vid' + i + ':' + Math.floor(S.time.day / 3)) >>> 0, type = VIDEO_TYPES[h % VIDEO_TYPES.length], byL = VIDEO_BY[type].filter(id => RES_BY_ID[id]);
  return { key: 'g' + i + ':' + Math.floor(S.time.day / 3), by: byL[(h >>> 4) % byL.length] || 'mel', type, title: VIDEO_TITLES[type][(h >>> 8) % 3], likes: 15 + (h >>> 12) % 900 };
}
function drawVideoFrame(v, x, y, w, h, t) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.clip();
  const bg = { danca: ['#3a1a5a', '#ff5a9a'], futebol: ['#7ec8ff', '#5aa646'], engracado: ['#9ad8ff', '#7ec87a'], receita: ['#ffe8c8', '#f4d0a0'], horta: ['#9ad8ff', '#6aaa4a'], animais: ['#bfe6ff', '#8ac86a'], vila: ['#ffb070', '#7b5aa6'], user: ['#111', '#222'] }[v.type] || ['#222', '#444'];
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, gy = y + h * 0.78;
  if (v.type === 'user') {
    const vid = videos().find(q => q.id === v.u);
    if (vid) { const f = Math.floor(t * 4) % vid.frames.length, img = frameImg(vid, f); if (img.naturalWidth) { const s = Math.max(w / img.naturalWidth, h / img.naturalHeight); ctx.drawImage(img, cx - img.naturalWidth * s / 2, y + h / 2 - img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s); } }
    else ptext('Vídeo apagado', cx, y + h / 2, 12, '#fff', 600, w, 'center');
  } else if (v.type === 'danca') {
    for (let i = 0; i < 5; i++) { ctx.fillStyle = `hsla(${(t * 90 + i * 70) % 360},80%,60%,0.35)`; ctx.beginPath(); ctx.arc(x + w * (0.1 + i * 0.2), y + h * 0.2 + Math.sin(t * 3 + i) * 10, 18, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(cx + Math.sin(t * 4) * w * 0.12, gy - Math.abs(Math.sin(t * 8)) * 18); ctx.rotate(Math.sin(t * 8) * 0.12); drawSprite(v.by, 0, 0, h * 0.42); ctx.restore();
    for (let i = 0; i < 3; i++) ptext('♪', x + w * (0.2 + i * 0.3), y + h * 0.35 - ((t * 40 + i * 30) % 60), 18, '#fff', 700, 30, 'center');
  } else if (v.type === 'futebol') {
    drawSprite(v.by, cx, gy, h * 0.4);
    const k = (t * 1.6) % 1, by = gy - h * 0.12 - Math.sin(k * Math.PI) * h * 0.25;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + 10, by, 8, 0, 7); ctx.fill(); ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 1.5; ctx.stroke();
    ptext('Embaixadinhas: ' + Math.floor(t * 1.6), cx, y + 24, 13, '#fff', 700, w, 'center');
  } else if (v.type === 'engracado') {
    const k = (t * 0.35) % 1;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + w * (1.1 - k * 1.4), gy - 14, 12, 10, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#e0503a'; ctx.fillRect(x + w * (1.1 - k * 1.4) - 3, gy - 28, 6, 5);
    drawSprite('floco', x + w * (1.4 - k * 1.4), gy, h * 0.18);
    ctx.save(); ctx.translate(x + w * 0.3, gy); ctx.rotate(k > 0.5 ? -Math.min(1.4, (k - 0.5) * 6) : 0); drawSprite(v.by, 0, 0, h * 0.36); ctx.restore();
    if (k > 0.6) ptext('😂😂😂', cx, y + 30, 18, '#fff', 700, w, 'center');
  } else if (v.type === 'receita') {
    const steps = [['cogumelo', 'Dois cogumelos'], ['cogumelo', 'na panela'], ['sopa', 'e pronto!']], s = Math.floor(t / 1.5) % 4;
    for (let i = 0; i < Math.min(s, 3); i++) { drawIcon(steps[i][0], x + w * (0.22 + i * 0.28), y + h * 0.42, w * 0.2); ptext(steps[i][1], x + w * (0.22 + i * 0.28), y + h * 0.56, 10, '#5a3418', 700, w * 0.28, 'center'); }
    drawSprite(v.by, cx, gy + h * 0.16, h * 0.32); ptext('Receita do vale', cx, y + 22, 13, '#5a3418', 700, w, 'center');
  } else if (v.type === 'horta') {
    const k = (t * 0.25) % 1;
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x + w * (0.1 + k * 0.8), y + h * 0.18 - Math.sin(k * Math.PI) * h * 0.08, 14, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) { const gh = Math.min(1, k * 1.3) * h * 0.22; ctx.fillStyle = '#3f8a37'; ctx.fillRect(x + w * (0.15 + i * 0.22) - 2, gy - gh, 5, gh); if (k > 0.75) { ctx.fillStyle = '#e0503a'; ctx.beginPath(); ctx.arc(x + w * (0.15 + i * 0.22), gy - gh, 7, 0, 7); ctx.fill(); } }
    ptext(k > 0.75 ? 'Colheita!' : 'Dia ' + Math.floor(k * 8 + 1), cx, y + h * 0.9, 13, '#fff', 700, w, 'center');
  } else if (v.type === 'animais') {
    for (let i = 0; i < 3; i++) { const ax = x + w * (0.2 + i * 0.3) + Math.sin(t * 2 + i) * 6, peck = Math.abs(Math.sin(t * 5 + i * 2)) * 6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ax, gy - 12, 14, 11, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(ax + 10, gy - 22 + peck, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#e0503a'; ctx.fillRect(ax + 8, gy - 31 + peck, 5, 4); ctx.fillStyle = '#f0a020'; ctx.fillRect(ax + 16, gy - 22 + peck, 5, 3); }
    drawSprite(v.by, x + w * 0.8, gy + h * 0.12, h * 0.32);
  } else if (v.type === 'vila') {
    const B = BUILDINGS.filter(b => b.kind === 'house' && b.img); for (let i = 0; i < 2; i++) { const b = B[(i * 5 + 2) % B.length]; const bh = h * 0.3, bw = bh * b.img.width / b.img.height; ctx.drawImage(b.img, x + (i ? w - bw - 4 : 4) + Math.sin(t * 0.5) * 6, gy - bh, bw, bh); }
    drawSprite(v.by, x + w * ((t * 0.12) % 1.2), gy + 6, h * 0.3); drawSprite('teo', x + w * (1 - (t * 0.1) % 1.2), gy + 10, h * 0.22);
  }
  ctx.restore();
}
function drawVideoThumb(v, x, y, w, h) {
  const vv = v && v.u ? { type: 'user', u: v.u, by: 'kai' } : typeof v === 'number' ? videoAt(v) : v;
  drawVideoFrame(vv, x, y, w, h, 1.2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 14, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + w / 2 - 5, y + h / 2 - 8); ctx.lineTo(x + w / 2 + 8, y + h / 2); ctx.lineTo(x + w / 2 - 5, y + h / 2 + 8); ctx.fill();
}
function drawVideos(x, y, w, h, st) {
  const P = phS();
  if (st.i == null) st.i = 0;
  if (st.shown !== st.i) { st.shown = st.i; st.t0 = PH.rt; }
  const v = videoAt(st.i), t = PH.rt - st.t0;
  const vh = h - 12, vw = vh * 9 / 16, vx = x + w / 2 - vw / 2 - 40, vy = y + 6;
  drawVideoFrame(v, vx, vy, vw, vh, t);
  // barra de progresso
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(vx + 8, vy + vh - 8, vw - 16, 3); ctx.fillStyle = '#fff'; ctx.fillRect(vx + 8, vy + vh - 8, (vw - 16) * ((t % 8) / 8), 3);
  PH.swipeRect = [vx, vy, vw, vh];
  // informações e ações
  const ix = vx + vw + 16;
  portrait(v.by, ix + 20, vy + 30, 40);
  ptext(profName(v.by), ix + 46, vy + 22, 14, '#fff', 700, w - (ix - x) - 60); ptext(profHandle(v.by), ix + 46, vy + 40, 10, '#b8b0cc', 500);
  ctx.font = `600 12px ${FONT}`; wrapLines(v.title, w - (ix - x) - 20).slice(0, 2).forEach((l, i) => ptext(l, ix, vy + 70 + i * 15, 12, '#fff', 600, w - (ix - x) - 20));
  const liked = P.vids.liked.includes(v.key), comments = P.vids.comments[v.key] || [];
  pbtn((liked ? '❤ ' : '♡ ') + (v.likes + (liked ? 1 : 0)), ix, vy + 108, 100, 30, () => { const i = P.vids.liked.indexOf(v.key); if (i >= 0) P.vids.liked.splice(i, 1); else { P.vids.liked.push(v.key); if (P.vids.liked.length > 200) P.vids.liked.shift(); if (v.by !== 'kai') { const m = sm(v.by); if (m.vidDay !== S.time.day) { m.vidDay = S.time.day; addFriend(v.by, 1); } } } save(); }, liked ? 'red' : 'ghost', 12);
  pbtn('💬 ' + (comments.length + (v.likes >> 5)), ix + 106, vy + 108, 80, 30, () => { st.comments = !st.comments; }, st.comments ? 'on' : 'ghost', 12);
  pbtn('↗ Enviar', ix + 192, vy + 108, 86, 30, () => { const vi = st.i; if (st.shareTo) { sendMsg(st.shareTo, 'Olha esse vídeo! 😂', { vid: vi }); PH.stack.pop(); } else go('pick', { purpose: 'share', text: 'Olha esse vídeo: ' + v.title, extra: { vid: vi } }); P.vids.shared++; }, 'ghost', 12);
  if (st.comments) {
    const all = (v.likes > 40 ? [{ by: VIDEO_BY[v.type] ? VIDEO_BY[v.type][1] : 'mel', t: 'Hahaha muito bom!' }, { by: 'teo', t: 'Faz de novo!!' }] : []).concat(comments);
    all.slice(-3).forEach((c, i) => ptext(profName(c.by) + ': ' + c.t, ix, vy + 154 + i * 16, 11, '#e8e0f8', 600, w - (ix - x) - 20));
    pbtn('✎ Comentar', ix, vy + 206, 120, 26, () => phoneAsk('Comentário…', val => { (P.vids.comments[v.key] = comments).push({ by: 'kai', t: val }); save(); }, [ix, vy + 206, 220, 28]), 'ghost', 11);
  }
  pbtn('▲ Anterior', ix, vy + vh - 72, 110, 30, () => { st.i = Math.max(0, st.i - 1); }, st.i > 0 ? 'ghost' : 'off', 12);
  pbtn('▼ Próximo', ix, vy + vh - 36, 110, 30, () => { st.i++; }, 'on', 12);
  ptext('Deslize na tela do vídeo para trocar', ix + 120, vy + vh - 20, 10, '#8a84a0', 500, w - (ix - x) - 130);
  pbtn('Meus vídeos', ix + 120, vy + vh - 72, 110, 30, () => go('gallery', { tab: 'vid' }), 'ghost', 11);
}
function phonePointerDown(x, y) { if (PH.open && phTop().app === 'videos' && PH.swipeRect) { const [rx, ry, rw, rh] = PH.swipeRect; if (x > rx && x < rx + rw && y > ry && y < ry + rh) PH.swipe = { y, x }; } }
function phonePointerUp(x, y) {
  if (!PH.swipe) return; const dy = y - PH.swipe.y; PH.swipe = null;
  const st = phTop(); if (st.app !== 'videos') return;
  if (dy < -40) st.i++; else if (dy > 40) st.i = Math.max(0, st.i - 1);
}

// ---------------------------------------------------------------- Câmera
const CAM = { zoom: 1, ox: 0, oy: 0, mode: 'foto', shot: false, rec: null, flash: 0 };
function phoneCamStart() { Object.assign(CAM, { zoom: 1, ox: 0, oy: 0, shot: false, rec: null, flash: 0 }); }
function phoneCamEnd() { CAM.rec = null; CAM.zoom = 1; CAM.ox = 0; CAM.oy = 0; }
const phoneCamActive = () => PH.open && !PH.closing && phTop().app === 'camera';
const phoneZoom = () => phoneCamActive() ? CAM.zoom : 1;
const phoneCamOffset = () => phoneCamActive() ? [CAM.ox, CAM.oy] : [0, 0];
function camRect() { const w = Math.min(W * 0.66, (H - 40) * 1.6), h = w / 1.6; return { x: (W - w) / 2 - 60, y: (H - h) / 2, w, h }; }
function drawCameraUI() {
  const r = camRect();
  // escurece fora do enquadramento
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, r.y); ctx.fillRect(0, r.y + r.h, W, H - r.y - r.h); ctx.fillRect(0, r.y, r.x, r.h); ctx.fillRect(r.x + r.w, r.y, W - r.x - r.w, r.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r.x + r.w * i / 3, r.y); ctx.lineTo(r.x + r.w * i / 3, r.y + r.h); ctx.moveTo(r.x, r.y + r.h * i / 3); ctx.lineTo(r.x + r.w, r.y + r.h * i / 3); ctx.stroke(); }
  if (CAM.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${CAM.flash})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
  ptext('📍 ' + placeName() + ' · ' + clockText(), r.x + 10, r.y + 16, 12, '#fff', 700, r.w - 20);
  if (CAM.rec) { ctx.fillStyle = '#ff3b4a'; ctx.beginPath(); ctx.arc(r.x + r.w - 20, r.y + 16, 6 + Math.sin(PH.rt * 8), 0, 7); ctx.fill(); ptext('REC ' + (CAM.rec.frames.length / 4).toFixed(1) + 's', r.x + r.w - 32, r.y + 16, 12, '#fff', 700, 80, 'right'); }
  // controles à direita
  const cx = r.x + r.w + 70, cy = r.y + r.h / 2;
  ctx.fillStyle = CAM.mode === 'video' ? '#ff3b4a' : '#fff'; ctx.strokeStyle = '#2a2238'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 7); ctx.fill(); ctx.stroke();
  addBtn(cx - 32, cy - 32, 64, 64, () => {
    if (CAM.mode === 'foto') { CAM.shot = true; }
    else if (!CAM.rec) CAM.rec = { frames: [], t: 0 };
  });
  pbtn('Foto', cx - 58, cy - 92, 54, 26, () => { CAM.mode = 'foto'; }, CAM.mode === 'foto' ? 'on' : 'ghost', 11);
  pbtn('Vídeo', cx + 4, cy - 92, 54, 26, () => { CAM.mode = 'video'; }, CAM.mode === 'video' ? 'red' : 'ghost', 11);
  pbtn('−', cx - 58, cy + 42, 34, 26, () => { CAM.zoom = Math.max(1, CAM.zoom - 0.25); }, 'ghost', 14);
  ptext(CAM.zoom.toFixed(2) + 'x', cx, cy + 55, 11, '#fff', 700, 40, 'center');
  pbtn('+', cx + 24, cy + 42, 34, 26, () => { CAM.zoom = Math.min(2.5, CAM.zoom + 0.25); }, 'ghost', 14);
  // enquadramento (move a câmera sem mover o Kai)
  const ax = cx, ay = cy + 100;
  pbtn('▲', ax - 15, ay - 16, 30, 24, () => { CAM.oy -= 40; }, 'ghost', 11); pbtn('▼', ax - 15, ay + 34, 30, 24, () => { CAM.oy += 40; }, 'ghost', 11);
  pbtn('◀', ax - 50, ay + 9, 30, 24, () => { CAM.ox -= 40; }, 'ghost', 11); pbtn('▶', ax + 20, ay + 9, 30, 24, () => { CAM.ox += 40; }, 'ghost', 11);
  pbtn('⦿', ax - 15, ay + 9, 30, 24, () => { CAM.ox = 0; CAM.oy = 0; }, 'ghost', 11);
  pbtn('‹ Voltar', 12 + SAFE.l, 10 + SAFE.t, 84, 30, phoneBack, 'ghost', 12);
  pbtn('Galeria', 12 + SAFE.l, 46 + SAFE.t, 84, 30, () => go('gallery', {}), 'ghost', 12);
  ptext('Ande com o joystick para enquadrar', 12 + SAFE.l, H - 16 - SAFE.b, 11, 'rgba(255,255,255,0.8)', 600, 260);
}
// chamado depois do mundo ser desenhado e antes da interface: a foto/vídeo não pega HUD nem celular
function phoneAfterWorld() {
  if (!phoneCamActive()) return;
  const r = camRect(), sx = r.x * DPR, sy = r.y * DPR, sw = r.w * DPR, sh = r.h * DPR;
  if (CAM.shot) {
    CAM.shot = false;
    const c = document.createElement('canvas'); c.width = 320; c.height = 200; c.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, 320, 200);
    const p = { id: 'p' + Date.now(), at: nowMin(), place: placeName(), data: c.toDataURL('image/jpeg', 0.72) };
    photos().unshift(p); storeMedia(PHOTO_KEY, photos(), MAX_PHOTOS);
    CAM.flash = 1; if (Audio.ac && !Audio.muted) Audio.noise(0.08, 0.12, 2500);
    notify('social', 'Câmera', 'Foto salva na galeria (' + p.place + ').', { app: 'photo', id: p.id });
  }
  if (CAM.rec) {
    CAM.rec.t -= 1 / 60;
    if (CAM.rec.t <= 0) {
      CAM.rec.t = 0.25;
      const c = document.createElement('canvas'); c.width = 192; c.height = 120; c.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, 192, 120);
      CAM.rec.frames.push(c.toDataURL('image/jpeg', 0.6));
      if (CAM.rec.frames.length >= 16) {
        const v = { id: 'v' + Date.now(), at: nowMin(), place: placeName(), frames: CAM.rec.frames, title: 'Vídeo em ' + placeName() };
        videos().unshift(v); storeMedia(VIDEO_KEY, videos(), MAX_VIDEOS); CAM.rec = null;
        notify('social', 'Câmera', 'Vídeo gravado (4 s). Publique pela Galeria.', { app: 'gallery', tab: 'vid' });
      }
    }
  }
}

// ---------------------------------------------------------------- Galeria
function drawGallery(x, y, w, h, st) {
  const P = phS(), tab = st.tab || 'foto';
  const title = st.pick ? 'Escolha uma foto para enviar' : st.wall ? 'Escolha o papel de parede' : st.avatar ? 'Escolha sua foto de perfil' : st.post ? 'Escolha a imagem do post' : 'Galeria';
  y = appHeader(x, y, w, title, () => { pbtn('Fotos', x + w - 230, y + 6, 70, 22, () => { st.tab = 'foto'; st.pg = 0; }, tab === 'foto' ? 'on' : null, 11); pbtn('Vídeos', x + w - 156, y + 6, 70, 22, () => { st.tab = 'vid'; st.pg = 0; }, tab === 'vid' ? 'on' : null, 11); pbtn('📷 Câmera', x + w - 82, y + 6, 76, 22, () => go('camera'), null, 11); });
  const list = tab === 'foto' ? photos() : videos();
  if (!list.length) { ptext(tab === 'foto' ? 'Nenhuma foto. Abra a Câmera e fotografe o vale!' : 'Nenhum vídeo. Na Câmera, escolha "Vídeo" e grave 4 segundos.', x + 16, y + 20, 12, '#6a6478', 500, w - 32); return; }
  const cols = 4, cell = (w - 20) / cols, ch = cell * 0.62, rows = Math.max(1, Math.floor((h - 70) / (ch + 18))), per = cols * rows, pages = Math.ceil(list.length / per);
  st.pg = clamp(st.pg || 0, 0, pages - 1);
  list.slice(st.pg * per, st.pg * per + per).forEach((p, i) => {
    const px = x + 10 + (i % cols) * cell, py = y + 4 + Math.floor(i / cols) * (ch + 18);
    if (tab === 'foto') { const img = photoImg(p.id); ctx.fillStyle = '#ddd'; ctx.fillRect(px + 3, py, cell - 6, ch); if (img && img.naturalWidth) ctx.drawImage(img, px + 3, py, cell - 6, ch); }
    else drawVideoThumb({ u: p.id }, px + 3, py, cell - 6, ch);
    ptext(p.place + ' · ' + timeLabel(p.at), px + 4, py + ch + 8, 9, '#6a6478', 500, cell - 8);
    addBtn(px, py, cell, ch, () => {
      if (tab === 'foto' && st.pick) { PH.stack.pop(); sendMsg(st.pick, 'Olha essa foto!', { photo: p.id }); }
      else if (tab === 'foto' && st.wall) { P.settings.wall = p.id; save(); PH.stack.pop(); }
      else if (tab === 'foto' && st.avatar) { P.profile.avatar = p.id; save(); PH.stack.pop(); }
      else if (st.post) { PH.stack.pop(); const t = phTop(); if (tab === 'foto') { t.photo = p.id; t.vid = null; } else { t.vid = p.id; t.photo = null; } }
      else go(tab === 'foto' ? 'photo' : 'vidview', { id: p.id });
    });
  });
  if (pages > 1) { pbtn('◀', x + w / 2 - 60, y + h - 66, 44, 22, () => { st.pg--; }, st.pg ? null : 'off', 11); pbtn('▶', x + w / 2 + 16, y + h - 66, 44, 22, () => { st.pg++; }, st.pg < pages - 1 ? null : 'off', 11); }
  ptext(list.length + '/' + (tab === 'foto' ? MAX_PHOTOS : MAX_VIDEOS) + ' guardados', x + 12, y + h - 52, 10, '#8a8496', 500);
}
function drawPhoto(x, y, w, h, st) {
  const P = phS(), p = photos().find(q => q.id === st.id);
  if (!p) { ptext('Foto apagada.', x + 16, y + 20, 12, '#6a6478'); return; }
  y = appHeader(x, y, w, p.place + ' · ' + timeLabel(p.at));
  const iw = Math.min(w * 0.62, (h - 50) * 1.6), ih = iw / 1.6, img = photoImg(p.id);
  if (img && img.naturalWidth) ctx.drawImage(img, x + 10, y + 4, iw, ih);
  const bx = x + iw + 22, bw = w - iw - 32;
  pbtn('Publicar no VilaGram', bx, y + 6, bw, 30, () => go('gnew', { photo: p.id }), 'red', 12);
  pbtn('Enviar para…', bx, y + 42, bw, 30, () => go('pick', { purpose: 'share', text: 'Olha essa foto!', extra: { photo: p.id } }), 'on', 12);
  pbtn('Papel de parede', bx, y + 78, bw, 30, () => { P.settings.wall = p.id; save(); toast('Papel de parede alterado.'); }, null, 12);
  pbtn(st.del ? 'Toque de novo p/ apagar' : 'Apagar', bx, y + 114, bw, 30, () => { if (!st.del) { st.del = true; return; } const L = photos(), i = L.indexOf(p); L.splice(i, 1); storeMedia(PHOTO_KEY, L, MAX_PHOTOS); photoCache.delete(p.id); if (P.settings.wall === p.id) P.settings.wall = 0; PH.stack.pop(); }, st.del ? 'red' : null, 11);
}
function drawVidView(x, y, w, h, st) {
  const P = phS(), v = videos().find(q => q.id === st.id);
  if (!v) { ptext('Vídeo apagado.', x + 16, y + 20, 12, '#6a6478'); return; }
  y = appHeader(x, y, w, v.title + ' · ' + timeLabel(v.at));
  if (st.t0 == null) st.t0 = PH.rt;
  const iw = Math.min(w * 0.62, (h - 50) * 1.6), ih = iw / 1.6;
  drawVideoFrame({ type: 'user', u: v.id }, x + 10, y + 4, iw, ih, PH.rt - st.t0);
  const bx = x + iw + 22, bw = w - iw - 32;
  P.myVids = P.myVids || [];
  const pub = P.myVids.includes(v.id);
  pbtn(pub ? 'Publicado nos Vídeos ✓' : 'Publicar nos Vídeos', bx, y + 6, bw, 30, () => { if (!pub) { P.myVids.unshift(v.id); (P.vids.kaiLikes = P.vids.kaiLikes || {})[v.id] = 0; for (const r of RESIDENTS.filter(q => hasPhone(q.id) && sm(q.id).friend >= 100)) if (Math.random() < 0.5) (P.gq = P.gq || []).push({ vid: v.id, by: r.id, kind: 'vlike', wait: 3 + Math.random() * 20 }); save(); toast('Vídeo publicado no Lanterna Vídeos!'); } }, pub ? 'on' : 'red', 11);
  pbtn('Postar no VilaGram', bx, y + 42, bw, 30, () => go('gnew', { vid: v.id }), null, 11);
  pbtn('Enviar para…', bx, y + 78, bw, 30, () => go('pick', { purpose: 'share', text: 'Gravei isso no vale!', extra: { vid: { u: v.id } } }), null, 11);
  pbtn(st.del ? 'Toque de novo p/ apagar' : 'Apagar', bx, y + 114, bw, 30, () => { if (!st.del) { st.del = true; return; } const L = videos(); L.splice(L.indexOf(v), 1); storeMedia(VIDEO_KEY, L, MAX_VIDEOS); P.myVids = P.myVids.filter(i => i !== v.id); PH.stack.pop(); }, st.del ? 'red' : null, 11);
}
Object.assign(PHONE_APPS, { gram: drawGram, gpost: drawGPost, gprofile: drawGProfile, gnew: drawGNew, videos: drawVideos, gallery: drawGallery, photo: drawPhoto, vidview: drawVidView, camera: () => {} });

// ---------------------------------------------------------------- tempo: curtidas e comentários chegando
function phoneMediaTick(dt) {
  const P = phS();
  if (CAM.flash > 0) CAM.flash = Math.max(0, CAM.flash - dt * 3);
  if (!P.gq || !P.gq.length) return;
  for (let i = P.gq.length - 1; i >= 0; i--) {
    const q = P.gq[i]; if ((q.wait -= dt) > 0) continue;
    P.gq.splice(i, 1);
    if (q.kind === 'vlike') { P.vids.kaiLikes[q.vid] = (P.vids.kaiLikes[q.vid] || 0) + 1; notify('social', 'Lanterna Vídeos', profName(q.by) + ' curtiu seu vídeo.', { app: 'videos', i: 0 }); continue; }
    const p = P.posts.find(x => x.id === q.post); if (!p) continue;
    if (q.kind === 'like' && !p.likes.includes(q.by)) { p.likes.push(q.by); if (p.by === 'kai') { P.gramNew = (P.gramNew || 0) + 1; notify('social', 'VilaGram', profName(q.by) + ' curtiu sua publicação.', { app: 'gpost', post: p.id }); } }
    if (q.kind === 'comment') { p.comments.push({ by: q.by, t: q.text, at: nowMin() }); if (p.by === 'kai' || p.comments.some(c => c.by === 'kai')) { P.gramNew = (P.gramNew || 0) + 1; notify('social', 'VilaGram', profName(q.by) + ' comentou: ' + q.text, { app: 'gpost', post: p.id }); } }
  }
}
