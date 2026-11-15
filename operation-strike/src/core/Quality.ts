// Níveis de qualidade gráfica e resolução adaptável.
// O motor é criado sem adaptToDeviceRatio; aqui decidimos quantos pixels reais renderizar.
import type { Engine } from './babylon';
import type { QualityMode } from './Settings';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  /** Densidade de pixels máxima (1 = resolução CSS). */
  maxDpr: number;
  /** Densidade mínima aceita no modo automático. */
  minDpr: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Tamanho das texturas procedurais. */
  textureSize: number;
  /** Máximo de partículas por efeito. */
  particles: number;
  /** Quantidade máxima de marcas de tiro no cenário. */
  decals: number;
  /** Detalhes extras do cenário (cabos, entulho, plantas). */
  props: boolean;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: { maxDpr: 1, minDpr: 0.6, shadows: false, shadowMapSize: 0, textureSize: 512, particles: 8, decals: 24, props: false },
  medium: { maxDpr: 1.35, minDpr: 0.75, shadows: true, shadowMapSize: 1024, textureSize: 512, particles: 16, decals: 48, props: true },
  high: { maxDpr: 2, minDpr: 0.9, shadows: true, shadowMapSize: 2048, textureSize: 512, particles: 28, decals: 96, props: true }
};

export function detectDefaultLevel(): QualityLevel {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (!mobile && mem >= 4) return 'high';
  if (mem <= 2 || cores <= 4) return 'low';
  return 'medium';
}

export class Quality {
  mode: QualityMode;
  level: QualityLevel;
  private dpr: number;
  private renderDpr = 1;
  private samples: number[] = [];
  private timer = 0;

  constructor(private engine: Engine, mode: QualityMode) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.mode = mode;
    this.level = mode === 'auto' ? detectDefaultLevel() : mode;
    this.applyLevel();
  }

  get preset(): QualityPreset {
    return QUALITY[this.level];
  }

  /** Troca o modo. Retorna true se o nível efetivo mudou (cena precisa ser reconfigurada). */
  setMode(mode: QualityMode): boolean {
    const prev = this.level;
    this.mode = mode;
    this.level = mode === 'auto' ? detectDefaultLevel() : mode;
    this.applyLevel();
    return prev !== this.level;
  }

  private applyLevel(): void {
    this.renderDpr = Math.min(this.dpr, this.preset.maxDpr);
    this.applyScaling();
  }

  private applyScaling(): void {
    this.engine.setHardwareScalingLevel(1 / Math.max(0.5, this.renderDpr));
  }

  /** Chamado a cada quadro. No modo automático, ajusta a resolução pelo FPS medido. */
  update(dt: number, fpsTarget: number): void {
    if (dt <= 0) return;
    this.samples.push(1 / dt);
    if (this.samples.length > 90) this.samples.shift();
    if (this.mode !== 'auto') return;
    this.timer += dt;
    if (this.timer < 2) return;
    this.timer = 0;
    const fps = this.averageFps;
    const target = fpsTarget || 60;
    const p = this.preset;
    const minDpr = Math.min(this.dpr, p.minDpr);
    const maxDpr = Math.min(this.dpr, p.maxDpr);
    if (fps < target * 0.75 && this.renderDpr > minDpr) {
      this.renderDpr = Math.max(minDpr, this.renderDpr - 0.15);
      this.applyScaling();
    } else if (fps > target * 0.95 && this.renderDpr < maxDpr) {
      this.renderDpr = Math.min(maxDpr, this.renderDpr + 0.1);
      this.applyScaling();
    }
  }

  get averageFps(): number {
    if (!this.samples.length) return 60;
    let s = 0;
    for (const f of this.samples) s += f;
    return s / this.samples.length;
  }

  get resolutionScale(): number {
    return this.renderDpr;
  }
}
