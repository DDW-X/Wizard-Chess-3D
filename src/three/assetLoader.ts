import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import type { PieceColor, PieceType } from '../game/chessEngine';
import type { FactionTheme } from '../game/physicsKinematics';
import type { SanctumMaterialLibrary } from './materials';
import type { PieceActor } from './piecesBuilder';

export interface PBRMaterialChannelSet {
  albedoMap: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  metalnessMap: THREE.Texture;
  aoMap: THREE.Texture;
  displacementMap?: THREE.Texture;
}

export interface ExternalModelConfig {
  theme: FactionTheme;
  pieceType: PieceType;
  glbUrl: string;
}

const _instanceDummy = new THREE.Object3D();
const _zeroScaleMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Ensures a BufferGeometry has a secondary `uv2` attribute (copied from `uv`)
 * and computed vertex tangents so Three.js `aoMap` (Ambient Occlusion) and
 * tangent-space `normalMap` render with maximum fidelity.
 */
export function prepareGeometryForPBR(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }
  const uv = geometry.attributes.uv;
  if (uv && !geometry.attributes.uv2) {
    geometry.setAttribute('uv2', uv.clone());
  }
  if (uv && geometry.index && !geometry.attributes.tangent) {
    try {
      geometry.computeTangents();
    } catch {
      // Non-indexed or degenerate UV triangles safely skip tangent computation
    }
  }
  return geometry;
}

/**
 * Safely disposes a Three.js Object3D hierarchy, releasing any non-shared
 * geometries or transient materials without leaking WebGL buffers.
 */
export function disposeObjectHierarchy(
  root: THREE.Object3D,
  sharedGeometries?: Set<THREE.BufferGeometry>,
  sharedMaterials?: Set<THREE.Material>
): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      if (mesh.geometry && (!sharedGeometries || !sharedGeometries.has(mesh.geometry))) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!sharedMaterials || !sharedMaterials.has(m)) {
            m.dispose();
          }
        }
      }
    }
  });
}

/**
 * Enterprise Asset & Memory Manager with THREE.GLTFLoader, DRACOLoader, and KTX2Loader
 * support. Maps high-res 5-channel PBR materials (Albedo, Normal, Roughness, Metalness, AO)
 * onto loaded `.glb` meshes or procedural high-poly fallback rigs, and manages geometry caching.
 */
export class ChessAssetManager {
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private ktx2Loader: KTX2Loader | null = null;
  private loadedGlbCache = new Map<string, THREE.Group>();
  private sharedGeometries = new Set<THREE.BufferGeometry>();
  private sharedMaterials = new Set<THREE.Material>();
  private maxAnisotropy = 4;

  constructor(renderer?: THREE.WebGLRenderer) {
    THREE.Cache.enabled = true;

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.dracoLoader.setDecoderConfig({ type: 'js' });

    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    if (renderer) {
      this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy() || 4;
      try {
        this.ktx2Loader = new KTX2Loader();
        this.ktx2Loader.setTranscoderPath(
          'https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/libs/basis/'
        );
        this.ktx2Loader.detectSupport(renderer);
        this.gltfLoader.setKTX2Loader(this.ktx2Loader);
      } catch {
        // KTX2 optional if Basis transcoder is offline
      }
    }
  }

  public registerSharedGeometry<T extends THREE.BufferGeometry>(geo: T): T {
    prepareGeometryForPBR(geo);
    this.sharedGeometries.add(geo);
    return geo;
  }

  public registerSharedMaterial<T extends THREE.Material>(mat: T): T {
    this.sharedMaterials.add(mat);
    return mat;
  }

