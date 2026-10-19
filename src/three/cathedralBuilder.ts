import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { SquareCoord } from '../game/chessEngine';
import { SanctumMaterialLibrary } from './materials';

export const TILE_SIZE = 1.25;
export const BOARD_OFFSET = (7 * TILE_SIZE) / 2;

export function boardCoordToWorld(coord: SquareCoord, out: THREE.Vector3): THREE.Vector3 {
  out.set(
    coord.col * TILE_SIZE - BOARD_OFFSET,
    0,
    coord.row * TILE_SIZE - BOARD_OFFSET
  );
  return out;
}

export interface TileInteractive {
  coord: SquareCoord;
  mesh: THREE.Mesh;
  highlightRing: THREE.Mesh;
  attackRing: THREE.Mesh;
  selectedPad: THREE.Mesh;
}

export interface CathedralSceneHandle {
  group: THREE.Group;
  tiles: TileInteractive[][];
  tileClickables: THREE.Mesh[];
  candleLights: THREE.PointLight[];
  godRays: THREE.Mesh[];
  updateVolumetricTime: (timeSec: number) => void;
  dispose: () => void;
}

/**
 * Generates an etched brass coordinate label strip texture (A-H or 8-1)
 */
function createEtchedCoordinateTexture(
  labels: string[],
  isHorizontal: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = isHorizontal ? 1024 : 128;
  canvas.height = isHorizontal ? 128 : 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#b88c32';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#4a3510';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  ctx.font = 'bold 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const count = labels.length;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = isHorizontal ? t * canvas.width : canvas.width * 0.5;
    const y = isHorizontal ? canvas.height * 0.5 : t * canvas.height;

    ctx.fillStyle = 'rgba(255, 236, 179, 0.55)';
    ctx.fillText(labels[i], x + 2, y + 2);
    ctx.fillStyle = '#1c1305';
    ctx.fillText(labels[i], x, y);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a custom GLSL Volumetric God-Ray ShaderMaterial with Fresnel edge soft-fade,
 * vertical atmospheric attenuation, and animated volumetric dust scattering.
 */
function createVolumetricGodRayMaterial(
  colorHex: number,
  baseOpacity: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: baseOpacity },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        vec4 mvPosition = viewMatrix * worldPosition;
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;

      // Smooth procedural 3D turbulence for volumetric light shafts
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        // Soft Fresnel cylindrical edge fade so light shafts have zero hard geometric edges
        float fresnel = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 1.85);
        // Smooth vertical fade at top window source and bottom floor pool
        float verticalFade = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.25, vUv.y);
        // Animated volumetric dust & incense turbulence drifting through the sunbeam
        float wave1 = sin(vWorldPos.y * 0.65 - uTime * 0.45 + vWorldPos.x * 0.5) * 0.5 + 0.5;
        float wave2 = cos(vWorldPos.z * 0.7 + uTime * 0.32 - vWorldPos.y * 0.4) * 0.5 + 0.5;
        float dustScattering = 0.72 + 0.28 * (wave1 * wave2);

        float alpha = uOpacity * fresnel * verticalFade * dustScattering;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function buildGothicCathedralAndBoard(
  mats: SanctumMaterialLibrary,
  isHeadless: boolean
): CathedralSceneHandle {
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  // 1. Sanctuary Floor & Stepped Altar Dais
  const floorGeo = new THREE.CylinderGeometry(36, 36, 0.4, 36);
  const floorMesh = new THREE.Mesh(floorGeo, mats.cathedralFloor);
  floorMesh.position.y = -1.6;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);
  disposables.push(floorGeo);

  const daisStep1Geo = new THREE.BoxGeometry(15.5, 0.5, 15.5);
  const daisStep1 = new THREE.Mesh(daisStep1Geo, mats.cathedralStone);
  daisStep1.position.y = -1.15;
  daisStep1.receiveShadow = true;
  group.add(daisStep1);

  const daisStep2Geo = new THREE.BoxGeometry(12.8, 0.55, 12.8);
  const daisStep2 = new THREE.Mesh(daisStep2Geo, mats.cathedralStone);
  daisStep2.position.y = -0.62;
  daisStep2.receiveShadow = true;
  group.add(daisStep2);

  // Carved Chess Altar Table Frame
  const frameOuterGeo = new THREE.BoxGeometry(11.6, 0.36, 11.6);
  const frameOuter = new THREE.Mesh(frameOuterGeo, mats.boardFrameStone);
  frameOuter.position.y = -0.26;
  frameOuter.receiveShadow = true;
  group.add(frameOuter);

  // Beveled Brass Border Frame
  const brassBorderGeo = new THREE.BoxGeometry(10.82, 0.36, 10.82);
  const brassBorder = new THREE.Mesh(brassBorderGeo, mats.boardBrassTrim);
  brassBorder.position.y = -0.22;
  brassBorder.receiveShadow = true;
  group.add(brassBorder);

  // Deep Ambient Occlusion Groove Substrate directly under the 64 beveled tiles
  const aoGrooveGeo = new THREE.BoxGeometry(10.06, 0.14, 10.06);
  const aoGrooveMesh = new THREE.Mesh(aoGrooveGeo, mats.boardGrooveAO);
  aoGrooveMesh.position.y = -0.095;
  group.add(aoGrooveMesh);

  // Real-Time Planar / Screen-Space Reflection Mirror directly beneath the semi-translucent board tiles!
  // Gives true mirror-like reflections of the 3D chess pieces onto the polished marble & obsidian squares.
  const reflectorGeo = new THREE.PlaneGeometry(9.96, 9.96);
  let boardReflector: Reflector | null = null;
  if (!isHeadless) {
    boardReflector = new Reflector(reflectorGeo, {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x3a404d,
    });
    boardReflector.rotation.x = -Math.PI / 2;
    boardReflector.position.y = -0.014;
    group.add(boardReflector);
  } else {
    const mirrorFallback = new THREE.Mesh(reflectorGeo, mats.obsidianGlass);
    mirrorFallback.rotation.x = -Math.PI / 2;
    mirrorFallback.position.y = -0.014;
    group.add(mirrorFallback);
  }

  disposables.push(
    daisStep1Geo,
    daisStep2Geo,
    frameOuterGeo,
    brassBorderGeo,
    aoGrooveGeo,
    reflectorGeo
  );

  // Etched Coordinate Brass Strips (A–H along White & Black edges, 8–1 along Left & Right flanks)
  const filesTex = createEtchedCoordinateTexture(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    true
  );
  const ranksTex = createEtchedCoordinateTexture(
    ['8', '7', '6', '5', '4', '3', '2', '1'],
    false
  );
  const filesStripGeo = new THREE.PlaneGeometry(10.0, 0.36);
  filesStripGeo.rotateX(-Math.PI / 2);
  const ranksStripGeo = new THREE.PlaneGeometry(0.36, 10.0);
  ranksStripGeo.rotateX(-Math.PI / 2);

  const filesStripMat = new THREE.MeshStandardMaterial({
    map: filesTex,
    roughness: 0.25,
    metalness: 0.86,
  });
  const ranksStripMat = new THREE.MeshStandardMaterial({
    map: ranksTex,
    roughness: 0.25,
    metalness: 0.86,
  });

  const fileStripSouth = new THREE.Mesh(filesStripGeo, filesStripMat);
  fileStripSouth.position.set(0, -0.035, 5.21);
  const fileStripNorth = new THREE.Mesh(filesStripGeo, filesStripMat);
  fileStripNorth.position.set(0, -0.035, -5.21);

  const rankStripWest = new THREE.Mesh(ranksStripGeo, ranksStripMat);
  rankStripWest.position.set(-5.21, -0.035, 0);
  const rankStripEast = new THREE.Mesh(ranksStripGeo, ranksStripMat);
  rankStripEast.position.set(5.21, -0.035, 0);

  group.add(fileStripSouth, fileStripNorth, rankStripWest, rankStripEast);
  disposables.push(
    filesTex,
    ranksTex,
    filesStripGeo,
    ranksStripGeo,
    filesStripMat,
    ranksStripMat
  );

  // 2. 64-Square Chess Grid with Beveled Grooves + Highlight Overlays
  // Thin polished stone slabs sitting directly above the real-time Reflector mirror
  const tileGeo = new THREE.BoxGeometry(
    TILE_SIZE * 0.964,
    0.012,
    TILE_SIZE * 0.964
  );
  const moveRingGeo = new THREE.RingGeometry(0.18, 0.32, 28);
  moveRingGeo.rotateX(-Math.PI / 2);
  const attackRingGeo = new THREE.RingGeometry(0.38, 0.52, 6);
  attackRingGeo.rotateX(-Math.PI / 2);
  const selectedPadGeo = new THREE.PlaneGeometry(
    TILE_SIZE * 0.92,
    TILE_SIZE * 0.92
  );
  selectedPadGeo.rotateX(-Math.PI / 2);

  const moveRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const attackRingMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const selectedPadMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  disposables.push(
    tileGeo,
    moveRingGeo,
    attackRingGeo,
    selectedPadGeo,
    moveRingMat,
    attackRingMat,
    selectedPadMat
  );

  const tiles: TileInteractive[][] = [];
  const tileClickables: THREE.Mesh[] = [];
  const tempPos = new THREE.Vector3();

  for (let r = 0; r < 8; r++) {
    const rowArr: TileInteractive[] = [];
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      const tileMesh = new THREE.Mesh(
        tileGeo,
        isLight ? mats.boardLightSquare : mats.boardDarkSquare
      );
      boardCoordToWorld({ row: r, col: c }, tempPos);
      tileMesh.position.set(tempPos.x, -0.006, tempPos.z);
      tileMesh.receiveShadow = true;
      tileMesh.userData = { tileRow: r, tileCol: c };
      group.add(tileMesh);
      tileClickables.push(tileMesh);

      const highlightRing = new THREE.Mesh(moveRingGeo, moveRingMat);
      highlightRing.position.set(tempPos.x, 0.022, tempPos.z);
      highlightRing.visible = false;
      group.add(highlightRing);

      const attackRing = new THREE.Mesh(attackRingGeo, attackRingMat);
      attackRing.position.set(tempPos.x, 0.025, tempPos.z);
      attackRing.visible = false;
      group.add(attackRing);

      const selectedPad = new THREE.Mesh(selectedPadGeo, selectedPadMat);
      selectedPad.position.set(tempPos.x, 0.018, tempPos.z);
      selectedPad.visible = false;
      group.add(selectedPad);

      rowArr.push({
        coord: { row: r, col: c },
        mesh: tileMesh,
        highlightRing,
        attackRing,
        selectedPad,
      });
    }
    tiles.push(rowArr);
  }

  // 3. Gothic Cathedral Nave Colonnettes, Ribbed Pillars & Stained-Glass Rose/Lancet Windows
  const pillarRadius = 15.5;
  const pillarCount = 12;
  const mainColGeo = new THREE.CylinderGeometry(0.65, 0.78, 18, 16);
  const plinthColGeo = new THREE.BoxGeometry(2.1, 1.6, 2.1);
  const capitalColGeo = new THREE.CylinderGeometry(1.1, 0.68, 1.1, 12);
  const archRibGeo = new THREE.TorusGeometry(6.8, 0.24, 10, 28, Math.PI);
  const stainedWindowGeo = new THREE.CircleGeometry(1.85, 24);
  const lancetWindowGeo = new THREE.BoxGeometry(1.6, 4.8, 0.12);

  const windowGlowMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.48,
  });
  const warmWindowGlowMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.56,
  });

  disposables.push(
    mainColGeo,
    plinthColGeo,
    capitalColGeo,
    archRibGeo,
    stainedWindowGeo,
    lancetWindowGeo,
    windowGlowMat,
    warmWindowGlowMat
  );

  for (let i = 0; i < pillarCount; i++) {
    const angle = (i / pillarCount) * Math.PI * 2;
    const px = Math.cos(angle) * pillarRadius;
    const pz = Math.sin(angle) * pillarRadius;

    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(px, 0, pz);
    pillarGroup.lookAt(0, 0, 0);

    const plinth = new THREE.Mesh(plinthColGeo, mats.cathedralFloor);
    plinth.position.y = -0.7;
    const shaft = new THREE.Mesh(mainColGeo, mats.cathedralStone);
    shaft.position.y = 8.0;
    const capital = new THREE.Mesh(capitalColGeo, mats.boardFrameStone);
    capital.position.y = 16.8;

    const rib = new THREE.Mesh(archRibGeo, mats.cathedralStone);
    rib.position.set(0, 16.8, 6.2);
    rib.rotation.y = Math.PI / 2;

    const isWarm = i % 2 === 0;
    const rose = new THREE.Mesh(
      stainedWindowGeo,
      isWarm ? warmWindowGlowMat : windowGlowMat
    );
    rose.position.set(0, 12.4, -1.2);

    const lancet = new THREE.Mesh(
      lancetWindowGeo,
      isWarm ? warmWindowGlowMat : windowGlowMat
    );
    lancet.position.set(0, 7.2, -1.3);

    pillarGroup.add(plinth, shaft, capital, rib, rose, lancet);
    group.add(pillarGroup);
  }

  // 4. Custom GLSL Volumetric God-Rays Hitting the Center of the Board
  const godRayGeo = new THREE.CylinderGeometry(1.1, 4.4, 22, 32, 1, true);
  const godRayWarmMat = createVolumetricGodRayMaterial(
    0xffe49e,
    isHeadless ? 0.055 : 0.085
  );
  const godRayCoolMat = createVolumetricGodRayMaterial(
    0x93c5fd,
    isHeadless ? 0.035 : 0.055
  );
  disposables.push(godRayGeo, godRayWarmMat, godRayCoolMat);

  const godRays: THREE.Mesh[] = [];
  // Primary central God-Ray shaft angled from the upper clerestory directly into (0, 0, 0) board center!
  const rayConfigs: [number, number, number, number, number, boolean][] = [
    [-3.2, 9.2, -3.6, 0.34, -0.3, true], // Main Volumetric God-Ray hitting center of the board
    [-7.5, 9.5, -7.5, 0.25, -0.26, true],
    [7.8, 9.5, -7.5, 0.24, 0.26, false],
    [-8.5, 9.0, 2.2, 0.1, -0.28, true],
    [8.5, 9.0, 2.2, 0.1, 0.28, false],
  ];
  for (const [rx, ry, rz, rotX, rotZ, warm] of rayConfigs) {
    const ray = new THREE.Mesh(
      godRayGeo,
      warm ? godRayWarmMat : godRayCoolMat
    );
    ray.position.set(rx, ry, rz);
    ray.rotation.set(rotX, 0, rotZ);
    group.add(ray);
    godRays.push(ray);
  }

  // 5. Flanking Candelabras & Corner Braziers with Warm Flickering Candlelight
  const brazierPedestalGeo = new THREE.CylinderGeometry(0.32, 0.44, 1.35, 16);
  const brazierBowlGeo = new THREE.CylinderGeometry(0.48, 0.22, 0.3, 16);
  const candleWaxGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.36, 12);
  const flameGeo = new THREE.OctahedronGeometry(0.14, 1);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffcf48,
  });
  disposables.push(
    brazierPedestalGeo,
    brazierBowlGeo,
    candleWaxGeo,
    flameGeo,
    flameMat
  );

  const candleLights: THREE.PointLight[] = [];
  const candelabraPositions: [number, number, boolean][] = [
    [-6.3, -4.5, true],
    [-6.3, 0.0, false],
    [-6.3, 4.5, true],
    [6.3, -4.5, true],
    [6.3, 0.0, false],
    [6.3, 4.5, true],
  ];

  for (const [bx, bz, hasPointLight] of candelabraPositions) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, -0.35, bz);

    const ped = new THREE.Mesh(brazierPedestalGeo, mats.cathedralFloor);
    ped.position.y = 0.65;
    const bowl = new THREE.Mesh(brazierBowlGeo, mats.boardBrassTrim);
    bowl.position.y = 1.42;
    bGroup.add(ped, bowl);

    for (let c = -1; c <= 1; c++) {
      const wax = new THREE.Mesh(candleWaxGeo, mats.candleWax);
      wax.position.set(0, 1.68 + (c === 0 ? 0.08 : 0), c * 0.18);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.scale.set(0.7, 1.35, 0.7);
      flame.position.set(0, 1.94 + (c === 0 ? 0.08 : 0), c * 0.18);
      bGroup.add(wax, flame);
    }

    group.add(bGroup);

    if (hasPointLight) {
      const ptLight = new THREE.PointLight(0xff9e3d, 2.6, 15, 1.8);
      ptLight.position.set(bx, 1.85, bz);
      group.add(ptLight);
      candleLights.push(ptLight);
    }
  }

  return {
    group,
    tiles,
    tileClickables,
    candleLights,
    godRays,
    updateVolumetricTime: (timeSec: number) => {
      godRayWarmMat.uniforms.uTime.value = timeSec;
      godRayCoolMat.uniforms.uTime.value = timeSec;
    },
    dispose: () => {
      boardReflector?.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}
