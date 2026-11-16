// Níveis de qualidade gráfica (Baixa, Média, Alta, Ultra/4K) e resolução dinâmica.
// O motor é criado sem adaptToDeviceRatio; aqui decidimos quantos pixels reais renderizar.
// Resolução dinâmica: se o FPS cair, a resolução interna baixa sozinha (e sobe de volta quando sobra desempenho),
// em qualquer nível — o celular nunca é obrigado a renderizar em 4K se isso travar.
import type { Engine } from './babylon';
import type { QualityMode } from './Settings';

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  label: string;
  /** Densidade de pixels máxima (1 = resolução CSS). */
  maxDpr: number;
  /** Densidade mínima aceita pela resolução dinâmica. */
  minDpr: number;
  /** Limite de pixels renderizados (Ultra = 3840 x 2160). */
  maxPixels: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Tamanho das texturas procedurais do cenário. */
  textureSize: number;
  /** Máximo de partículas por efeito. */
  particles: number;
  /** Quantidade máxima de marcas de tiro no cenário. */
  decals: number;
  /** Detalhes extras do cenário (janelas, cabos, passarelas). */
  props: boolean;
  /** Pós-processamento: nenhum, só anti-serrilhado, ou completo (bloom, tone mapping, nitidez). */
  post: 'none' | 'fxaa' | 'full';
  /** Oclusão de ambiente (SSAO), só onde o WebGL2 suporta. */
  ssao: boolean;
  /** Materiais PBR com mapas de relevo no cenário e nos personagens. */
  pbr: boolean;
  /** Luzes dinâmicas (clarão dos tiros, explosões). */
  dynamicLights: boolean;
  /** Distância (m) a partir da qual personagens usam animação simplificada (LOD). */
  characterLod: number;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: { label: 'Baixa', maxDpr: 1, minDpr: 0.55, maxPixels: 1920 * 1080, shadows: false, shadowMapSize: 0, textureSize: 512, particles: 8, decals: 24, props: false, post: 'none', ssao: false, pbr: false, dynamicLights: false, characterLod: 30 },
  medium: { label: 'Média', maxDpr: 1.35, minDpr: 0.7, maxPixels: 1920 * 1080, shadows: true, shadowMapSize: 1024, textureSize: 512, particles: 16, decals: 48, props: true, post: 'fxaa', ssao: false, pbr: false, dynamicLights: false, characterLod: 45 },
  high: { label: 'Alta', maxDpr: 2, minDpr: 0.85, maxPixels: 2560 * 1440, shadows: true, shadowMapSize: 2048, textureSize: 1024, particles: 28, decals: 96, props: true, post: 'full', ssao: false, pbr: true, dynamicLights: true, characterLod: 70 },
  ultra: { label: 'Ultra / 4K', maxDpr: 3, minDpr: 1, maxPixels: 3840 * 2160, shadows: true, shadowMapSize: 4096, textureSize: 1024, particles: 48, decals: 160, props: true, post: 'full', ssao: true, pbr: true, dynamicLights: true, characterLod: 110 }
};

export function isMobile(): boolean {
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

export function detectDefaultLevel(): QualityLevel {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (!isMobile() && mem >= 4) return 'high';
  if (mem <= 2 || cores <= 4) return 'low';
  return 'medium';
}

export class Quality {
  mode: QualityMode;
  level: QualityLevel;
  /** Resolução dinâmica ligada (padrão). */
  dynamic = true;
  private dpr: number;
  private renderDpr = 1;
  private samples: number[] = [];
  private timer = 0;
  private lowStreak = 0;
  private mobile = isMobile();

  constructor(private engine: Engine, mode: QualityMode) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.mode = mode;
    this.level = mode === 'auto' ? detectDefaultLevel() : mode;
    this.applyLevel();
    window.addEventListener('resize', () => this.applyScaling());
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

  /** Densidade máxima respeitando o limite de pixels (ex.: 4K no Ultra). */
  private maxAllowed(): number {
    const p = this.preset;
    const css = Math.max(1, window.innerWidth * window.innerHeight);
    // no celular nunca força 4K: o Ultra fica limitado a 1440p (a resolução dinâmica ajusta o resto)
    const maxPixels = this.mobile ? Math.min(p.maxPixels, 2560 * 1440) : p.maxPixels;
    const byPixels = Math.sqrt(maxPixels / css);
    return Math.max(0.5, Math.min(this.dpr * (this.level === 'ultra' ? 1.5 : 1), p.maxDpr, byPixels));
  }

  private applyLevel(): void {
    this.renderDpr = this.maxAllowed();
    this.applyScaling();
  }

  private applyScaling(): void {
    this.renderDpr = Math.min(this.renderDpr, this.maxAllowed());
    this.engine.setHardwareScalingLevel(1 / Math.max(0.5, this.renderDpr));
  }

  /** Chamado a cada quadro: ajusta a resolução pelo FPS medido. */
  update(dt: number, fpsTarget: number): void {
    if (dt <= 0) return;
    this.samples.push(1 / dt);
    if (this.samples.length > 90) this.samples.shift();
    // celular: resolução dinâmica sempre ativa
    if (!this.dynamic && this.mode !== 'auto' && !this.mobile) return;
    this.timer += dt;
    if (this.timer < 1.5) return;
    this.timer = 0;
    const fps = this.averageFps;
    const target = fpsTarget || 60;
    const p = this.preset;
    const minDpr = Math.min(this.dpr, p.minDpr), maxDpr = this.maxAllowed();
    if (fps < target * 0.78 && this.renderDpr > minDpr) {
      this.renderDpr = Math.max(minDpr, this.renderDpr - 0.15);
      this.applyScaling();
    } else if (fps > target * 0.95 && this.renderDpr < maxDpr) {
      this.renderDpr = Math.min(maxDpr, this.renderDpr + 0.1);
      this.applyScaling();
    }
    // no modo automático, se nem a resolução mínima segura o FPS, desce um nível de qualidade
    if (this.mode === 'auto' && fps < target * 0.6 && this.renderDpr <= minDpr + 0.01) {
      if (++this.lowStreak >= 3 && this.level !== 'low') {
        this.lowStreak = 0;
        this.level = this.level === 'ultra' ? 'high' : this.level === 'high' ? 'medium' : 'low';
        this.applyLevel();
        this.onAutoDowngrade?.(this.level);
      }
    } else this.lowStreak = 0;
  }

  /** Avisado quando o modo automático reduz o nível (a cena é reconfigurada). */
  onAutoDowngrade: ((level: QualityLevel) => void) | null = null;

  get averageFps(): number {
    if (!this.samples.length) return 60;
    let s = 0;
    for (const f of this.samples) s += f;
    return s / this.samples.length;
  }

  get resolutionScale(): number {
    return this.renderDpr;
  }

  /** Resolução interna atual (para mostrar ao jogador). */
  get renderSize(): { w: number; h: number } {
    return { w: this.engine.getRenderWidth(), h: this.engine.getRenderHeight() };
  }
}
