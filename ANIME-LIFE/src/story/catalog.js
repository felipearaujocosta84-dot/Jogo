// CATÁLOGO DOS 350 CAPÍTULOS (10 volumes × 35).
// Status de produção REAL de cada capítulo:
//   escrito      → roteiro completo em chapters/chN.js, jogável
//   roteirizado  → título e sinopse detalhada definidos (plan/volNN.js), roteiro ainda não escrito
//   planejado    → só a posição no arco do volume (plan/volumes.js); título e sinopse ainda não escritos
// Desbloqueio: o capítulo 1 começa aberto; cada capítulo abre quando o anterior é concluído.
import { CHAPTERS } from './chapters/index.js';
import { VOLUMES } from './plan/volumes.js';
import { VOL01_PLAN } from './plan/vol01.js';
import { VOL02_PLAN } from './plan/vol02.js';
import { VOL03_PLAN } from './plan/vol03.js';
import { VOL04_PLAN } from './plan/vol04.js';
import { VOL05_PLAN } from './plan/vol05.js';
import { VOL06_PLAN } from './plan/vol06.js';
import { VOL07_PLAN } from './plan/vol07.js';
import { VOL08_PLAN } from './plan/vol08.js';
import { VOL09_PLAN } from './plan/vol09.js';
import { VOL10_PLAN } from './plan/vol10.js';

export const TOTAL = 350;
export const PER_VOLUME = 35;
const PLANS = { 1: VOL01_PLAN, 2: VOL02_PLAN, 3: VOL03_PLAN, 4: VOL04_PLAN, 5: VOL05_PLAN, 6: VOL06_PLAN, 7: VOL07_PLAN, 8: VOL08_PLAN, 9: VOL09_PLAN, 10: VOL10_PLAN };
// fases do arco de cada volume (posição do capítulo dentro dos 35)
const PHASES = [[4, 'Abertura'], [10, 'Desenvolvimento'], [17, 'Complicação'], [24, 'Virada'], [31, 'Crise'], [35, 'Desfecho']];
const phaseOf = (k) => PHASES.find(([end]) => k <= end)[1];

const written = new Map(CHAPTERS.map((c) => [c.number, c]));

export const CATALOG = Array.from({ length: TOTAL }, (_, i) => {
  const n = i + 1;
  const vol = Math.ceil(n / PER_VOLUME);
  const k = n - (vol - 1) * PER_VOLUME;
  const V = VOLUMES[vol - 1];
  const ch = written.get(n);
  const plan = PLANS[vol]?.find((p) => p.n === k);
  const status = ch ? 'escrito' : plan ? 'roteirizado' : 'planejado';
  return {
    n, volume: vol, inVolume: k, phase: phaseOf(k),
    id: ch?.id || `ch${n}`,
    title: ch?.title || plan?.title || `${V.title} — ${phaseOf(k)} (${k}/35)`,
    synopsis: ch?.synopsis || plan?.synopsis || `Planejado: fase “${phaseOf(k)}” do arco do Volume ${vol}. Sinopse ainda não escrita.`,
    status,
  };
});

export const VOLUMES_INFO = VOLUMES.map((v) => ({ ...v, from: (v.n - 1) * PER_VOLUME + 1, to: v.n * PER_VOLUME }));

export const chapterStatus = (c) => c.status;
/** Desbloqueado: capítulo 1, ou o anterior concluído. done: Set de ids concluídos. */
export function isUnlocked(n, done) { return n === 1 || done.has(CATALOG[n - 2].id); }
export function progress() {
  const p = { escrito: 0, roteirizado: 0, planejado: 0 };
  for (const c of CATALOG) p[c.status]++;
  return p;
}
