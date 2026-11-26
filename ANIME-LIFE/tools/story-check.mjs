// Verifica a história inteira sem abrir o navegador:
//  - todo rótulo (go) existe; todo personagem usado existe; toda cena termina;
//  - percorre TODOS os caminhos de escolha (com condições avaliadas por um estado simulado),
//    garantindo que nenhum caminho trava, entra em laço ou cai num passo inválido;
//  - romance só com personagens adultos marcados como "romanceable".
// Uso: node tools/story-check.mjs   (V=1 mostra os caminhos)
import { readFileSync } from 'fs';
import { CHAPTERS } from '../src/story/chapters/index.js';
import { EVENTS } from '../src/story/events/index.js';
import { CONVERSATIONS } from '../src/story/phone/conversations.js';
import { POSTS } from '../src/story/phone/posts.js';

const chars = JSON.parse(readFileSync(new URL('../src/characters/characters.json', import.meta.url))).characters;
const byId = Object.fromEntries(chars.map((c) => [c.id, c]));
const EXPR = ['neutral', 'happy', 'sad', 'surprised', 'angry', 'embarrassed', 'curious', 'serious', 'shy', 'hurt', 'love', 'lookaway'];
const CAMS = ['wide', 'medium', 'close', 'extreme', 'two', 'ots', 'side'];
const BGS = ['apartamento', 'apartamento_noite', 'cafe', 'terraco_tarde', 'terraco_noite', 'corredor_noite'];
let errors = 0, paths = 0;
const err = (m) => { errors++; console.error('❌ ' + m); };

// estado simulado (mesma semântica do jogo)
const blank = () => ({ flags: {}, rel: {}, contacts: [], decisions: [], routes: {} });
const clone = (s) => JSON.parse(JSON.stringify(s));
const ctxOf = (s) => ({
  flag: (k) => s.flags[k], stat: (id, k) => s.rel[id]?.[k] ?? 0, route: (id) => s.routes[id] || null,
  stage: (id) => s.romanceStage?.[id] || 'nenhum', mood: () => 'neutro',
  comfort: (id) => { const r = s.rel[id] || {}; return (r.afinidade || 0) + (r.carinho || 0) + (r.confianca || 0) * 0.5 + (r.romance || 0) * 1.5; },
  contact: (id) => s.contacts.includes(id), chose: (d) => [...s.decisions].reverse().find((x) => x.id === d)?.value, pronouns: 'ele',
});
function apply(s, list = [], where) {
  for (const e of list) {
    if (e.rel) {
      const [id, d] = e.rel; if (!byId[id]) err(`${where}: personagem inexistente ${id}`);
      s.rel[id] ||= { amizade: 0, confianca: 0, afinidade: 0, romance: 0 };
      for (let [k, v] of Object.entries(d)) {
        if (k === 'romance' && v > 0) { const c = byId[id]; if (!(c.romanceable && c.age >= 18)) err(`${where}: romance com personagem não elegível ${id}`); if (s.rel[id].afinidade < 15) k = 'afinidade'; }
        s.rel[id][k] = Math.max(0, (s.rel[id][k] || 0) + v);
      }
    }
    if ('flag' in e) s.flags[e.flag] = e.v ?? true;
    if (e.contact && !s.contacts.includes(e.contact)) s.contacts.push(e.contact);
    if (e.route) s.routes[e.route[0]] = e.route[1];
    if (e.post && !POSTS[e.post]) err(`${where}: publicação inexistente ${e.post}`);
    if (e.romance) { const c = byId[e.romance[0]]; if (!(c?.romanceable && c.age >= 18)) err(`${where}: etapa romântica com personagem não elegível ${e.romance[0]}`); (s.romanceStage ||= {})[e.romance[0]] = e.romance[1]; }
  }
}
function labelsOf(steps, where) {
  const m = {}; steps.forEach((s, i) => { if (s.label) { if (s.label in m) err(`${where}: rótulo duplicado ${s.label}`); m[s.label] = i; } });
  steps.forEach((s) => { for (const g of [s.go, ...(s.choice || []).map((o) => o.go)]) if (g && !(g in m)) err(`${where}: rótulo "${g}" não existe`); });
  return m;
}
function checkStep(s, where) {
  for (const id of [s.c, s.show, s.hide].filter(Boolean)) if (!byId[id]) err(`${where}: personagem inexistente ${id}`);
  if (s.e && !EXPR.includes(s.e)) err(`${where}: expressão desconhecida "${s.e}"`);
  if (s.bg && !BGS.includes(s.bg)) err(`${where}: cenário inexistente ${s.bg}`);
  if (s.phone && !CONVERSATIONS[s.phone]) err(`${where}: conversa inexistente ${s.phone}`);
  if (s.c && !s.t) err(`${where}: fala sem texto`);
  if (s.cam && !CAMS.includes(s.cam)) err(`${where}: plano de câmera desconhecido "${s.cam}"`);
  if (s.shot && !CAMS.includes(s.shot)) err(`${where}: plano de câmera desconhecido "${s.shot}"`);
}

