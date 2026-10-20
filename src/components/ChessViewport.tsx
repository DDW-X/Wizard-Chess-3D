import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  ChessMove,
  GameState,
  SquareCoord,
  getLegalMovesForSquare,
} from '../game/chessEngine';
import {
  FactionTheme,
  computeDefenderRecoil,
  computeDissolveReconstructState,
  computePieceSpecificAttackFrame,
  computePieceTrajectory,
  getDirectionYaw,
  getTriggeredAttackAudioCues,
} from '../game/physicsKinematics';
import { spatialSoundEngine } from '../audio/spatialSoundEngine';
import {
  createCinematicHDRIEnvironment,
  createSanctumMaterials,
} from '../three/materials';
import {
  PieceActor,
  buildWizardChessPiece,
  disposePieceBuilderGeometries,
  populatePieceGeometry,
} from '../three/piecesBuilder';
import { disposeSculptorGeometries } from '../three/humanoidAndHorseSculptor';
import {
  ChessAssetManager,
  PawnInstancedCohortManager,
  disposeObjectHierarchy,
} from '../three/assetLoader';
import {
  boardCoordToWorld,
  buildGothicCathedralAndBoard,
} from '../three/cathedralBuilder';
import { ShatterParticleSystem } from '../three/shatterSystem';

export type CameraPreset = 'white' | 'overhead' | 'cathedral' | 'black' | 'orbit';

export interface ActiveMoveAnimation {
  move: ChessMove;
  elapsed: number;
  prevProgress: number;
  duration: number;
  shatterTriggered: boolean;
  landingDustTriggered: boolean;
  chargeDustTriggered: boolean;
  startWorld: THREE.Vector3;
  endWorld: THREE.Vector3;
  strikeDir: THREE.Vector3;
  perpDir: THREE.Vector3;
  attackYaw: number;
  combatMidpoint: THREE.Vector3;
  rookActor?: PieceActor;
  rookStartWorld?: THREE.Vector3;
  rookEndWorld?: THREE.Vector3;
}

interface ChessViewportProps {
  shellState: 'title' | 'playing' | 'paused' | 'gameover';
  gameState: GameState;
  factionTheme: FactionTheme;
  selectedSquare: SquareCoord | null;
  cameraPreset: CameraPreset;
  pendingMoveAnim: ChessMove | null;
  onSquareClick: (coord: SquareCoord) => void;
  onMoveAnimationComplete: () => void;
}

// Pre-allocated module-scope math objects (Zero GC inside requestAnimationFrame)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _desiredLookTarget = new THREE.Vector3();

const CAMERA_PRESET_COORDS: Record<
  Exclude<CameraPreset, 'orbit'>,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  white: { pos: [0, 8.8, 10.6], target: [0, 0.2, 0.3] },
  overhead: { pos: [0, 13.5, 1.2], target: [0, 0, 0] },
  cathedral: { pos: [8.6, 6.6, 8.6], target: [0, 0.5, 0] },
  black: { pos: [0, 8.8, -10.6], target: [0, 0.2, -0.3] },
};

/**
 * Injects PCSS (Percentage-Closer Soft Shadows) multi-tap Poisson disk contact-hardening
 * into Three.js shadow map evaluation for ultra-clean, artifact-free soft shadows.
 */
let pcssInjected = false;
function enablePCSSSoftShadows(): void {
  if (pcssInjected) return;
  pcssInjected = true;
  THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment.replace(
    '#ifdef USE_SHADOWMAP',
    `#ifdef USE_SHADOWMAP
    const vec2 pcssPoissonDisk[8] = vec2[8](
      vec2(-0.7071,  0.7071),
      vec2(-0.0000, -0.8750),
      vec2( 0.5303,  0.5303),
      vec2(-0.6250, -0.0000),
      vec2( 0.3536, -0.3536),
      vec2(-0.0000,  0.3750),
      vec2(-0.1768, -0.1768),
      vec2( 0.1250,  0.0000)
    );`
  );
}