  /**
   * Loads an external high-poly `.glb` model with DRACO decompression,
   * automatically mapping the faction's PBR materials (Armor, Cloth, Skin, Trim, Plume)
   * onto sub-meshes based on mesh/material naming conventions.
   */
  public async loadPieceGLB(
    url: string,
    theme: FactionTheme,
    pieceType: PieceType,
    color: PieceColor,
    materials: SanctumMaterialLibrary
  ): Promise<THREE.Group | null> {
    const cacheKey = `${theme}_${pieceType}_${url}`;
    let templateGroup = this.loadedGlbCache.get(cacheKey);

    if (!templateGroup) {
      try {
        const gltf = await new Promise<GLTF>((resolve, reject) => {
          this.gltfLoader.load(url, resolve, undefined, reject);
        });
        templateGroup = gltf.scene;
        templateGroup.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.geometry) {
            prepareGeometryForPBR(mesh.geometry);
            this.sharedGeometries.add(mesh.geometry);
          }
        });
        this.loadedGlbCache.set(cacheKey, templateGroup);
      } catch {
        return null;
      }
    }

    const instance = templateGroup.clone(true);
    this.applyFactionPBRToHierarchy(instance, theme, color, materials);
    return instance;
  }

  /**
   * Maps extreme high-res PBR materials (Albedo, Normal, Roughness, Metalness, AO)
   * onto a loaded GLTF hierarchy or composite procedural rig.
   */
  public applyFactionPBRToHierarchy(
    root: THREE.Object3D,
    theme: FactionTheme,
    color: PieceColor,
    materials: SanctumMaterialLibrary
  ): void {
    const isWhite = color === 'w';

    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (mesh.geometry) {
        prepareGeometryForPBR(mesh.geometry);
      }

      const tag = (mesh.name || mesh.userData?.materialSlot || '').toLowerCase();
      if (tag.includes('eye_iris')) {
        mesh.material = materials.eyeIrisMat;
      } else if (tag.includes('eye_sclera')) {
        mesh.material = materials.eyeScleraMat;
      } else if (tag.includes('skin') || tag.includes('face')) {
        mesh.material = isWhite ? materials.sculptedSkinLight : materials.sculptedSkinDark;
      } else if (tag.includes('chainmail')) {
        mesh.material = isWhite ? materials.crusaderChainmailLight : materials.crusaderChainmailDark;
      } else if (tag.includes('cloth') || tag.includes('tunic') || tag.includes('plume')) {
        if (theme === 'spartan') {
          mesh.material = isWhite ? materials.spartanCrimsonPlume : materials.spartanBlackPlume;
        } else if (theme === 'roman') {
          mesh.material = isWhite ? materials.romanCrimsonTunic : materials.romanPurpleTunic;
        } else {
          mesh.material = isWhite ? materials.crusaderWovenSurcoatLight : materials.crusaderWovenSurcoatDark;
        }
      } else if (tag.includes('trim') || tag.includes('gold') || tag.includes('hilt')) {
        mesh.material = theme === 'roman' ? materials.romanImperialGold : materials.goldFiligree;
      } else if (tag.includes('blade') || tag.includes('steel')) {
        mesh.material = materials.weaponForgedSteel;
      } else if (tag.includes('leather') || tag.includes('wood')) {
        mesh.material = materials.spartanWornLeather;
      }
    });
  }

  public getSharedGeometries(): Set<THREE.BufferGeometry> {
    return this.sharedGeometries;
  }

  public getSharedMaterials(): Set<THREE.Material> {
    return this.sharedMaterials;
  }

  public getMaxAnisotropy(): number {
    return this.maxAnisotropy;
  }

  public dispose(): void {
    this.dracoLoader.dispose();
    this.ktx2Loader?.dispose();
    this.sharedGeometries.forEach((g) => g.dispose());
    this.sharedGeometries.clear();
    this.loadedGlbCache.clear();
  }
}

/**
 * WebGL Draw-Call Optimizer: Uses `THREE.InstancedMesh` to render identical repeated
 * Pawn base Pedestals & Plinth Rings across all 16 Pawns on the board in just 2 draw calls,
 * while seamlessly hiding the instanced plinth for any Pawn currently undergoing a capture
 * or morph animation.
 */
export class PawnInstancedCohortManager {
  public whitePlinthInstanced: THREE.InstancedMesh;
  public blackPlinthInstanced: THREE.InstancedMesh;
  public brassRingInstanced: THREE.InstancedMesh;

  private plinthGeo: THREE.LatheGeometry;
  private ringGeo: THREE.TorusGeometry;

