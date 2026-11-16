// Ponto único de importação do Babylon.js.
// Importamos apenas os módulos usados (em vez do pacote inteiro) para reduzir o download no celular.
// Ao usar um recurso novo do Babylon, adicione-o aqui.
export { Engine } from '@babylonjs/core/Engines/engine';
export { Scene } from '@babylonjs/core/scene';
export { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
export { Mesh } from '@babylonjs/core/Meshes/mesh';
export { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
export { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
export { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
export { TransformNode } from '@babylonjs/core/Meshes/transformNode';
export { CreateBox, CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder';
export { CreateCylinder, CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
export { CreateCapsuleVertexData } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
export { CreateSphere, CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
export { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
export { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
export { Texture } from '@babylonjs/core/Materials/Textures/texture';
export { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
export { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
export { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
export { Camera } from '@babylonjs/core/Cameras/camera';
export { Skeleton } from '@babylonjs/core/Bones/skeleton';
export { Bone } from '@babylonjs/core/Bones/bone';
export { Space } from '@babylonjs/core/Maths/math.axis';
export { PointLight } from '@babylonjs/core/Lights/pointLight';
export { SpotLight } from '@babylonjs/core/Lights/spotLight';
export { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
export { RawCubeTexture } from '@babylonjs/core/Materials/Textures/rawCubeTexture';
export { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
export { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
export { AssetContainer } from '@babylonjs/core/assetContainer';
export type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
export { AnimationGroupMask, AnimationGroupMaskMode } from '@babylonjs/core/Animations/animationGroupMask';
export type { Material } from '@babylonjs/core/Materials/material';
export type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
export { SSRRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline';
export { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
export { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
export { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
export { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
export { ProceduralTexture } from '@babylonjs/core/Materials/Textures/Procedurals/proceduralTexture';
export { ShaderStore } from '@babylonjs/core/Engines/shaderStore';

// Módulos de efeito colateral (registram funcionalidades na cena)
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Particles/particleSystemComponent';
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Materials/Textures/Procedurals/proceduralTextureSceneComponent';
import '@babylonjs/core/Rendering/geometryBufferRendererSceneComponent';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