export const ChessViewport: React.FC<ChessViewportProps> = ({
  shellState,
  gameState,
  factionTheme,
  selectedSquare,
  cameraPreset,
  pendingMoveAnim,
  onSquareClick,
  onMoveAnimationComplete,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    shellState,
    gameState,
    factionTheme,
    selectedSquare,
    cameraPreset,
    pendingMoveAnim,
    onSquareClick,
    onMoveAnimationComplete,
  });

  useEffect(() => {
    stateRef.current = {
      shellState,
      gameState,
      factionTheme,
      selectedSquare,
      cameraPreset,
      pendingMoveAnim,
      onSquareClick,
      onMoveAnimationComplete,
    };
  }, [
    shellState,
    gameState,
    factionTheme,
    selectedSquare,
    cameraPreset,
    pendingMoveAnim,
    onSquareClick,
    onMoveAnimationComplete,
  ]);

  const sceneApiRef = useRef<{
    syncBoardPieces: (gs: GameState, activeAnim: ActiveMoveAnimation | null) => void;
    syncTileHighlights: (gs: GameState, sel: SquareCoord | null) => void;
    startMoveAnimation: (move: ChessMove) => void;
    triggerFactionMorph: (newTheme: FactionTheme) => void;
    applyCameraPreset: (preset: CameraPreset) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isHeadless =
      typeof navigator !== 'undefined' &&
      /HeadlessChrome|Playwright/i.test(navigator.userAgent);

    enablePCSSSoftShadows();

    // 1. Scene & Moody High-Contrast Volumetric Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b10);
    scene.fog = new THREE.FogExp2(0x090b10, 0.022);

    // 2. Camera (Calibrated Frustum: near = 0.5, far = 1000.0 for maximum depth buffer precision & zero Z-fighting)
    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.5,
      1000.0
    );
    camera.near = 0.5;
    camera.far = 1000.0;
    camera.updateProjectionMatrix();
    camera.position.set(0, 8.8, 10.6);

    // 3. Renderer with ACESFilmicToneMapping & Fixed Stable Exposure
    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: isHeadless,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 4. 4K Studio + Gothic Cathedral HDRI Environment Map for Multi-Bounce Global Illumination
    const hdriEnvTexture = createCinematicHDRIEnvironment(renderer);
    scene.environment = hdriEnvTexture;
    scene.environmentIntensity = 0.88;

    // 5. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 4.2;
    controls.maxDistance = 24.0;
    controls.target.set(0, 0.2, 0.3);

    let activePresetMode: CameraPreset = stateRef.current.cameraPreset;
    controls.addEventListener('start', () => {
      if (stateRef.current.shellState === 'playing') {
        activePresetMode = 'orbit';
      }
    });

    // 6. Flawless Cinematic Lighting Setup (Volumetric Key + Central God-Ray Spot + Rim Lights)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x241c14, 0.44);
    scene.add(hemiLight);

    // Volumetric Directional Key Light (God-Ray Source) with 4096x4096 PCFSoftShadowMap
    const sunKeyLight = new THREE.DirectionalLight(0xfff1d6, 1.95);
    sunKeyLight.position.set(-8.5, 16.5, -7.5);
    sunKeyLight.castShadow = !isHeadless;
    const shadowRes = isHeadless ? 512 : 4096;
    sunKeyLight.shadow.mapSize.set(shadowRes, shadowRes);
    sunKeyLight.shadow.camera.near = 2.0;
    sunKeyLight.shadow.camera.far = 32.0;
    const d = 6.5;
    sunKeyLight.shadow.camera.left = -d;
    sunKeyLight.shadow.camera.right = d;
    sunKeyLight.shadow.camera.top = d;
    sunKeyLight.shadow.camera.bottom = -d;
    sunKeyLight.shadow.camera.updateProjectionMatrix();
    sunKeyLight.shadow.bias = -0.0005;
    sunKeyLight.shadow.normalBias = 0.05;
    sunKeyLight.shadow.radius = 2.0;
    scene.add(sunKeyLight);

    // Central Volumetric God-Ray Spotlight hitting the exact center of the board (0, 0, 0)
    const centerGodRaySpot = new THREE.SpotLight(0xffdfa0, 1.35, 28, Math.PI / 5.5, 0.8, 2.0);
    centerGodRaySpot.decay = 2;
    centerGodRaySpot.castShadow = false;
    centerGodRaySpot.shadow.bias = -0.0005;
    centerGodRaySpot.shadow.normalBias = 0.05;
    centerGodRaySpot.shadow.radius = 2.0;
    centerGodRaySpot.position.set(-4.5, 14.0, -5.0);
    centerGodRaySpot.target.position.set(0, 0, 0);
    scene.add(centerGodRaySpot);
    scene.add(centerGodRaySpot.target);

    // Cool Moonlight / Clerestory Rim Light (Opposite angle for razor-sharp armor & marble edge separation)
    const coolRimLight = new THREE.DirectionalLight(0x8bb8ff, 1.05);
    coolRimLight.position.set(10.0, 9.5, -9.5);
    scene.add(coolRimLight);

    // Warm Golden Back-Rim Light for White Alabaster Subsurface Scattering (SSS) Edge Bleed
    const warmRimLight = new THREE.DirectionalLight(0xffb86c, 0.78);
    warmRimLight.position.set(-9.5, 6.0, 10.5);
    scene.add(warmRimLight);

    // 7. PBR Materials & Cathedral / SSR Board Builder
    const mats = createSanctumMaterials();
    const cathedral = buildGothicCathedralAndBoard(mats, isHeadless);
    scene.add(cathedral.group);

    // 8. Rigid-Body Voronoi Shatter & Shockwave Particle System
    const shatterSystem = new ShatterParticleSystem(
      scene,
      mats.marblePolished,
      mats.obsidianGlass,
      mats.goldFiligree
    );

    // 9. Atmospheric Cathedral Dust Motes
    const dustCount = 180;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 18;
      dustPositions[i * 3 + 1] = 0.3 + Math.random() * 10;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xfde68a,
      size: 0.065,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // 10. Piece-Specific Combat Visual FX Meshes (Bishop Divine Light-Beam, Queen Afterimages & Blade Slash Arcs)
    // 10a. Bishop Localized Divine Light-Beam / Kinetic Pillar from Above
    const divineBeamGroup = new THREE.Group();
    divineBeamGroup.visible = false;
    const outerBeamGeo = new THREE.CylinderGeometry(0.18, 0.52, 11.0, 28, 1, true);
    const outerBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffdf78,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outerBeamMesh = new THREE.Mesh(outerBeamGeo, outerBeamMat);
    outerBeamMesh.position.y = 5.5;
    divineBeamGroup.add(outerBeamMesh);

    const coreBeamGeo = new THREE.CylinderGeometry(0.06, 0.22, 11.0, 20, 1, true);
    const coreBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const coreBeamMesh = new THREE.Mesh(coreBeamGeo, coreBeamMat);
    coreBeamMesh.position.y = 5.5;
    divineBeamGroup.add(coreBeamMesh);

    const haloRingGeo = new THREE.RingGeometry(0.28, 0.58, 32);
    haloRingGeo.rotateX(-Math.PI / 2);
    const haloRingMat = new THREE.MeshBasicMaterial({
      color: 0xffe898,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -4.0,
    });
    const haloRingMesh = new THREE.Mesh(haloRingGeo, haloRingMat);
    haloRingMesh.position.y = 0.05;
    divineBeamGroup.add(haloRingMesh);
    scene.add(divineBeamGroup);

    // 10b. Queen & King Lethal 3D Blade Slash Crescent Arcs
    const slashCrescentGeo = new THREE.RingGeometry(0.32, 0.62, 28, 1, -Math.PI * 0.65, Math.PI * 1.3);
    const slashCrescentMat = new THREE.MeshBasicMaterial({
      color: 0xfff0b8,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -4.0,
    });
    const slashCrescentMesh = new THREE.Mesh(slashCrescentGeo, slashCrescentMat);
    slashCrescentMesh.visible = false;
    scene.add(slashCrescentMesh);

    // 10c. Queen Teleport Dash Afterimage Phantom Silhouettes (3 trailing ghosts)
    const afterimageGhosts: THREE.Mesh[] = [];
    const ghostMats: THREE.MeshBasicMaterial[] = [];
    const ghostGeo = new THREE.CylinderGeometry(0.14, 0.28, 1.08, 20);
    for (let g = 0; g < 3; g++) {
      const gMat = new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      ghostMats.push(gMat);
      const ghost = new THREE.Mesh(ghostGeo, gMat);
      ghost.visible = false;
      scene.add(ghost);
      afterimageGhosts.push(ghost);
    }

    // 11. Stabilized Post-Processing Pipeline (RenderPass -> Clamped UnrealBloomPass -> SMAAPass -> OutputPass)
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    let smaaPass: SMAAPass | null = null;

    if (!isHeadless) {
      composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.18,
        0.4,
        0.9
      );
      bloomPass.threshold = 0.9;
      bloomPass.radius = 0.4;
      bloomPass.strength = 0.18;
      composer.addPass(bloomPass);

      smaaPass = new SMAAPass();
      composer.addPass(smaaPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
    }

    // 12. Piece Actors Management + GLTFLoader/DRACOLoader Asset Manager + Pawn InstancedMesh Cohort Manager
    let currentBuiltTheme: FactionTheme = stateRef.current.factionTheme;
    const assetManager = new ChessAssetManager(renderer);
    const pawnCohortManager = new PawnInstancedCohortManager(scene, mats);
    pawnCohortManager.syncFactionMaterials(currentBuiltTheme, mats);
    const piecesRoot = new THREE.Group();
    scene.add(piecesRoot);
    const pieceMap = new Map<string, PieceActor>();
    const pieceMeshToCoord = new Map<THREE.Object3D, SquareCoord>();

    let activeMoveAnim: ActiveMoveAnimation | null = null;
    let cameraShakeIntensity = 0;
    let pawnCohortDirty = true;

    let morphTransition: {
      targetTheme: FactionTheme;
      elapsed: number;
      duration: number;
      swapped: boolean;
      dustSpawned: boolean;
    } | null = null;

    const rebuildPieceClickLookup = () => {
      pieceMeshToCoord.clear();
      pieceMap.forEach((actor) => {
        const coord = { row: actor.row, col: actor.col };
        actor.root.traverse((child) => {
          pieceMeshToCoord.set(child, coord);
        });
      });
    };

    const syncBoardPieces = (gs: GameState, anim: ActiveMoveAnimation | null) => {
      const seenIds = new Set<string>();

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = gs.board[r][c];
          if (!cell) continue;
          seenIds.add(cell.id);

          let actor = pieceMap.get(cell.id);
          if (!actor) {
            actor = buildWizardChessPiece(
              cell.id,
              cell.type,
              cell.color,
              r,
              c,
              mats,
              currentBuiltTheme
            );
            piecesRoot.add(actor.root);
            pieceMap.set(cell.id, actor);
          }

          actor.row = r;
          actor.col = c;

          const isAnimatingAttacker = anim && anim.move.piece.id === cell.id;
          const isAnimatingRook = anim && anim.rookActor?.id === cell.id;

          if (!isAnimatingAttacker && !isAnimatingRook) {
            boardCoordToWorld({ row: r, col: c }, _v1);
            actor.root.position.copy(_v1);
            actor.root.rotation.set(0, actor.facingYaw, 0);
            actor.root.scale.set(1, 1, 1);
            actor.bodyGroup.position.set(0, 0, 0);
            actor.bodyGroup.rotation.set(0, 0, 0);
            actor.weaponGroup.position.z = actor.weaponGroup.userData.restZ ?? actor.weaponGroup.position.z;
            actor.weaponGroup.rotation.set(
              actor.weaponGroup.userData.restRotX ?? actor.weaponGroup.rotation.x,
              0,
              0
            );
            actor.shieldGroup.position.z = actor.shieldGroup.userData.restZ ?? actor.shieldGroup.position.z;
            actor.shieldGroup.rotation.y =
              actor.shieldGroup.userData.restRotY ?? actor.shieldGroup.rotation.y;
          }
        }
      }

      if (anim?.move.captured && !anim.shatterTriggered) {
        seenIds.add(anim.move.captured.id);
      }

      pieceMap.forEach((actor, id) => {
        if (!seenIds.has(id)) {
          piecesRoot.remove(actor.root);
          pieceMap.delete(id);
        }
      });

      rebuildPieceClickLookup();
      pawnCohortDirty = true;
    };

    const syncTileHighlights = (gs: GameState, sel: SquareCoord | null) => {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const t = cathedral.tiles[r][c];
          t.highlightRing.visible = false;
          t.attackRing.visible = false;
          t.selectedPad.visible = false;
        }
      }

      if (!sel) return;
      cathedral.tiles[sel.row][sel.col].selectedPad.visible = true;

      const moves = getLegalMovesForSquare(gs, sel);
      for (const m of moves) {
        const targetTile = cathedral.tiles[m.to.row][m.to.col];
        if (m.captured) {
          targetTile.attackRing.visible = true;
        } else {
          targetTile.highlightRing.visible = true;
        }
      }
    };

    const startMoveAnimation = (move: ChessMove) => {
      const startWorld = boardCoordToWorld(move.from, new THREE.Vector3());
      const endWorld = boardCoordToWorld(move.to, new THREE.Vector3());
      const isCapture = Boolean(move.captured);

      let rookActor: PieceActor | undefined;
      let rookStartWorld: THREE.Vector3 | undefined;
      let rookEndWorld: THREE.Vector3 | undefined;

      if (move.isCastling) {
        const row = move.from.row;
        const rookToCol = move.isCastling === 'kingside' ? 5 : 3;
        const rookCell = stateRef.current.gameState.board[row][rookToCol];
        if (rookCell) {
          rookActor = pieceMap.get(rookCell.id);
          const rookFromCol = move.isCastling === 'kingside' ? 7 : 0;
          rookStartWorld = boardCoordToWorld(
            { row, col: rookFromCol },
            new THREE.Vector3()
          );
          rookEndWorld = boardCoordToWorld(
            { row, col: rookToCol },
            new THREE.Vector3()
          );
        }
      }

      const strikeDir = new THREE.Vector3()
        .subVectors(endWorld, startWorld)
        .normalize();
      const perpDir = new THREE.Vector3(-strikeDir.z, 0, strikeDir.x);
      const attackYaw = getDirectionYaw(
        strikeDir.x,
        strikeDir.z,
        move.piece.color
      );
      const combatMidpoint = new THREE.Vector3()
        .addVectors(startWorld, endWorld)
        .multiplyScalar(0.5);

      const attacker = pieceMap.get(move.piece.id);
      if (attacker) {
        if (attacker.weaponGroup.userData.restZ === undefined) {
          attacker.weaponGroup.userData.restZ = attacker.weaponGroup.position.z;
          attacker.weaponGroup.userData.restY = attacker.weaponGroup.position.y;
          attacker.weaponGroup.userData.restRotX = attacker.weaponGroup.rotation.x;
        }
        if (attacker.shieldGroup.userData.restZ === undefined) {
          attacker.shieldGroup.userData.restZ = attacker.shieldGroup.position.z;
          attacker.shieldGroup.userData.restRotY = attacker.shieldGroup.rotation.y;
        }
      }

      // Piece-specific cinematic attack durations
      let duration = 0.64;
      if (isCapture) {
        const pt = move.piece.type;
        duration =
          pt === 'k'
            ? 1.28 // Slow, majestic King execution strike
            : pt === 'n'
              ? 1.12 // Warhorse rear-up & trample
              : pt === 'q'
                ? 1.06 // Teleport dash + 3-slash blade flurry
                : pt === 'p'
                  ? 1.05 // Parabolic spear/pilum hurl + march
                  : pt === 'b'
                    ? 1.04 // Divine light-beam from above
                    : 0.96; // Rook earth-shaking sprint tackle
      }

      activeMoveAnim = {
        move,
        elapsed: 0,
        prevProgress: 0,
        duration,
        shatterTriggered: false,
        landingDustTriggered: false,
        chargeDustTriggered: false,
        startWorld,
        endWorld,
        strikeDir,
        perpDir,
        attackYaw,
        combatMidpoint,
        rookActor,
        rookStartWorld,
        rookEndWorld,
      };
    };

    const triggerFactionMorph = (newTheme: FactionTheme) => {
      if (newTheme === currentBuiltTheme && !morphTransition) return;
      spatialSoundEngine.playFactionMorph(newTheme);
      morphTransition = {
        targetTheme: newTheme,
        elapsed: 0,
        duration: 0.72,
        swapped: false,
        dustSpawned: false,
      };
    };

    const applyCameraPreset = (preset: CameraPreset) => {
      activePresetMode = preset;
    };

    sceneApiRef.current = {
      syncBoardPieces,
      syncTileHighlights,
      startMoveAnimation,
      triggerFactionMorph,
      applyCameraPreset,
    };

    syncBoardPieces(stateRef.current.gameState, null);
    syncTileHighlights(
      stateRef.current.gameState,
      stateRef.current.selectedSquare
    );
    // Pre-compile all materials and shaders once up-front to prevent runtime shader compilation stalls
    renderer.compile(scene, camera);

    // 13. Raycasting for 3D Squares & Pieces (Plus initializing Web Audio on first click)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      spatialSoundEngine.startAmbientSoundscape();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (stateRef.current.shellState !== 'playing') return;
      const dist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (dist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const pieceHits = raycaster.intersectObjects(piecesRoot.children, true);
      if (pieceHits.length > 0) {
        const hitCoord = pieceMeshToCoord.get(pieceHits[0].object);
        if (hitCoord) {
          stateRef.current.onSquareClick(hitCoord);
          return;
        }
      }

      const tileHits = raycaster.intersectObjects(
        cathedral.tileClickables,
        false
      );
      if (tileHits.length > 0) {
        const { tileRow, tileCol } = tileHits[0].object.userData;
        if (typeof tileRow === 'number' && typeof tileCol === 'number') {
          stateRef.current.onSquareClick({ row: tileRow, col: tileCol });
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // 14. Responsive Resize Observer
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) {
        composer.setSize(w, h);
      }
      if (bloomPass) {
        bloomPass.resolution.set(w, h);
      }
    };
    window.addEventListener('resize', onResize);

    // 15. Main Render & Physics Loop
    let reqId = 0;
    let headlessTimerId = 0;
    let isDisposed = false;
    let lastTime = performance.now();

    const animate = (now: number) => {
      if (isDisposed) return;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const elapsedSec = now * 0.001;

      // Update GLSL Volumetric God-Rays shader time
      cathedral.updateVolumetricTime(elapsedSec);

      // Update 3D Spatial Audio Listener to match camera position & orientation
      spatialSoundEngine.updateListenerPosition(
        { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        { x: controls.target.x, y: controls.target.y, z: controls.target.z }
      );

      // A. Faction Dissolve & Reconstruct Morph Animation
      if (morphTransition) {
        morphTransition.elapsed += dt;
        const mProgress = Math.min(
          1,
          morphTransition.elapsed / morphTransition.duration
        );
        const mState = computeDissolveReconstructState(mProgress);

        if (!morphTransition.dustSpawned) {
          morphTransition.dustSpawned = true;
          pieceMap.forEach((actor) => {
            shatterSystem.triggerLandingDust(actor.root.position, actor.color);
          });
        }

        if (mState.shouldSwapGeometry && !morphTransition.swapped) {
          morphTransition.swapped = true;
          currentBuiltTheme = morphTransition.targetTheme;
          pawnCohortManager.syncFactionMaterials(currentBuiltTheme, mats);
          pieceMap.forEach((actor) => {
            populatePieceGeometry(actor, currentBuiltTheme, mats);
          });
          rebuildPieceClickLookup();
        }

        pieceMap.forEach((actor) => {
          actor.root.scale.set(mState.scaleXZ, mState.scaleY, mState.scaleXZ);
          actor.bodyGroup.position.y = mState.floatY;
          actor.root.rotation.y = actor.facingYaw + mState.spinYaw;
        });

        if (mProgress >= 1) {
          morphTransition = null;
          pieceMap.forEach((actor) => {
            actor.root.scale.set(1, 1, 1);
            actor.bodyGroup.position.y = 0;
            actor.root.rotation.y = actor.facingYaw;
          });
        }
      }

      // B. Active Piece Move / Piece-Specific Combat Animation
      if (activeMoveAnim) {
        activeMoveAnim.elapsed += dt;
        const progress = Math.min(
          1,
          activeMoveAnim.elapsed / activeMoveAnim.duration
        );
        const prevProgress = activeMoveAnim.prevProgress;
        activeMoveAnim.prevProgress = progress;

        const { move, startWorld, endWorld, strikeDir, perpDir, attackYaw } =
          activeMoveAnim;
        const attacker = pieceMap.get(move.piece.id);
        const distanceWorld = startWorld.distanceTo(endWorld);
        const isKnight = move.piece.type === 'n';
        const activeTheme = stateRef.current.factionTheme;

        if (attacker) {
          const restWeaponZ = attacker.weaponGroup.userData.restZ ?? 0.1;
          const restWeaponY = attacker.weaponGroup.userData.restY ?? 0.52;
          const restWeaponRotX = attacker.weaponGroup.userData.restRotX ?? 0.2;
          const restShieldZ = attacker.shieldGroup.userData.restZ ?? 0.18;
          const restShieldRotY = attacker.shieldGroup.userData.restRotY ?? 0.25;

          if (!move.captured) {
            // Standard Non-Capture Move: Parabolic Arc with easeInOutQuint & Landing Settle
            const traj = computePieceTrajectory(
              progress,
              distanceWorld,
              isKnight
            );

            attacker.root.position.lerpVectors(startWorld, endWorld, traj.u);
            attacker.root.position.y = traj.y;
            attacker.root.scale.set(traj.scaleXZ, traj.scaleY, traj.scaleXZ);

            if (progress < 0.85) {
              attacker.root.rotation.y = attackYaw;
            } else {
              const blend = (progress - 0.85) / 0.15;
              attacker.root.rotation.y = THREE.MathUtils.lerp(
                attackYaw,
                attacker.facingYaw,
                blend
              );
            }

            attacker.bodyGroup.rotation.x = traj.pitchTilt;
            attacker.bodyGroup.rotation.z = traj.rollTilt;

            if (progress >= 0.85 && !activeMoveAnim.landingDustTriggered) {
              activeMoveAnim.landingDustTriggered = true;
              shatterSystem.triggerLandingDust(endWorld, move.piece.color);
              spatialSoundEngine.playMoveSettle({
                x: endWorld.x,
                y: endWorld.y,
                z: endWorld.z,
              });
            }
          } else {
            // PIECE-SPECIFIC CINEMATIC ATTACK ANIMATION (Pawn, Knight, Bishop, Rook, Queen, King)
            const frame = computePieceSpecificAttackFrame(
              move.piece.type,
              activeTheme,
              progress,
              distanceWorld
            );
            const defender = pieceMap.get(move.captured.id);

            // Trigger frame-accurate 3D Spatial Audio SFX cues!
            const audioCues = getTriggeredAttackAudioCues(
              move.piece.type,
              prevProgress,
              progress
            );
            for (const cue of audioCues) {
              spatialSoundEngine.triggerAttackCue(
                cue,
                { x: startWorld.x, y: startWorld.y, z: startWorld.z },
                { x: endWorld.x, y: endWorld.y, z: endWorld.z }
              );
            }

            // Position attacker along strike vector + lateral blur offset (Queen) + vertical lift
            attacker.root.position.lerpVectors(
              startWorld,
              endWorld,
              frame.attackerU
            );
            if (frame.lateralOffset !== 0) {
              attacker.root.position.addScaledVector(
                perpDir,
                frame.lateralOffset
              );
            }
            attacker.root.position.y = frame.attackerLift;

            // Orient attacker toward enemy during attack, then restore forward stance
            if (progress < 0.88) {
              attacker.root.rotation.y = attackYaw + frame.bodySpinYaw;
            } else {
              const settleBlend = (progress - 0.88) / 0.12;
              attacker.root.rotation.y = THREE.MathUtils.lerp(
                attackYaw,
                attacker.facingYaw,
                settleBlend
              );
            }

            attacker.bodyGroup.rotation.x = frame.bodyPitch;

            // Rook sprint dust trail & subtle earth tremor
            if (
              move.piece.type === 'r' &&
              progress > 0.22 &&
              !activeMoveAnim.chargeDustTriggered
            ) {
              activeMoveAnim.chargeDustTriggered = true;
              shatterSystem.triggerLandingDust(
                attacker.root.position,
                move.piece.color
              );
              cameraShakeIntensity = Math.max(cameraShakeIntensity, 0.12);
            }

            // 1. Bishop Localized Divine Light-Beam / Kinetic Pillar from Above
            if (frame.divineBeamIntensity > 0.01) {
              divineBeamGroup.visible = true;
              divineBeamGroup.position.set(endWorld.x, 0, endWorld.z);
              outerBeamMat.opacity = frame.divineBeamIntensity * 0.42;
              coreBeamMat.opacity = frame.divineBeamIntensity * 0.82;
              haloRingMat.opacity = frame.divineBeamIntensity * 0.78;
              const ringScale = 0.6 + (1 - frame.divineBeamIntensity * 0.3) * 1.4;
              haloRingMesh.scale.set(ringScale, ringScale, 1);
            } else {
              divineBeamGroup.visible = false;
            }

            // 2. Queen Teleport Dash Afterimage Phantom Silhouettes
            if (frame.afterimageIntensity > 0.02) {
              for (let g = 0; g < afterimageGhosts.length; g++) {
                const ghost = afterimageGhosts[g];
                ghost.visible = true;
                const trailU = Math.max(0, frame.attackerU - (g + 1) * 0.18);
                ghost.position.lerpVectors(startWorld, endWorld, trailU);
                ghost.position.y = 0.56 + frame.attackerLift * 0.5;
                (ghost.material as THREE.MeshBasicMaterial).opacity =
                  frame.afterimageIntensity * (0.36 - g * 0.09);
              }
            } else {
              for (let g = 0; g < afterimageGhosts.length; g++) {
                afterimageGhosts[g].visible = false;
              }
            }

            // 3. Queen & King 3D Blade Slash Crescent Arcs
            if (frame.activeSlashIndex > 0) {
              slashCrescentMesh.visible = true;
              slashCrescentMesh.position.set(endWorld.x, 0.68, endWorld.z);
              slashCrescentMat.opacity = 0.85;
              if (frame.activeSlashIndex === 1) {
                slashCrescentMesh.rotation.set(0.55, attackYaw, 0.75);
              } else if (frame.activeSlashIndex === 2) {
                slashCrescentMesh.rotation.set(-0.55, attackYaw, -0.85);
              } else {
                slashCrescentMesh.rotation.set(0.0, attackYaw + Math.PI / 2, 1.45);
              }
            } else {
              slashCrescentMesh.visible = false;
            }

            // 4. Ranged Parabolic Spear/Pilum Throw (Pawn) or Kinetic Projectile (Bishop)
            if (frame.rangedProjectileProgress !== null) {
              if (move.piece.type === 'p') {
                // PAWN: Hurls Spear/Pilum in a high parabolic arc, pitching along the ballistic tangent!
                const flightDist =
                  distanceWorld * frame.rangedProjectileProgress;
                attacker.weaponGroup.position.z = restWeaponZ + flightDist;
                attacker.weaponGroup.position.y =
                  restWeaponY + frame.rangedProjectileArcY;
                attacker.weaponGroup.rotation.x =
                  Math.PI * 0.48 + frame.rangedProjectilePitch;
                attacker.weaponGroup.rotation.z = 0;
              } else {
                attacker.weaponGroup.position.z =
                  restWeaponZ + frame.weaponThrustZ;
                attacker.weaponGroup.position.y = restWeaponY;
                attacker.weaponGroup.rotation.x =
                  restWeaponRotX + frame.weaponPitch;
                attacker.weaponGroup.rotation.z = frame.weaponRoll;
              }
            } else {
              attacker.weaponGroup.position.z =
                restWeaponZ + frame.weaponThrustZ;
              attacker.weaponGroup.position.y = restWeaponY;
              attacker.weaponGroup.rotation.x =
                restWeaponRotX + frame.weaponPitch;
              attacker.weaponGroup.rotation.z = frame.weaponRoll;
            }

            attacker.shieldGroup.position.z = restShieldZ + frame.shieldBashZ;
            attacker.shieldGroup.rotation.y = restShieldRotY + frame.shieldYaw;

            // Defender pre-shatter physical recoil
            if (defender && progress < frame.shatterTriggerT) {
              const recoil = computeDefenderRecoil(
                frame.defenderRecoilProgress
              );
              defender.root.position
                .copy(endWorld)
                .addScaledVector(strikeDir, recoil.knockbackOffset);
              defender.root.position.x +=
                strikeDir.z * recoil.lateralJitter;
              defender.root.position.z -=
                strikeDir.x * recoil.lateralJitter;
              defender.bodyGroup.rotation.x = recoil.recoilPitch;
              defender.root.scale.set(
                recoil.scaleXZ,
                recoil.scaleY,
                recoil.scaleXZ
              );
            }

            // Trigger rigid-body Voronoi shattering at the piece's exact impact moment
            if (
              progress >= frame.shatterTriggerT &&
              !activeMoveAnim.shatterTriggered
            ) {
              activeMoveAnim.shatterTriggered = true;
              if (defender) {
                piecesRoot.remove(defender.root);
                pieceMap.delete(defender.id);
              }
              shatterSystem.triggerShatter(
                endWorld,
                move.captured.color,
                strikeDir,
                activeTheme
              );
              cameraShakeIntensity =
                move.piece.type === 'r' ||
                move.piece.type === 'k' ||
                move.piece.type === 'n'
                  ? 0.44
                  : 0.32;
            }
          }
        }

        // Castling Rook Companion Motion
        if (
          activeMoveAnim.rookActor &&
          activeMoveAnim.rookStartWorld &&
          activeMoveAnim.rookEndWorld
        ) {
          const rTraj = computePieceTrajectory(progress, 2.5, false);
          activeMoveAnim.rookActor.root.position.lerpVectors(
            activeMoveAnim.rookStartWorld,
            activeMoveAnim.rookEndWorld,
            rTraj.u
          );
          activeMoveAnim.rookActor.root.position.y = rTraj.y;
        }

        if (progress >= 1) {
          const finishedMove = activeMoveAnim.move;
          activeMoveAnim = null;
          divineBeamGroup.visible = false;
          slashCrescentMesh.visible = false;
          for (let g = 0; g < afterimageGhosts.length; g++) {
            afterimageGhosts[g].visible = false;
          }
          if (attacker) {
            attacker.root.position.copy(endWorld);
            attacker.root.rotation.set(0, attacker.facingYaw, 0);
            attacker.root.scale.set(1, 1, 1);
            attacker.bodyGroup.rotation.set(0, 0, 0);
            attacker.weaponGroup.position.z =
              attacker.weaponGroup.userData.restZ ?? 0.1;
            attacker.weaponGroup.position.y =
              attacker.weaponGroup.userData.restY ?? 0.52;
            attacker.weaponGroup.rotation.set(
              attacker.weaponGroup.userData.restRotX ?? 0.2,
              0,
              0
            );
            attacker.shieldGroup.position.z =
              attacker.shieldGroup.userData.restZ ?? 0.18;
            attacker.shieldGroup.rotation.y =
              attacker.shieldGroup.userData.restRotY ?? 0.25;
          }
          if (finishedMove) {
            stateRef.current.onMoveAnimationComplete();
          }
        }
      }

      // C. Secondary Idle Physics (Breathing, Weapon Weight Shift & Shield Stance)
      if (!morphTransition) {
        const activeTheme = stateRef.current.factionTheme;
        pieceMap.forEach((actor) => {
          if (activeMoveAnim && activeMoveAnim.move.piece.id === actor.id)
            return;
          if (
            activeMoveAnim &&
            activeMoveAnim.move.captured?.id === actor.id
          )
            return;

          const phase = elapsedSec * 2.1 + actor.phaseOffset;
          const breathAmplitude = activeTheme === 'spartan' ? 0.015 : 0.011;
          const breath = Math.sin(phase) * breathAmplitude;

          actor.bodyGroup.position.y = Math.max(0, breath);
          actor.bodyGroup.rotation.z = Math.cos(phase * 0.65) * 0.012;
          actor.headGroup.rotation.y = Math.sin(phase * 0.5) * 0.045;
          actor.headGroup.rotation.x = Math.cos(phase * 0.8) * 0.024;

          const baseRotX = actor.weaponGroup.userData.restRotX ?? 0.2;
          actor.weaponGroup.rotation.x =
            baseRotX + Math.sin(phase * 0.9) * 0.04;
          actor.weaponGroup.rotation.z = Math.cos(phase * 0.7) * 0.032;

          const baseShieldY = actor.shieldGroup.userData.restRotY ?? 0.25;
          actor.shieldGroup.rotation.y =
            baseShieldY + Math.cos(phase * 0.75) * 0.03;
        });
      }

      // C2. Sync THREE.InstancedMesh Cohort Matrices for Pawns only when dirty / moving / morphing
      if (pawnCohortDirty || activeMoveAnim !== null || morphTransition !== null) {
        pawnCohortManager.updateFromActors(pieceMap);
        pawnCohortDirty = activeMoveAnim !== null || morphTransition !== null;
      }

      // D. Update Rigid-Body Voronoi Shatter Physics & Settling Shards
      shatterSystem.update(dt);

      // E. Smooth Clamped Flanking Candlelight (decay = 2, clamped intensity) & Drifting Dust Motes
      cathedral.candleLights.forEach((light, idx) => {
        const flicker =
          1.55 +
          Math.sin(elapsedSec * 2.8 + idx * 1.9) * 0.16 +
          Math.cos(elapsedSec * 4.6 + idx) * 0.08;
        light.intensity = THREE.MathUtils.clamp(flicker, 1.25, 1.85);
      });

      const posAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < dustCount; i++) {
        let y = posAttr.getY(i) + dt * 0.16;
        if (y > 10.5) y = 0.3;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;

      // F. Adaptive Camera Framing & Impact Camera Shake
      if (stateRef.current.shellState === 'title') {
        const orbitAngle = elapsedSec * 0.16;
        camera.position.set(
          Math.sin(orbitAngle) * 11.2,
          7.6 + Math.sin(elapsedSec * 0.4) * 0.5,
          Math.cos(orbitAngle) * 11.2
        );
        controls.target.set(0, 0.4, 0);
      } else if (activePresetMode !== 'orbit') {
        const preset = CAMERA_PRESET_COORDS[activePresetMode];
        _camTargetPos.set(...preset.pos);
        _camLookTarget.set(...preset.target);

        // Smoothly pull camera focus toward combat action during capture animations
        if (activeMoveAnim?.move.captured) {
          _desiredLookTarget.lerpVectors(
            _camLookTarget,
            activeMoveAnim.combatMidpoint,
            0.35
          );
          _desiredLookTarget.y = 0.48;
        } else {
          _desiredLookTarget.copy(_camLookTarget);
        }

        camera.position.lerp(_camTargetPos, Math.min(1, dt * 4.2));
        controls.target.lerp(_desiredLookTarget, Math.min(1, dt * 5.0));
      }

      if (cameraShakeIntensity > 0.001) {
        camera.position.x +=
          (Math.random() - 0.5) * cameraShakeIntensity * 0.42;
        camera.position.y +=
          (Math.random() - 0.5) * cameraShakeIntensity * 0.42;
        cameraShakeIntensity *= Math.exp(-9.5 * dt);
      }

      controls.update();

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (isHeadless) {
        headlessTimerId = window.setTimeout(() => {
          if (!isDisposed) {
            animate(performance.now());
          }
        }, 220);
      } else {
        reqId = requestAnimationFrame(animate);
      }
    };

    reqId = requestAnimationFrame(animate);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(reqId);
      if (headlessTimerId) clearTimeout(headlessTimerId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      pawnCohortManager.dispose();
      assetManager.dispose();
      disposeObjectHierarchy(
        piecesRoot,
        assetManager.getSharedGeometries(),
        assetManager.getSharedMaterials()
      );
      disposeSculptorGeometries();
      disposePieceBuilderGeometries();
      shatterSystem.dispose();
      cathedral.dispose();
      mats.dispose();
      hdriEnvTexture.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      outerBeamGeo.dispose();
      outerBeamMat.dispose();
      coreBeamGeo.dispose();
      coreBeamMat.dispose();
      haloRingGeo.dispose();
      haloRingMat.dispose();
      slashCrescentGeo.dispose();
      slashCrescentMat.dispose();
      ghostGeo.dispose();
      ghostMats.forEach((m) => m.dispose());
      composer?.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    sceneApiRef.current?.syncBoardPieces(gameState, null);
    sceneApiRef.current?.syncTileHighlights(gameState, selectedSquare);
  }, [gameState, selectedSquare]);

  useEffect(() => {
    if (pendingMoveAnim) {
      sceneApiRef.current?.startMoveAnimation(pendingMoveAnim);
    }
  }, [pendingMoveAnim]);

  useEffect(() => {
    sceneApiRef.current?.triggerFactionMorph(factionTheme);
  }, [factionTheme]);

  useEffect(() => {
    sceneApiRef.current?.applyCameraPreset(cameraPreset);
  }, [cameraPreset]);

  return (
    <div
      ref={mountRef}
      data-testid="chess-3d-viewport"
      className="relative w-full h-full select-none overflow-hidden"
    />
  );
};