// percorre uma lista de passos; devolve os estados finais possíveis
function walkSteps(steps, start, where, onDone, trail = []) {
  const labels = labelsOf(steps, where);
  const go = (pc, s, seen, said) => {
    for (let guard = 0; guard < 2000; guard++) {
      const st = steps[pc];
      if (!st || st.end) return onDone(s, said);
      checkStep(st, `${where}#${pc}`);
      if (st.label) { pc++; continue; }
      if (st.if) { pc = st.if(ctxOf(s)) ? labels[st.go] : pc + 1; continue; }
      if (st.go && !st.choice) { pc = labels[st.go]; continue; }
      if (st.do) { apply(s, st.do, where); pc++; continue; }
      if (st.phone) { const outs = []; walkConvo(st.phone, s, (s2) => outs.push(s2)); for (const s2 of outs) go(pc + 1, s2, seen, said); return; }
      if (st.choice) {
        const key = `${pc}`; if (seen.includes(key)) return onDone(s, said); // menu que volta: ok
        const opts = st.choice.filter((o) => !o.if || o.if(ctxOf(s)));
        if (!opts.length) err(`${where}#${pc}: nenhuma opção disponível`);
        const open = opts.filter((o) => !(o.lockIf && o.lockIf(ctxOf(s))));
        if (!open.length) err(`${where}#${pc}: todas as opções bloqueadas`);
        for (const o of open) {
          const s2 = clone(s); apply(s2, o.do, where);
          s2.decisions.push({ id: st.id, value: o.value });
          go(o.go ? labels[o.go] : pc + 1, s2, [...seen, key], [...said, o.value]);
        }
        return;
      }
      pc++;
    }
    err(`${where}: laço infinito`);
  };
  go(start, start === 0 ? clone(trail) : trail, [], []);
}
function walkConvo(id, s0, onDone) {
  const c = CONVERSATIONS[id];
  for (const m of c.members || []) if (!byId[m]) err(`conversa ${id}: membro inexistente ${m}`);
  walkSteps(c.steps, 0, `📱${id}`, (s) => onDone(s), s0);
}

// todas as cenas, em ordem, propagando os estados possíveis (amostra limitada por cena)
let states = [blank()];
for (const ch of CHAPTERS) {
  for (const sc of ch.scenes) {
    const next = [];
    for (const s of states) {
      walkSteps(sc.steps, 0, `${sc.id}`, (s2, said) => {
        paths++;
        if (process.env.V) console.log(`  ${sc.id}: ${said.join(' > ')}`);
        next.push(s2);
      }, s);
    }
    // mantém variedade sem explodir: até 400 estados distintos
    const uniq = new Map(next.map((s) => [JSON.stringify([s.flags, s.contacts, s.decisions.map((d) => d.value)]), s]));
    states = [...uniq.values()].slice(0, 400);
    console.log(`✔ ${sc.id} (${sc.title}): ${next.length} caminhos, ${states.length} estados distintos seguem`);
  }
}
// eventos especiais: percorre todos os caminhos com relações baixas e altas (testa os dois lados do consentimento)
for (const ev of EVENTS) {
  const c = byId[ev.char];
  if (!(c?.romanceable && c.age >= 18)) err(`evento ${ev.scene.id}: personagem não é adulto elegível`);
  for (const level of [0, 12, 40]) {
    const s0 = { ...blank(), rel: { [ev.char]: { amizade: level, confianca: level, carinho: level, afinidade: level, romance: level } }, romanceStage: { [ev.char]: ev.kind === 'noite' ? 'namoro' : 'interesse' } };
    let n = 0;
    walkSteps(ev.scene.steps, 0, ev.scene.id, () => { n++; paths++; }, s0);
    console.log(`✔ evento ${ev.scene.id} (relação ${level}): ${n} caminhos`);
  }
}
for (const [id, p] of Object.entries(POSTS)) if (!byId[p.author]) err(`post ${id}: autor inexistente`);
console.log(errors ? `\n❌ ${errors} erro(s)` : `\n✅ História íntegra: ${paths} caminhos de cena percorridos.`);
process.exit(errors ? 1 : 0);
