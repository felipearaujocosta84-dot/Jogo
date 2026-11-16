// Placar 5v5 (Tab / botão PLACAR) com abates, mortes, assistências, MVPs, pontos, dinheiro dos aliados e ping.
import type { PlayerView, RoundView, Team } from '../sim/types';
import { esc } from './Hud';

const $ = (id: string) => document.getElementById(id)!;

export class Scoreboard {
  open = false;
  private lastKey = '';

  toggle(v?: boolean): void {
    this.open = v ?? !this.open;
    $('scoreboard').classList.toggle('hidden', !this.open);
    this.lastKey = '';
  }

  update(players: PlayerView[], round: RoundView, localId: string, localTeam: Team, online: boolean): void {
    if (!this.open) return;
    const key = JSON.stringify(players.map(p => [p.id, p.kills, p.deaths, p.assists, p.alive, p.money, p.ping, p.mvps, p.score])) + round.scoreT + round.scoreCT;
    if (key === this.lastKey) return;
    this.lastKey = key;
    $('sbScoreT').textContent = String(round.scoreT);
    $('sbScoreCT').textContent = String(round.scoreCT);
    $('sbInfo').textContent = `${round.mode === 'competitive' ? 'COMPETITIVO' : round.mode === 'casual' ? 'CASUAL' : round.mode === 'tdm' ? 'MATA-MATA EM EQUIPE' : 'TREINO'} · ${round.mapId.replace('_', ' ').toUpperCase()} · ${round.mode === 'tdm' ? `META ${round.winRounds} ABATES` : `RODADA ${round.number}`}`;
    for (const team of ['T', 'CT'] as Team[]) {
      const list = players.filter(p => p.team === team).sort((a, b) => b.score - a.score || b.kills - a.kills);
      const rows = list
        .map(p => {
          const money = team === localTeam ? '$' + p.money : '';
          const status = p.alive ? '' : '✕';
          return `<tr class="${p.id === localId ? 'me' : ''} ${p.alive ? '' : 'dead'}"><td>${status}</td><td class="n">${esc(p.name)}${p.bomb && team === localTeam ? ' 💣' : ''}${!p.connected ? ' (caiu)' : ''}</td><td>${money}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.assists}</td><td>${'★'.repeat(Math.min(p.mvps, 3))}${p.mvps > 3 ? p.mvps : ''}</td><td>${p.score}</td><td>${online ? (p.bot ? 'BOT' : p.ping) : p.bot ? 'BOT' : ''}</td></tr>`;
        })
        .join('');
      $('sb' + team).innerHTML = `<tr class="h"><th></th><th class="n">${team === 'T' ? 'TERRORISTAS' : 'CONTRATERRORISTAS'}</th><th>$</th><th>A</th><th>M</th><th>AS</th><th>MVP</th><th>PTS</th><th>${online ? 'PING' : ''}</th></tr>${rows}`;
    }
  }
}
