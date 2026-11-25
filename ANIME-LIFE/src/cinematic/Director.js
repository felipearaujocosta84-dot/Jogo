// Diretor de câmera: escolhe o enquadramento de cada fala conforme o contexto,
// como numa cena de anime. O roteiro pode forçar um plano com { cam: 'close' }.
//
// Planos: wide (aberto, mostra o ambiente) · medium (meio corpo) · close (rosto)
//         extreme (close extremo nas expressões) · two (os dois personagens)
//         ots (por cima do ombro) · side (câmera lateral)
// Movimento: push 'in' (aproxima devagar) | 'out' (afasta) | null
import { STRONG } from './Emotions.js';

export const SHOTS = ['wide', 'medium', 'close', 'extreme', 'two', 'ots', 'side'];

export class Director {
  constructor() { this.reset(); }

  reset() { this.last = null; this.lastSpeaker = null; this.count = 0; this.same = 0; this.lineInScene = 0; }

  /**
   * ctx: { speaker, emotion, text, cast:[{id,at}], cam (forçado), sceneStart, revelation }
   * speaker: id do personagem | 'player' | 'thought' | null (narração)
   */
  shotFor(ctx) {
    const cast = ctx.cast || [];
    const ids = cast.map((c) => c.id);
    const onStage = (id) => ids.includes(id);
    const partnerOf = (id) => ids.find((x) => x !== id) || null;
    this.lineInScene++;
    let shot;

    if (ctx.cam) shot = { type: ctx.cam, subject: onStage(ctx.speaker) ? ctx.speaker : this.lastSpeaker || ids[0] || null, push: ctx.cam === 'wide' ? 'in' : null };
    else if (!cast.length) shot = { type: 'wide', subject: null, push: this.lineInScene === 1 ? 'in' : null };
    else if (ctx.sceneStart || this.lineInScene === 1) shot = { type: cast.length > 1 ? 'two' : 'wide', subject: ids[0], push: 'in' };
    else if (!ctx.speaker || ctx.speaker === 'thought') {
      // narração/pensamento: plano mais aberto e calmo
      shot = { type: cast.length > 1 ? 'two' : 'medium', subject: this.lastSpeaker && onStage(this.lastSpeaker) ? this.lastSpeaker : ids[0], push: 'out' };
    } else if (ctx.speaker === 'player') {
      // o protagonista fala: vemos a reação de quem escuta (câmera "por cima do ombro" do protagonista)
      const listener = this.lastSpeaker && onStage(this.lastSpeaker) ? this.lastSpeaker : ids[0];
      shot = { type: 'medium', subject: listener, push: null, listening: true };
    } else if (onStage(ctx.speaker)) {
      const strong = STRONG.has(ctx.emotion);
      const question = /\?\s*$/.test(ctx.text || '');
      const changed = ctx.speaker !== this.lastSpeaker;
      if (ctx.revelation || (strong && ctx.intensity >= 0.9 && /\.\.\.|!/.test(ctx.text || ''))) shot = { type: 'extreme', subject: ctx.speaker, push: 'in' };
      else if (strong) shot = { type: 'close', subject: ctx.speaker, push: 'in' };
      else if (question) shot = { type: 'close', subject: ctx.speaker, push: 'in' };
      else if (cast.length > 1 && changed) shot = { type: 'ots', subject: ctx.speaker, partner: partnerOf(ctx.speaker), push: null };
      else if (cast.length > 1 && this.count % 5 === 4) shot = { type: 'side', subject: ctx.speaker, push: null };
      else if (cast.length > 1 && this.count % 7 === 6) shot = { type: 'two', subject: ctx.speaker, push: 'out' };
      else shot = { type: this.last?.type === 'medium' && !changed ? 'close' : 'medium', subject: ctx.speaker, push: null };
    } else shot = { type: 'wide', subject: null, push: null };

    if (shot.type === 'ots' && !shot.partner) shot.type = 'medium';
    if (shot.type === 'two' && cast.length < 2) shot.type = 'medium';
    if (!shot.subject && !['wide'].includes(shot.type)) shot.type = 'wide';
    shot.partner = shot.partner || partnerOf(shot.subject);
    // evita o mesmo plano muitas vezes seguidas (fica robótico)
    if (this.last && this.last.type === shot.type && this.last.subject === shot.subject) this.same++; else this.same = 0;
    if (this.same >= 3 && !ctx.cam) { shot.type = shot.type === 'close' ? 'medium' : 'close'; this.same = 0; }
    // corte seco quando muda de pessoa; movimento suave quando é a mesma
    shot.cut = !!(this.last && this.last.subject !== shot.subject && shot.type !== 'wide');
    if (ctx.speaker && !['player', 'thought'].includes(ctx.speaker)) this.lastSpeaker = ctx.speaker;
    this.last = shot; this.count++;
    return shot;
  }
}
