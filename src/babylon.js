// Ponto único de importação do Babylon.js.
// Importamos apenas os módulos usados (em vez do pacote inteiro) para reduzir muito
// o tamanho do download no celular. Ao usar um recurso novo do Babylon, adicione-o aqui.
export { Engine } from '@babylonjs/core/Engines/engine';
export { Scene } from '@babylonjs/core/scene';
export { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector';
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
export { Plane } from '@babylonjs/core/Maths/math.plane';
export { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
export { Mesh } from '@babylonjs/core/Meshes/mesh';
export { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
export { TransformNode } from '@babylonjs/core/Meshes/transformNode';
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
export { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
export { Texture } from '@babylonjs/core/Materials/Textures/texture';
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
export { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
export { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
export { Camera } from '@babylonjs/core/Cameras/camera';
export { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';

// módulos de efeito colateral (registram funcionalidades na cena/malhas)
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Particles/particleSystemComponent';
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Culling/ray';
export { Skeleton } from '@babylonjs/core/Bones/skeleton';
export { Bone } from '@babylonjs/core/Bones/bone';
export { Space } from '@babylonjs/core/Maths/math.axis';
