// Regras de partida por modo.
import type { GameMode } from '../sim/types';

export interface RoundRules {
  mode: GameMode;
  maxRounds: number;
  winRounds: number;
  /** Troca de lados após esta rodada. */
  halfAt: number;
  freezeTime: number;
  roundTime: number;
  bombTime: number;
  plantTime: number;
  defuseTime: number;
  defuseKitTime: number;
  buyTime: number;
  roundEndTime: number;
  startMoney: number;
  maxMoney: number;
  friendlyFire: boolean;
  /** Treino: sem rodadas, renasce, dinheiro infinito. */
  training: boolean;
}

/** Mata-mata em equipe: opções de duração e limite de abates. */
export const TDM_TIMES = [5, 10, 15];
export const TDM_KILLS = [25, 50, 100];
/** Segundos até renascer e de proteção depois de renascer. */
export const TDM_RESPAWN = 3;
export const TDM_PROTECTION = 3;

export const RULES: Record<GameMode, RoundRules> = {
  competitive: {
    mode: 'competitive', maxRounds: 24, winRounds: 13, halfAt: 12, freezeTime: 12, roundTime: 115, bombTime: 40,
    plantTime: 3.2, defuseTime: 10, defuseKitTime: 5, buyTime: 25, roundEndTime: 6, startMoney: 800, maxMoney: 16000,
    friendlyFire: false, training: false
  },
  casual: {
    mode: 'casual', maxRounds: 15, winRounds: 8, halfAt: 7, freezeTime: 8, roundTime: 120, bombTime: 40,
    plantTime: 3.2, defuseTime: 10, defuseKitTime: 5, buyTime: 40, roundEndTime: 5, startMoney: 1000, maxMoney: 10000,
    friendlyFire: false, training: false
  },
  tdm: {
    mode: 'tdm', maxRounds: 1, winRounds: 50, halfAt: 99, freezeTime: 0, roundTime: 600, bombTime: 40,
    plantTime: 3.2, defuseTime: 10, defuseKitTime: 5, buyTime: 99999, roundEndTime: 3, startMoney: 16000, maxMoney: 16000,
    friendlyFire: false, training: false
  },
  x1: {
    mode: 'x1', maxRounds: 9, winRounds: 5, halfAt: 99, freezeTime: 3, roundTime: 90, bombTime: 40,
    plantTime: 3.2, defuseTime: 10, defuseKitTime: 5, buyTime: 0, roundEndTime: 3, startMoney: 0, maxMoney: 0,
    friendlyFire: false, training: false
  },
  br: {
    mode: 'br', maxRounds: 1, winRounds: 1, halfAt: 99, freezeTime: 6, roundTime: 600, bombTime: 40,
    plantTime: 3.2, defuseTime: 10, defuseKitTime: 5, buyTime: 0, roundEndTime: 8, startMoney: 0, maxMoney: 0,
    friendlyFire: true, training: false
  },
  training: {
    mode: 'training', maxRounds: 1, winRounds: 1, halfAt: 99, freezeTime: 0, roundTime: 99999, bombTime: 40,
    plantTime: 3.2, defuseTime: 10, defuseKitTime: 5, buyTime: 99999, roundEndTime: 3, startMoney: 16000, maxMoney: 16000,
    friendlyFire: false, training: true
  }
};