  constructor(scene: THREE.Scene, materials: SanctumMaterialLibrary) {
    const points = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.37, 0.0),
      new THREE.Vector2(0.39, 0.04),
      new THREE.Vector2(0.35, 0.09),
      new THREE.Vector2(0.36, 0.12),
      new THREE.Vector2(0.3, 0.16),
      new THREE.Vector2(0.25, 0.21),
      new THREE.Vector2(0.0, 0.21),
    ];
    this.plinthGeo = new THREE.LatheGeometry(points, 32);
    prepareGeometryForPBR(this.plinthGeo);

    this.ringGeo = new THREE.TorusGeometry(0.355, 0.017, 12, 32);
    this.ringGeo.rotateX(Math.PI / 2);
    this.ringGeo.translate(0, 0.09, 0);
    prepareGeometryForPBR(this.ringGeo);

    this.whitePlinthInstanced = new THREE.InstancedMesh(
      this.plinthGeo,
      materials.marblePolished,
      8
    );
    this.whitePlinthInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.whitePlinthInstanced.castShadow = true;
    this.whitePlinthInstanced.receiveShadow = true;
    this.whitePlinthInstanced.frustumCulled = false;

    this.blackPlinthInstanced = new THREE.InstancedMesh(
      this.plinthGeo,
      materials.obsidianGlass,
      8
    );
    this.blackPlinthInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blackPlinthInstanced.castShadow = true;
    this.blackPlinthInstanced.receiveShadow = true;
    this.blackPlinthInstanced.frustumCulled = false;

    this.brassRingInstanced = new THREE.InstancedMesh(
      this.ringGeo,
      materials.goldFiligree,
      16
    );
    this.brassRingInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.brassRingInstanced.frustumCulled = false;

    scene.add(this.whitePlinthInstanced);
    scene.add(this.blackPlinthInstanced);
    scene.add(this.brassRingInstanced);
  }

  /**
   * Updates the instanced materials when the user swaps Faction Themes.
   */
  public syncFactionMaterials(theme: FactionTheme, materials: SanctumMaterialLibrary): void {
    if (theme === 'spartan') {
      this.whitePlinthInstanced.material = materials.spartanBronze;
      this.blackPlinthInstanced.material = materials.spartanDarkBronze;
      this.brassRingInstanced.material = materials.goldFiligree;
    } else if (theme === 'roman') {
      this.whitePlinthInstanced.material = materials.romanPolishedSteel;
      this.blackPlinthInstanced.material = materials.romanDarkSteel;
      this.brassRingInstanced.material = materials.romanImperialGold;
    } else {
      this.whitePlinthInstanced.material = materials.marblePolished;
      this.blackPlinthInstanced.material = materials.obsidianGlass;
      this.brassRingInstanced.material = materials.goldFiligree;
    }
  }

  /**
   * Synchronizes all active Pawn world positions into the `THREE.InstancedMesh` buffers.
   */
  public updateFromActors(pieceMap: Map<string, PieceActor>): void {
    let wIdx = 0;
    let bIdx = 0;
    let rIdx = 0;

    pieceMap.forEach((actor) => {
      if (actor.type !== 'p') return;
      _instanceDummy.position.copy(actor.root.position);
      _instanceDummy.rotation.copy(actor.root.rotation);
      _instanceDummy.scale.copy(actor.root.scale);
      _instanceDummy.updateMatrix();

      if (actor.color === 'w' && wIdx < 8) {
        this.whitePlinthInstanced.setMatrixAt(wIdx++, _instanceDummy.matrix);
      } else if (actor.color === 'b' && bIdx < 8) {
        this.blackPlinthInstanced.setMatrixAt(bIdx++, _instanceDummy.matrix);
      }
      if (rIdx < 16) {
        this.brassRingInstanced.setMatrixAt(rIdx++, _instanceDummy.matrix);
      }
    });

    while (wIdx < 8) {
      this.whitePlinthInstanced.setMatrixAt(wIdx++, _zeroScaleMatrix);
    }
    while (bIdx < 8) {
      this.blackPlinthInstanced.setMatrixAt(bIdx++, _zeroScaleMatrix);
    }
    while (rIdx < 16) {
      this.brassRingInstanced.setMatrixAt(rIdx++, _zeroScaleMatrix);
    }

    this.whitePlinthInstanced.instanceMatrix.needsUpdate = true;
    this.blackPlinthInstanced.instanceMatrix.needsUpdate = true;
    this.brassRingInstanced.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.plinthGeo.dispose();
    this.ringGeo.dispose();
    this.whitePlinthInstanced.dispose();
    this.blackPlinthInstanced.dispose();
    this.brassRingInstanced.dispose();
  }
}
