// Pós-processamento por nível de qualidade.
//  Média: anti-serrilhado FXAA.
//  Alta: FXAA + bloom suave + tone mapping ACES + contraste/exposição + vinheta leve.
//  Ultra: tudo da Alta + nitidez + oclusão de ambiente (SSAO2, só com WebGL2).
// Tudo é recriado quando o nível muda e desligado na Baixa (nenhum custo extra no celular fraco).
import {
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  SSAO2RenderingPipeline,
  SSRRenderingPipeline,
  type Camera,
  type Scene
} from './babylon';
import type { QualityPreset } from './Quality';

export class PostFx {
  private pipeline: DefaultRenderingPipeline | null = null;
  private ssao: SSAO2RenderingPipeline | null = null;
  private ssr: SSRRenderingPipeline | null = null;
  ssaoActive = false;

  constructor(private scene: Scene, private camera: Camera) {}

  apply(p: QualityPreset): void {
    this.dispose();
    if (p.post === 'none') return;
    const pipe = new DefaultRenderingPipeline('postfx', false, this.scene, [this.camera]);
    pipe.fxaaEnabled = true;
    if (p.post === 'full') {
      pipe.imageProcessingEnabled = true;
      const ip = pipe.imageProcessing;
      ip.toneMappingEnabled = true;
      ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
      ip.exposure = 1.08;
      ip.contrast = 1.12;
      ip.vignetteEnabled = true;
      ip.vignetteWeight = 1.6;
      ip.vignetteStretch = 0.4;
      pipe.bloomEnabled = true;
      pipe.bloomThreshold = 0.82;
      pipe.bloomWeight = 0.22;
      pipe.bloomKernel = 48;
      pipe.bloomScale = 0.5;
      if (p.ssao) {
        pipe.sharpenEnabled = true;
        pipe.sharpen.edgeAmount = 0.25;
      }
    }
    this.pipeline = pipe;
    const webgl2 = (this.scene.getEngine() as unknown as { webGLVersion?: number }).webGLVersion === 2;
    if (p.ssao && webgl2 && SSAO2RenderingPipeline.IsSupported) {
      try {
        const ssao = new SSAO2RenderingPipeline('ssao', this.scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [this.camera]);
        ssao.radius = 1.2;
        ssao.totalStrength = 1.1;
        ssao.base = 0.12;
        ssao.samples = p.ssr ? 16 : 12;
        ssao.maxZ = 120;
        ssao.expensiveBlur = false;
        this.ssao = ssao;
        this.ssaoActive = true;
      } catch (e) {
        console.warn('[gráficos] SSAO indisponível', e);
        this.ssaoActive = false;
      }
    }
    // Ultra Realista: reflexos em espaço de tela (piso polido, vidro, metal, poças)
    if (p.ssr && webgl2) {
      try {
        const ssr = new SSRRenderingPipeline('ssr', this.scene, [this.camera], false);
        ssr.strength = 0.7;
        ssr.reflectivityThreshold = 0.06;
        ssr.thickness = 0.4;
        ssr.maxDistance = 60;
        ssr.step = 1;
        ssr.blurDispersionStrength = 0.03;
        ssr.roughnessFactor = 0.15;
        this.ssr = ssr;
      } catch (e) {
        console.warn('[gráficos] reflexos (SSR) indisponíveis', e);
      }
    }
  }

  dispose(): void {
    this.pipeline?.dispose();
    this.pipeline = null;
    this.ssao?.dispose();
    this.ssao = null;
    this.ssr?.dispose();
    this.ssr = null;
    this.ssaoActive = false;
  }
}
