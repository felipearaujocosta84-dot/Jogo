// "Janela" de visão: objetos (árvores, casas, cenários) entre a câmera e o herói ficam
// transparentes com pontilhado (dithering), então o jogador nunca some atrás deles.
// Implementado como plugin de material (só alguns cálculos no shader — barato no celular).
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { Vector3 } from '../babylon.js';

export const OCCLUSION = {
  player: new Vector3(0, 0, 0),
  cam: new Vector3(0, 50, 0),
  radius: 2.8
};

class OccluderPlugin extends MaterialPluginBase {
  constructor(material) {
    super(material, 'Occluder', 200, { OCCLUDER: false });
    this._enable(true);
  }
  prepareDefines(defines) { defines.OCCLUDER = true; }
  getClassName() { return 'OccluderPlugin'; }
  getUniforms() {
    return {
      ubo: [
        { name: 'occPlayer', size: 3, type: 'vec3' },
        { name: 'occCam', size: 3, type: 'vec3' },
        { name: 'occRadius', size: 1, type: 'float' }
      ],
      fragment: `#ifdef OCCLUDER
        uniform vec3 occPlayer;
        uniform vec3 occCam;
        uniform float occRadius;
      #endif`
    };
  }
  bindForSubMesh(ubo) {
    ubo.updateVector3('occPlayer', OCCLUSION.player);
    ubo.updateVector3('occCam', OCCLUSION.cam);
    ubo.updateFloat('occRadius', OCCLUSION.radius);
  }
  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_MAIN_BEGIN: `
      #ifdef OCCLUDER
      {
        vec3 seg = occPlayer - occCam;
        float L = length(seg);
        vec3 dir = seg / L;
        float t = dot(vPositionW - occCam, dir);
        if (t > 0.0 && t < L - 0.6) {
          float d = length(vPositionW - (occCam + dir * t));
          // o "cone" alarga perto do herói
          float rad = occRadius * (0.55 + 0.45 * clamp(t / L, 0.0, 1.0));
          if (d < rad) {
            float k = d / rad;
            vec2 fc = floor(gl_FragCoord.xy);
            float bayer = mod(fc.x + 2.0 * fc.y, 4.0) * 0.25 + mod(floor(fc.x * 0.5) + 2.0 * floor(fc.y * 0.5), 4.0) * 0.0625;
            if (bayer > k * k * 0.95) discard;
          }
        }
      }
      #endif
      `
    };
  }
}

export function addOccluder(material) {
  if (!material || material._occluder) return;
  material._occluder = new OccluderPlugin(material);
}
