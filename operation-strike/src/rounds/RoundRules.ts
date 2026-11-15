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
  training: {
    mode: 'training', maxRounds: 1, winRounds: 1, halfAt: 99, freezeTime: 0, roundTime: 99999, bombTime: 40,
    plantTime: 3.2, defuseTime: 10, defuseKitTime: 5, buyTime: 99999, roundEndTime: 3, startMoney: 16000, maxMoney: 16000,
    friendlyFire: false, training: true
  }
};
