import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PieceColor, PieceType } from '../game/chessEngine';
import { FactionTheme, getPieceFacingYaw } from '../game/physicsKinematics';
import { SanctumMaterialLibrary } from './materials';
import { prepareGeometryForPBR } from './assetLoader';
import {
  addCrusaderChainmailAndSurcoat,
  addCrusaderOpenHelmetWithFace,
  addRomanGaleaHelmetWithFace,
  addRomanGladiusSword,
  addRomanQueenRegalWeapon,
  addSculptedHumanFace,
  addSpartanCorinthianHelmetWithEyes,
  buildAnatomicalWarhorse,
} from './humanoidAndHorseSculptor';

export interface PieceActor {
  id: string;
  type: PieceType;
  color: PieceColor;
  theme: FactionTheme;
  row: number;
  col: number;
  facingYaw: number;
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  weaponGroup: THREE.Group;
  shieldGroup: THREE.Group;
  phaseOffset: number;
}

const IS_HEADLESS =
  typeof navigator !== 'undefined' &&
  /HeadlessChrome|Playwright/i.test(navigator.userAgent);

const SHARED_GEO_POOL = new Map<string, THREE.BufferGeometry>();

function getSharedGeo<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
  let geo = SHARED_GEO_POOL.get(key) as T | undefined;
  if (!geo) {
    geo = factory();
    prepareGeometryForPBR(geo);
    SHARED_GEO_POOL.set(key, geo);
  }
  return geo;
}

function createLatheProfile(
  key: string,
  points: [number, number][],
  segments = 48
): THREE.LatheGeometry {
  return getSharedGeo(`lathe_${key}_${segments}`, () => {
    const vecs = points.map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(vecs, IS_HEADLESS ? 16 : segments);
    geo.computeVertexNormals();
    return geo;
  });
}

/**
 * Adds a faction-themed circular plinth base at the bottom of a piece.
 * Note: For Pawns ('p'), the base plinth and ring are also rendered in batch via
 * `PawnInstancedCohortManager` (`THREE.InstancedMesh`), while keeping a lightweight
 * upper collar on the actor for seamless transition.
 */
function addPedestalBase(
  parent: THREE.Group,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  isInstancedPawn = false
): void {
  if (!isInstancedPawn) {
    const baseGeo = createLatheProfile(
      'pedestal_base',
      [
        [0.0, 0.0],
        [0.37, 0.0],
        [0.39, 0.04],
        [0.35, 0.09],
        [0.36, 0.12],
        [0.3, 0.16],
        [0.25, 0.21],
        [0.0, 0.21],
      ],
      40
    );
    const baseMesh = new THREE.Mesh(baseGeo, primaryMat);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    parent.add(baseMesh);

    const ringGeo = getSharedGeo('pedestal_ring_lower', () => {
      const g = new THREE.TorusGeometry(0.355, 0.017, 14, 36);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const ringMesh = new THREE.Mesh(ringGeo, trimMat);
    ringMesh.position.y = 0.09;
    parent.add(ringMesh);
  }

  const upperRingGeo = getSharedGeo('pedestal_ring_upper', () => {
    const g = new THREE.TorusGeometry(0.265, 0.014, 12, 32);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const upperRingMesh = new THREE.Mesh(upperRingGeo, trimMat);
  upperRingMesh.position.y = 0.2;
  parent.add(upperRingMesh);

  const collarGeo = getSharedGeo('pedestal_collar', () =>
    new THREE.CylinderGeometry(0.25, 0.28, 0.04, 28)
  );
  const collarMesh = new THREE.Mesh(collarGeo, secondaryMat);
  collarMesh.position.y = 0.22;
  parent.add(collarMesh);
}

// ============================================================================
// 1. DEFAULT / CRUSADER (GOTHIC) FACTION BUILDERS
// ============================================================================

function addGothicHeaterShield(
  shieldGroup: THREE.Group,
  primaryMat: THREE.Material,
  trimMat: THREE.Material,
  scale = 1.0
): void {
  const extrudeGeo = getSharedGeo('gothic_heater_shield', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.14, 0.16);
    shape.lineTo(0.14, 0.16);
    shape.quadraticCurveTo(0.15, -0.04, 0, -0.22);
    shape.quadraticCurveTo(-0.15, -0.04, -0.14, 0.16);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.026,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    });
    g.center();
    return g;
  });

  const shieldMesh = new THREE.Mesh(extrudeGeo, primaryMat);
  shieldMesh.scale.setScalar(scale);
  shieldMesh.castShadow = true;
  shieldMesh.receiveShadow = true;
  shieldGroup.add(shieldMesh);

  const vBarGeo = getSharedGeo('gothic_shield_vbar', () =>
    new THREE.BoxGeometry(0.028, 0.26, 0.018)
  );
  const vBar = new THREE.Mesh(vBarGeo, trimMat);
  vBar.position.set(0, 0.01 * scale, 0.022 * scale);
  vBar.scale.setScalar(scale);
  shieldGroup.add(vBar);

  const hBarGeo = getSharedGeo('gothic_shield_hbar', () =>
    new THREE.BoxGeometry(0.18, 0.028, 0.018)
  );
  const hBar = new THREE.Mesh(hBarGeo, trimMat);
  hBar.position.set(0, 0.04 * scale, 0.022 * scale);
  hBar.scale.setScalar(scale);
  shieldGroup.add(hBar);
}

function addGothicHalberd(
  weaponGroup: THREE.Group,
  steelMat: THREE.Material,
  trimMat: THREE.Material,
  height = 0.88
): void {
  const shaftGeo = getSharedGeo('gothic_halberd_shaft', () =>
    new THREE.CylinderGeometry(0.016, 0.019, 0.88, 14)
  );
  const shaft = new THREE.Mesh(shaftGeo, trimMat);
  shaft.scale.y = height / 0.88;
  shaft.position.y = height * 0.35;
  shaft.castShadow = true;
  weaponGroup.add(shaft);

  const tipGeo = getSharedGeo('gothic_halberd_tip', () =>
    new THREE.ConeGeometry(0.032, 0.24, 10)
  );
  const tip = new THREE.Mesh(tipGeo, steelMat);
  tip.position.y = height * 0.86;
  weaponGroup.add(tip);

  const axeBladeGeo = getSharedGeo('gothic_halberd_axe', () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.09);
    s.quadraticCurveTo(0.11, -0.05, 0.14, 0.09);
    s.quadraticCurveTo(0.08, 0.02, 0, 0.09);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.01,
      bevelEnabled: true,
      bevelSize: 0.005,
      bevelThickness: 0.005,
      bevelSegments: 2,
    });
    g.center();
    return g;
  });
  const axeBlade = new THREE.Mesh(axeBladeGeo, steelMat);
  axeBlade.rotation.y = Math.PI / 2;
  axeBlade.position.set(0, height * 0.68, 0.065);
  axeBlade.castShadow = true;
  weaponGroup.add(axeBlade);
}

// ============================================================================
// 2. SPARTAN FACTION BUILDERS (Muscle Cuirass, Pteruges, Dented Aspis, Proper Dory Spear)
// ============================================================================

function addSpartanPterugesSkirt(
  parent: THREE.Group,
  leatherMat: THREE.Material,
  bronzeMat: THREE.Material,
  waistY = 0.34,
  radius = 0.16,
  length = 0.16
): void {
  const beltGeo = getSharedGeo('spartan_belt', () =>
    new THREE.CylinderGeometry(0.165, 0.168, 0.038, 20)
  );
  const belt = new THREE.Mesh(beltGeo, bronzeMat);
  belt.position.y = waistY + length * 0.45;
  belt.scale.set(radius / 0.16, 1, radius / 0.16);
  parent.add(belt);

  const lappetGeo = getSharedGeo('spartan_lappet', () =>
    new THREE.BoxGeometry(0.052, 0.16, 0.018, 2, 4, 1)
  );
  const studGeo = getSharedGeo('spartan_stud', () =>
    new THREE.SphereGeometry(0.012, 8, 6)
  );

  const count = 10;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const lappetGroup = new THREE.Group();
    lappetGroup.position.set(
      Math.sin(a) * radius,
      waistY + length * 0.35,
      Math.cos(a) * radius
    );
    lappetGroup.rotation.y = a;
    lappetGroup.rotation.x = 0.14;

    const strip = new THREE.Mesh(lappetGeo, leatherMat);
    strip.scale.y = length / 0.16;
    strip.position.y = -length * 0.5;
    lappetGroup.add(strip);

    const stud = new THREE.Mesh(studGeo, bronzeMat);
    stud.position.set(0, -length * 0.86, 0.01);
    lappetGroup.add(stud);

    parent.add(lappetGroup);
  }
}

function addSpartanMuscleCuirass(
  bodyGroup: THREE.Group,
  bronzeMat: THREE.Material,
  leatherMat: THREE.Material,
  scale = 1.0
): void {
  addSpartanPterugesSkirt(
    bodyGroup,
    leatherMat,
    bronzeMat,
    0.31 * scale,
    0.165 * scale,
    0.15 * scale
  );

  const torsoGeo = createLatheProfile(
    'spartan_cuirass_torso',
    [
      [0.16, 0.38],
      [0.155, 0.45],
      [0.195, 0.56],
      [0.215, 0.65],
      [0.16, 0.72],
      [0.0, 0.73],
    ],
    36
  );
  const torso = new THREE.Mesh(torsoGeo, bronzeMat);
  torso.scale.setScalar(scale);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);

  const pecGeo = getSharedGeo('spartan_pec', () =>
    new THREE.SphereGeometry(0.088, 16, 12)
  );
  const abGeo = getSharedGeo('spartan_ab', () =>
    new THREE.SphereGeometry(0.044, 12, 10)
  );
  const shoulderGeo = getSharedGeo('spartan_shoulder', () =>
    new THREE.SphereGeometry(0.082, 14, 12)
  );

  for (const side of [-1, 1]) {
    const pec = new THREE.Mesh(pecGeo, bronzeMat);
    pec.scale.set(1.05 * scale, 0.85 * scale, 0.55 * scale);
    pec.position.set(side * 0.068 * scale, 0.61 * scale, 0.145 * scale);
    bodyGroup.add(pec);

    for (let row = 0; row < 3; row++) {
      const ab = new THREE.Mesh(abGeo, bronzeMat);
      ab.scale.set(1.1 * scale, 0.72 * scale, 0.48 * scale);
      ab.position.set(
        side * 0.038 * scale,
        (0.52 - row * 0.045) * scale,
        (0.155 - row * 0.006) * scale
      );
      bodyGroup.add(ab);
    }

    const shoulder = new THREE.Mesh(shoulderGeo, bronzeMat);
    shoulder.scale.set(1.1 * scale, 0.75 * scale, 1.15 * scale);
    shoulder.position.set(side * 0.195 * scale, 0.67 * scale, 0.01 * scale);
    bodyGroup.add(shoulder);
  }
}

function addSpartanAspisShield(
  shieldGroup: THREE.Group,
  bronzeMat: THREE.Material,
  trimMat: THREE.Material,
  radius = 0.25
): void {
  const dishGeo = getSharedGeo('spartan_aspis_dish', () => {
    const g = createLatheProfile(
      'aspis_lathe_unit',
      [
        [0.0, 0.19],
        [0.45, 0.175],
        [0.84, 0.088],
        [1.0, 0.0],
        [1.0, -0.072],
        [0.85, 0.032],
        [0.0, 0.112],
      ],
      40
    ).clone();
    g.rotateX(Math.PI / 2);
    return g;
  });

  const dish = new THREE.Mesh(dishGeo, bronzeMat);
  dish.scale.setScalar(radius);
  dish.castShadow = true;
  dish.receiveShadow = true;
  shieldGroup.add(dish);

  const rimGeo = getSharedGeo('spartan_aspis_rim', () =>
    new THREE.TorusGeometry(0.96, 0.088, 14, 40)
  );
  const rim = new THREE.Mesh(rimGeo, bronzeMat);
  rim.scale.setScalar(radius);
  rim.position.z = 0.012;
  shieldGroup.add(rim);

  // Raised Spartan Lambda (Λ) Chevron on +Z outer face
  const legGeo = getSharedGeo('spartan_lambda_leg', () =>
    new THREE.BoxGeometry(0.11, 0.86, 0.072)
  );
  const leftLeg = new THREE.Mesh(legGeo, trimMat);
  leftLeg.scale.setScalar(radius);
  leftLeg.position.set(-0.175 * radius, 0.04 * radius, 0.185 * radius);
  leftLeg.rotation.z = -0.34;
  shieldGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, trimMat);
  rightLeg.scale.setScalar(radius);
  rightLeg.position.set(0.175 * radius, 0.04 * radius, 0.185 * radius);
  rightLeg.rotation.z = 0.34;
  shieldGroup.add(rightLeg);
}

/**
 * Builds an authentic Greek Dory Spear with ash-wood shaft, leather hand-grip binding,
 * leaf-shaped forged steel spearhead with midrib, and bronze Sauroter ("lizard-killer") butt-spike.
 */
function addSpartanDorySpear(
  weaponGroup: THREE.Group,
  shaftMat: THREE.Material,
  bronzeMat: THREE.Material,
  forgedSteelMat: THREE.Material,
  length = 1.15
): void {
  const shaftGeo = getSharedGeo('spartan_dory_shaft', () =>
    new THREE.CylinderGeometry(0.015, 0.017, 1.15, 14)
  );
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.scale.y = length / 1.15;
  shaft.position.y = length * 0.36;
  shaft.castShadow = true;
  weaponGroup.add(shaft);

  // Corded leather grip binding
  const gripGeo = getSharedGeo('spartan_dory_grip', () =>
    new THREE.CylinderGeometry(0.019, 0.019, 0.18, 14)
  );
  const grip = new THREE.Mesh(gripGeo, bronzeMat);
  grip.position.y = length * 0.25;
  weaponGroup.add(grip);

  // Leaf-shaped Forged Iron/Steel Spearhead with central midrib
  const headGeo = getSharedGeo('spartan_dory_leaf_head', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.042, 0.08, 0.028, 0.18);
    s.lineTo(0, 0.28);
    s.lineTo(-0.028, 0.18);
    s.quadraticCurveTo(-0.042, 0.08, 0, 0);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.01,
      bevelEnabled: true,
      bevelSize: 0.006,
      bevelThickness: 0.006,
      bevelSegments: 2,
    });
    g.center();
    return g;
  });
  const head = new THREE.Mesh(headGeo, forgedSteelMat);
  head.position.y = length * 0.88;
  head.rotation.y = Math.PI / 2;
  head.castShadow = true;
  weaponGroup.add(head);

  // Bronze collar socket below spearhead
  const socketGeo = getSharedGeo('spartan_dory_socket', () =>
    new THREE.ConeGeometry(0.024, 0.06, 12)
  );
  const socket = new THREE.Mesh(socketGeo, bronzeMat);
  socket.position.y = length * 0.74;
  weaponGroup.add(socket);

  // Sauroter ("lizard-killer" pyramidal bronze butt-spike)
  const buttSpikeGeo = getSharedGeo('spartan_dory_sauroter', () =>
    new THREE.ConeGeometry(0.024, 0.15, 4)
  );
  const buttSpike = new THREE.Mesh(buttSpikeGeo, bronzeMat);
  buttSpike.rotation.x = Math.PI;
  buttSpike.position.y = -length * 0.14;
  weaponGroup.add(buttSpike);
}

// ============================================================================
// 3. ROMAN EMPIRE FACTION BUILDERS (Lorica Segmentata, Galea, Scutum, Gladius)
// ============================================================================

function addLoricaSegmentataTorso(
  bodyGroup: THREE.Group,
  steelMat: THREE.Material,
  tunicMat: THREE.Material,
  goldMat: THREE.Material,
  scale = 1.0
): void {
  // Underlying crimson/purple woven Tunica with cloth folds
  const tunicGeo = getSharedGeo('roman_tunic_base', () =>
    new THREE.CylinderGeometry(0.165, 0.218, 0.28, 28)
  );
  const tunic = new THREE.Mesh(tunicGeo, tunicMat);
  tunic.position.y = 0.33 * scale;
  tunic.scale.setScalar(scale);
  tunic.castShadow = true;
  bodyGroup.add(tunic);

  // Cingulum Militare (Roman military belt with hanging brass-studded Baltea apron)
  const beltGeo = getSharedGeo('roman_cingulum_belt', () =>
    new THREE.CylinderGeometry(0.182, 0.182, 0.036, 28)
  );
  const belt = new THREE.Mesh(beltGeo, goldMat);
  belt.position.y = 0.4 * scale;
  belt.scale.setScalar(scale);
  bodyGroup.add(belt);

  const strapGeo = getSharedGeo('roman_baltea_strap', () =>
    new THREE.BoxGeometry(0.022, 0.16, 0.015)
  );
  for (let i = -2; i <= 2; i++) {
    const strap = new THREE.Mesh(strapGeo, goldMat);
    strap.position.set(i * 0.032 * scale, 0.31 * scale, 0.182 * scale);
    strap.scale.setScalar(scale);
    bodyGroup.add(strap);
  }

  // 6 Horizontal Overlapping Polished Steel Girth Hoops (Lorica Segmentata)
  const fastenerGeo = getSharedGeo('roman_lorica_fastener', () =>
    new THREE.BoxGeometry(0.034, 0.02, 0.018)
  );
  for (let h = 0; h < 6; h++) {
    const y = (0.43 + h * 0.044) * scale;
    const r = (0.178 + h * 0.0055) * scale;
    const hoopGeo = getSharedGeo(`roman_lorica_hoop_${h}`, () =>
      new THREE.CylinderGeometry(
        (0.178 + h * 0.0055) * 1.02,
        (0.178 + h * 0.0055) * 0.98,
        0.042,
        32
      )
    );
    const hoop = new THREE.Mesh(hoopGeo, steelMat);
    hoop.position.y = y;
    hoop.scale.setScalar(scale);
    hoop.castShadow = true;
    hoop.receiveShadow = true;
    bodyGroup.add(hoop);

    const fastener = new THREE.Mesh(fastenerGeo, goldMat);
    fastener.position.set(0, y, r + 0.006 * scale);
    fastener.scale.setScalar(scale);
    bodyGroup.add(fastener);
  }

  // 4-Band Segmented Shoulder Epaulettes (Left & Right)
  for (const side of [-1, 1]) {
    for (let b = 0; b < 4; b++) {
      const archGeo = getSharedGeo(`roman_epaulette_${b}`, () =>
        new THREE.TorusGeometry(0.088 - b * 0.008, 0.024, 10, 20, Math.PI)
      );
      const arch = new THREE.Mesh(archGeo, steelMat);
      arch.position.set(
        side * (0.13 + b * 0.024) * scale,
        0.65 * scale,
        0
      );
      arch.rotation.y = Math.PI / 2;
      arch.rotation.x = side * 0.22;
      arch.scale.setScalar(scale);
      arch.castShadow = true;
      bodyGroup.add(arch);
    }
  }
}

function addRomanScutumShield(
  shieldGroup: THREE.Group,
  tunicMat: THREE.Material,
  goldMat: THREE.Material,
  scale = 1.0
): void {
  const radius = 0.18;
  const height = 0.44;
  const arc = Math.PI * 0.68;

  const cylGeo = getSharedGeo('roman_scutum_body', () =>
    new THREE.CylinderGeometry(radius, radius, height, 28, 4, true, -arc / 2, arc)
  );
  const scutumBody = new THREE.Mesh(cylGeo, tunicMat);
  scutumBody.position.z = -radius * 0.65 * scale;
  scutumBody.scale.setScalar(scale);
  scutumBody.castShadow = true;
  scutumBody.receiveShadow = true;
  shieldGroup.add(scutumBody);

  const rimArcGeo = getSharedGeo('roman_scutum_rim', () =>
    new THREE.TorusGeometry(radius, 0.014, 10, 24, arc)
  );
  for (const ySign of [-1, 1]) {
    const rimArc = new THREE.Mesh(rimArcGeo, goldMat);
    rimArc.rotation.x = Math.PI / 2;
    rimArc.rotation.z = Math.PI / 2 - arc / 2;
    rimArc.position.set(0, ySign * (height / 2) * scale, -radius * 0.65 * scale);
    rimArc.scale.setScalar(scale);
    shieldGroup.add(rimArc);
  }

  const bossPlateGeo = getSharedGeo('roman_scutum_boss_plate', () =>
    new THREE.BoxGeometry(0.11, 0.11, 0.02)
  );
  const bossPlate = new THREE.Mesh(bossPlateGeo, goldMat);
  bossPlate.position.set(0, 0, radius * 0.35 * scale);
  bossPlate.scale.setScalar(scale);
  shieldGroup.add(bossPlate);

  const umboGeo = getSharedGeo('roman_scutum_umbo', () =>
    new THREE.SphereGeometry(0.048, 16, 14)
  );
  const umbo = new THREE.Mesh(umboGeo, goldMat);
  umbo.position.set(0, 0, radius * 0.38 * scale);
  umbo.scale.setScalar(scale);
  shieldGroup.add(umbo);

  const boltGeo = getSharedGeo('roman_scutum_bolt', () =>
    new THREE.ConeGeometry(0.015, 0.15, 6)
  );
  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      const bolt = new THREE.Mesh(boltGeo, goldMat);
      bolt.position.set(
        xSign * 0.068 * scale,
        ySign * 0.105 * scale,
        radius * 0.31 * scale
      );
      bolt.rotation.z = xSign * ySign * -0.52;
      bolt.scale.setScalar(scale);
      shieldGroup.add(bolt);
    }
  }
}

// ============================================================================
// PIECE TYPE SCULPTORS ACROSS ALL 3 FACTIONS
// ============================================================================

function buildPawn(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material,
  mats: SanctumMaterialLibrary
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup, color } = actor;
  const isWhite = color === 'w';
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat, true);

  if (theme === 'spartan') {
    // SPARTAN HOPLITE: Scarred Bronze Muscle Cuirass + Pteruges + Corinthian Helmet WITH VISIBLE EYES + Dented Aspis + Proper Dory Spear
    addSpartanMuscleCuirass(bodyGroup, primaryMat, secondaryMat, 1.0);

    headGroup.position.set(0, 0.84, 0);
    addSpartanCorinthianHelmetWithEyes(
      headGroup,
      primaryMat,
      secondaryMat,
      plumeMat,
      mats,
      false,
      1.0
    );

    shieldGroup.position.set(-0.22, 0.56, 0.19);
    shieldGroup.rotation.y = 0.25;
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.25);

    weaponGroup.position.set(0.22, 0.52, 0.1);
    weaponGroup.rotation.x = 0.36;
    addSpartanDorySpear(weaponGroup, secondaryMat, primaryMat, mats.weaponForgedSteel, 1.08);
  } else if (theme === 'roman') {
    // ROMAN LEGIONARY: Polished Lorica Segmentata + Crested Galea with Face/Eyes + Curved Scutum + VISIBLE GLADIUS SWORD!
    addLoricaSegmentataTorso(bodyGroup, primaryMat, plumeMat, trimMat, 1.0);

    // Secondary Roman Pilum strapped across back for tactical readiness
    const backPilumGeo = getSharedGeo('roman_back_pilum', () =>
      new THREE.CylinderGeometry(0.01, 0.014, 0.78, 10)
    );
    const backPilum = new THREE.Mesh(backPilumGeo, trimMat);
    backPilum.position.set(-0.08, 0.62, -0.18);
    backPilum.rotation.z = -0.32;
    bodyGroup.add(backPilum);

    headGroup.position.set(0, 0.83, 0);
    addRomanGaleaHelmetWithFace(
      headGroup,
      primaryMat,
      trimMat,
      plumeMat,
      mats,
      isWhite,
      true,
      false
    );

    shieldGroup.position.set(-0.2, 0.53, 0.22);
    shieldGroup.rotation.y = 0.16;
    addRomanScutumShield(shieldGroup, plumeMat, trimMat, 0.96);

    // Visible Pompeii-Pattern Roman Gladius Sword held in the right hand!
    weaponGroup.position.set(0.23, 0.52, 0.16);
    weaponGroup.rotation.x = 0.42;
    addRomanGladiusSword(
      weaponGroup,
      mats.weaponForgedSteel,
      trimMat,
      mats.spartanWornLeather,
      1.05
    );
  } else {
    // DEFAULT / CRUSADER (GOTHIC) FOOT SOLDIER: Chainmail Hauberk + Draped Woven Surcoat Cloth Folds + Heraldic Cross + Open Helmet with Human Face & Eyes!
    const chainmailMat = isWhite ? mats.crusaderChainmailLight : mats.crusaderChainmailDark;
    const surcoatMat = isWhite ? mats.crusaderWovenSurcoatLight : mats.crusaderWovenSurcoatDark;

    addCrusaderChainmailAndSurcoat(
      bodyGroup,
      chainmailMat,
      surcoatMat,
      primaryMat,
      trimMat,
      1.0
    );

    headGroup.position.set(0, 0.84, 0);
    addCrusaderOpenHelmetWithFace(
      headGroup,
      primaryMat,
      chainmailMat,
      trimMat,
      mats,
      isWhite,
      false,
      false,
      1.0
    );

    shieldGroup.position.set(-0.21, 0.55, 0.18);
    shieldGroup.rotation.y = 0.32;
    addGothicHeaterShield(shieldGroup, secondaryMat, trimMat, 0.95);

    weaponGroup.position.set(0.21, 0.52, 0.08);
    weaponGroup.rotation.x = 0.18;
    addGothicHalberd(weaponGroup, mats.weaponForgedSteel, trimMat, 0.88);
  }
}

function buildRook(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material,
  mats: SanctumMaterialLibrary
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup, color } = actor;
  const isWhite = color === 'w';
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat, false);

  if (theme === 'spartan') {
    const columnGeo = createLatheProfile(
      'spartan_rook_column',
      [
        [0.27, 0.21],
        [0.24, 0.35],
        [0.22, 0.78],
        [0.28, 0.88],
        [0.31, 0.96],
        [0.0, 0.96],
      ],
      40
    );
    const column = new THREE.Mesh(columnGeo, primaryMat);
    column.castShadow = true;
    column.receiveShadow = true;
    bodyGroup.add(column);

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
      const sideShield = new THREE.Group();
      addSpartanAspisShield(sideShield, primaryMat, trimMat, 0.18);
      sideShield.position.set(Math.sin(a) * 0.25, 0.62, Math.cos(a) * 0.25);
      sideShield.rotation.y = a;
      bodyGroup.add(sideShield);
    }

    shieldGroup.position.set(0, 0.62, 0.26);
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.22);

    headGroup.position.set(0, 1.05, 0);
    addSpartanCorinthianHelmetWithEyes(
      headGroup,
      primaryMat,
      secondaryMat,
      plumeMat,
      mats,
      true,
      1.12
    );

    weaponGroup.position.set(0.24, 0.65, 0.16);
    weaponGroup.rotation.x = Math.PI * 0.36;
    addSpartanDorySpear(weaponGroup, secondaryMat, primaryMat, mats.weaponForgedSteel, 0.95);
  } else if (theme === 'roman') {
    const columnGeo = createLatheProfile(
      'roman_rook_column',
      [
        [0.26, 0.21],
        [0.22, 0.36],
        [0.2, 0.82],
        [0.27, 0.92],
        [0.29, 1.0],
        [0.0, 1.0],
      ],
      40
    );
    const column = new THREE.Mesh(columnGeo, secondaryMat);
    column.castShadow = true;
    column.receiveShadow = true;
    bodyGroup.add(column);

    const pilasterGeo = getSharedGeo('roman_rook_pilaster', () =>
      new THREE.BoxGeometry(0.035, 0.56, 0.035)
    );
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pilaster = new THREE.Mesh(pilasterGeo, trimMat);
      pilaster.position.set(Math.sin(a) * 0.21, 0.6, Math.cos(a) * 0.21);
      pilaster.rotation.y = a;
      bodyGroup.add(pilaster);
    }

    headGroup.position.set(0, 1.05, 0);
    addRomanGaleaHelmetWithFace(
      headGroup,
      primaryMat,
      trimMat,
      plumeMat,
      mats,
      isWhite,
      true,
      true
    );

    shieldGroup.position.set(0, 0.56, 0.24);
    addRomanScutumShield(shieldGroup, plumeMat, trimMat, 0.88);

    weaponGroup.position.set(0.22, 0.6, 0.15);
    weaponGroup.rotation.x = 0.4;
    addRomanGladiusSword(
      weaponGroup,
      mats.weaponForgedSteel,
      trimMat,
      mats.spartanWornLeather,
      1.0
    );
  } else {
    // CRUSADER / GOTHIC CITADEL BASTION WITH HERALDIC BANNER & GUARDIAN CAPTAIN FACE
    const chainmailMat = isWhite ? mats.crusaderChainmailLight : mats.crusaderChainmailDark;
    const surcoatMat = isWhite ? mats.crusaderWovenSurcoatLight : mats.crusaderWovenSurcoatDark;

    const towerGeo = createLatheProfile(
      'gothic_rook_tower',
      [
        [0.27, 0.21],
        [0.25, 0.38],
        [0.21, 0.72],
        [0.23, 0.86],
        [0.29, 0.95],
        [0.29, 1.06],
        [0.22, 1.06],
        [0.22, 0.96],
        [0.0, 0.96],
      ],
      40
    );
    const tower = new THREE.Mesh(towerGeo, primaryMat);
    tower.castShadow = true;
    tower.receiveShadow = true;
    bodyGroup.add(tower);

    // Woven Heraldic Tapestry Banners draped down the 4 sides of the tower
    const bannerGeo = getSharedGeo('gothic_rook_banner', () =>
      new THREE.BoxGeometry(0.12, 0.56, 0.025)
    );
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const banner = new THREE.Mesh(bannerGeo, surcoatMat);
      banner.position.set(Math.sin(a) * 0.225, 0.58, Math.cos(a) * 0.225);
      banner.rotation.y = a;
      bodyGroup.add(banner);
    }

    headGroup.position.set(0, 1.06, 0);
    const merlonGeo = getSharedGeo('gothic_rook_merlon', () =>
      new THREE.BoxGeometry(0.075, 0.11, 0.06)
    );
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const merlon = new THREE.Mesh(merlonGeo, primaryMat);
      merlon.position.set(Math.sin(a) * 0.25, 0.04, Math.cos(a) * 0.25);
      merlon.rotation.y = a;
      headGroup.add(merlon);
    }

    // Crusader Bastion Commander peering from the crenelated turret
    addCrusaderOpenHelmetWithFace(
      headGroup,
      primaryMat,
      chainmailMat,
      trimMat,
      mats,
      isWhite,
      false,
      true,
      0.88
    );

    shieldGroup.position.set(0, 0.58, 0.25);
    addGothicHeaterShield(shieldGroup, trimMat, secondaryMat, 0.92);

    weaponGroup.position.set(0.24, 0.62, 0.14);
    weaponGroup.rotation.x = 0.25;
    addGothicHalberd(weaponGroup, mats.weaponForgedSteel, trimMat, 0.92);
  }
}

function buildKnight(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material,
  mats: SanctumMaterialLibrary
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup } = actor;
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat, false);

  // Build Anatomically Recognizable 3D Warhorse (Real Horse Head, Eyes, Nostrils, Ears, Bridle, Arched Neck & Forelegs)
  buildAnatomicalWarhorse(
    bodyGroup,
    headGroup,
    theme,
    primaryMat,
    secondaryMat,
    trimMat,
    plumeMat,
    mats
  );

  if (theme === 'spartan') {
    const wheelGeo = getSharedGeo('spartan_chariot_wheel', () =>
      new THREE.TorusGeometry(0.14, 0.02, 12, 24)
    );
    for (const s of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, trimMat);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(s * 0.25, 0.34, -0.04);
      bodyGroup.add(wheel);
    }
  }

  shieldGroup.position.set(-0.21, 0.58, 0.09);
  shieldGroup.rotation.y = 0.45;
  if (theme === 'spartan') {
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.2);
  } else if (theme === 'roman') {
    addRomanScutumShield(shieldGroup, plumeMat, trimMat, 0.78);
  } else {
    addGothicHeaterShield(shieldGroup, trimMat, secondaryMat, 0.85);
  }

  weaponGroup.position.set(0.21, 0.58, 0.08);
  weaponGroup.rotation.x = Math.PI * 0.36;
  if (theme === 'spartan') {
    addSpartanDorySpear(weaponGroup, secondaryMat, trimMat, mats.weaponForgedSteel, 0.98);
  } else if (theme === 'roman') {
    addRomanGladiusSword(
      weaponGroup,
      mats.weaponForgedSteel,
      trimMat,
      mats.spartanWornLeather,
      1.05
    );
  } else {
    const lanceGeo = getSharedGeo('knight_lance', () =>
      new THREE.ConeGeometry(0.036, 0.86, 14)
    );
    const lance = new THREE.Mesh(lanceGeo, mats.weaponForgedSteel);
    lance.position.y = 0.26;
    weaponGroup.add(lance);
  }
}

function buildBishop(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material,
  mats: SanctumMaterialLibrary
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup, color } = actor;
  const isWhite = color === 'w';
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat, false);

  if (theme === 'spartan') {
    addSpartanMuscleCuirass(bodyGroup, primaryMat, secondaryMat, 1.05);

    const cloakGeo = getSharedGeo('spartan_bishop_cloak', () =>
      new THREE.CylinderGeometry(0.16, 0.26, 0.62, 24, 4, true, Math.PI * 0.55, Math.PI * 0.9)
    );
    const cloak = new THREE.Mesh(cloakGeo, plumeMat);
    cloak.position.y = 0.52;
    bodyGroup.add(cloak);

    headGroup.position.set(0, 0.92, 0);
    addSpartanCorinthianHelmetWithEyes(
      headGroup,
      primaryMat,
      secondaryMat,
      plumeMat,
      mats,
      true,
      1.04
    );

    shieldGroup.position.set(-0.22, 0.58, 0.16);
    shieldGroup.rotation.y = 0.3;
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.22);

    weaponGroup.position.set(0.22, 0.56, 0.12);
    addSpartanDorySpear(weaponGroup, secondaryMat, trimMat, mats.weaponForgedSteel, 1.15);
  } else if (theme === 'roman') {
    const togaGeo = createLatheProfile(
      'roman_bishop_toga',
      [
        [0.25, 0.21],
        [0.22, 0.42],
        [0.18, 0.68],
        [0.2, 0.82],
        [0.14, 0.9],
        [0.0, 0.9],
      ],
      40
    );
    const toga = new THREE.Mesh(togaGeo, secondaryMat);
    toga.castShadow = true;
    toga.receiveShadow = true;
    bodyGroup.add(toga);

    const sashGeo = getSharedGeo('roman_bishop_sash', () =>
      new THREE.TorusGeometry(0.195, 0.038, 12, 28)
    );
    const sash = new THREE.Mesh(sashGeo, plumeMat);
    sash.rotation.x = Math.PI / 3;
    sash.rotation.y = 0.4;
    sash.position.y = 0.62;
    bodyGroup.add(sash);

    headGroup.position.set(0, 0.98, 0);
    addRomanGaleaHelmetWithFace(
      headGroup,
      primaryMat,
      trimMat,
      plumeMat,
      mats,
      isWhite,
      true,
      true
    );

    weaponGroup.position.set(0.22, 0.54, 0.12);
    const staffGeo = getSharedGeo('roman_aquila_staff', () =>
      new THREE.CylinderGeometry(0.016, 0.018, 1.05, 14)
    );
    const staff = new THREE.Mesh(staffGeo, trimMat);
    staff.position.y = 0.35;
    weaponGroup.add(staff);

    const eagleGeo = getSharedGeo('roman_aquila_finial', () =>
      new THREE.OctahedronGeometry(0.075, 1)
    );
    const eagle = new THREE.Mesh(eagleGeo, trimMat);
    eagle.scale.set(1.5, 0.9, 0.5);
    eagle.position.y = 0.92;
    weaponGroup.add(eagle);
  } else {
    // CRUSADER / GOTHIC SANCTUM PRELATE: Chainmail + Woven Surcoat Cloth Folds + Sculpted Human Face & Mitre + Ornate Crozier
    const chainmailMat = isWhite ? mats.crusaderChainmailLight : mats.crusaderChainmailDark;
    const surcoatMat = isWhite ? mats.crusaderWovenSurcoatLight : mats.crusaderWovenSurcoatDark;
    const skinMat = isWhite ? mats.sculptedSkinLight : mats.sculptedSkinDark;

    addCrusaderChainmailAndSurcoat(
      bodyGroup,
      chainmailMat,
      surcoatMat,
      primaryMat,
      trimMat,
      1.06
    );

    headGroup.position.set(0, 0.94, 0);
    addSculptedHumanFace(
      headGroup,
      skinMat,
      mats.eyeScleraMat,
      mats.eyeIrisMat,
      secondaryMat,
      { scale: 0.98, hasBeard: true }
    );

    // Tall Ecclesiastical Mitre sitting on the Prelate's head above the brow
    const mitreGeo = createLatheProfile(
      'gothic_bishop_mitre',
      [
        [0.0, 0.04],
        [0.135, 0.04],
        [0.155, 0.15],
        [0.115, 0.28],
        [0.032, 0.38],
        [0.0, 0.4],
      ],
      32
    );
    const mitre = new THREE.Mesh(mitreGeo, secondaryMat);
    mitre.castShadow = true;
    headGroup.add(mitre);

    const crossV = new THREE.Mesh(
      getSharedGeo('mitre_cross_v', () => new THREE.BoxGeometry(0.022, 0.1, 0.022)),
      trimMat
    );
    crossV.position.y = 0.44;
    const crossH = new THREE.Mesh(
      getSharedGeo('mitre_cross_h', () => new THREE.BoxGeometry(0.07, 0.022, 0.022)),
      trimMat
    );
    crossH.position.y = 0.45;
    headGroup.add(crossV, crossH);

    weaponGroup.position.set(0.22, 0.52, 0.12);
    const staff = new THREE.Mesh(
      getSharedGeo('crozier_staff', () => new THREE.CylinderGeometry(0.015, 0.018, 0.98, 14)),
      trimMat
    );
    staff.position.y = 0.32;
    weaponGroup.add(staff);

    const spiral = new THREE.Mesh(
      getSharedGeo('crozier_spiral', () =>
        new THREE.TorusGeometry(0.068, 0.015, 12, 28, Math.PI * 1.65)
      ),
      trimMat
    );
    spiral.position.set(0, 0.85, 0.02);
    spiral.rotation.y = Math.PI / 2;
    weaponGroup.add(spiral);
  }
}

function buildQueen(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material,
  mats: SanctumMaterialLibrary
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup, color } = actor;
  const isWhite = color === 'w';
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat, false);

  const surcoatMat = isWhite ? mats.crusaderWovenSurcoatLight : mats.crusaderWovenSurcoatDark;
  const chainmailMat = isWhite ? mats.crusaderChainmailLight : mats.crusaderChainmailDark;
  const skinMat = isWhite ? mats.sculptedSkinLight : mats.sculptedSkinDark;

  const gownGeo = createLatheProfile(
    'queen_gown',
    [
      [0.27, 0.21],
      [0.23, 0.45],
      [0.15, 0.72],
      [0.19, 0.9],
      [0.13, 1.02],
      [0.0, 1.02],
    ],
    40
  );
  const gown = new THREE.Mesh(
    gownGeo,
    theme === 'gothic' ? surcoatMat : theme === 'roman' ? secondaryMat : primaryMat
  );
  gown.castShadow = true;
  gown.receiveShadow = true;
  bodyGroup.add(gown);

  // Sculpted 3D Royal Gown Drapery Pleats (Realistic Cloth Folds)
  const pleatGeo = getSharedGeo('queen_drapery_pleat', () =>
    new THREE.CylinderGeometry(0.018, 0.032, 0.62, 10)
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pleat = new THREE.Mesh(pleatGeo, theme === 'gothic' ? surcoatMat : plumeMat);
    pleat.position.set(Math.sin(a) * 0.21, 0.52, Math.cos(a) * 0.21);
    pleat.rotation.z = -Math.sin(a) * 0.1;
    pleat.rotation.x = Math.cos(a) * 0.1;
    bodyGroup.add(pleat);
  }

  const mantleGeo = getSharedGeo('queen_mantle', () =>
    new THREE.TorusGeometry(0.18, 0.038, 14, 32)
  );
  const mantle = new THREE.Mesh(
    mantleGeo,
    theme === 'gothic' ? chainmailMat : plumeMat
  );
  mantle.rotation.x = Math.PI / 2 + 0.18;
  mantle.position.set(0, 0.94, -0.02);
  bodyGroup.add(mantle);

  headGroup.position.set(0, 1.11, 0);
  if (theme === 'spartan') {
    addSpartanCorinthianHelmetWithEyes(
      headGroup,
      primaryMat,
      secondaryMat,
      plumeMat,
      mats,
      true,
      1.05
    );
    shieldGroup.position.set(-0.22, 0.68, 0.15);
    shieldGroup.rotation.y = 0.35;
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.21);

    weaponGroup.position.set(0.22, 0.68, 0.12);
    addSpartanDorySpear(weaponGroup, secondaryMat, trimMat, mats.weaponForgedSteel, 1.12);
  } else if (theme === 'roman') {
    // ROMAN EMPRESS AUGUSTA: Sculpted Human Face with Eyes + Golden Diadem Crown + DISTINCT REGAL WEAPON (Imperial Aquila Parazonium Sword-Scepter)!
    addSculptedHumanFace(
      headGroup,
      skinMat,
      mats.eyeScleraMat,
      mats.eyeIrisMat,
      plumeMat,
      { scale: 1.0, hasBeard: false }
    );

    const diademGeo = getSharedGeo('roman_queen_diadem', () =>
      new THREE.TorusGeometry(0.122, 0.022, 12, 28)
    );
    const diadem = new THREE.Mesh(diademGeo, trimMat);
    diadem.rotation.x = Math.PI / 2 - 0.15;
    diadem.position.y = 0.065;
    headGroup.add(diadem);

    const spireGeo = getSharedGeo('queen_crown_spire', () =>
      new THREE.ConeGeometry(0.022, 0.12, 8)
    );
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      const spire = new THREE.Mesh(spireGeo, trimMat);
      spire.position.set(Math.sin(a) * 0.12, 0.13, Math.cos(a) * 0.12);
      headGroup.add(spire);
    }

    weaponGroup.position.set(0.24, 0.66, 0.16);
    weaponGroup.rotation.x = 0.32;
    addRomanQueenRegalWeapon(
      weaponGroup,
      mats.weaponForgedSteel,
      trimMat,
      plumeMat
    );
  } else {
    // CRUSADER / GOTHIC QUEEN: Sculpted Human Face with Eyes + Jeweled Crown + Regal Broadsword Scepter
    addCrusaderOpenHelmetWithFace(
      headGroup,
      primaryMat,
      chainmailMat,
      trimMat,
      mats,
      isWhite,
      true,
      false,
      1.0
    );

    weaponGroup.position.set(0.23, 0.66, 0.15);
    weaponGroup.rotation.x = 0.26;
    addRomanQueenRegalWeapon(
      weaponGroup,
      mats.weaponForgedSteel,
      trimMat,
      plumeMat
    );
  }
}

function buildKing(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material,
  mats: SanctumMaterialLibrary
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup, color } = actor;
  const isWhite = color === 'w';
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat, false);

  if (theme === 'spartan') {
    addSpartanMuscleCuirass(bodyGroup, primaryMat, secondaryMat, 1.16);

    const capeGeo = getSharedGeo('spartan_king_cape', () =>
      new THREE.CylinderGeometry(0.19, 0.29, 0.76, 24, 4, true, Math.PI * 0.55, Math.PI * 0.9)
    );
    const cape = new THREE.Mesh(capeGeo, plumeMat);
    cape.position.y = 0.58;
    bodyGroup.add(cape);

    headGroup.position.set(0, 1.05, 0);
    addSpartanCorinthianHelmetWithEyes(
      headGroup,
      primaryMat,
      secondaryMat,
      plumeMat,
      mats,
      true,
      1.15
    );

    shieldGroup.position.set(-0.25, 0.66, 0.18);
    shieldGroup.rotation.y = 0.28;
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.26);

    weaponGroup.position.set(0.25, 0.64, 0.14);
    weaponGroup.rotation.x = 0.25;
    addSpartanDorySpear(weaponGroup, secondaryMat, trimMat, mats.weaponForgedSteel, 1.25);
  } else if (theme === 'roman') {
    const skinMat = isWhite ? mats.sculptedSkinLight : mats.sculptedSkinDark;
    addLoricaSegmentataTorso(bodyGroup, primaryMat, plumeMat, trimMat, 1.14);

    const cloakGeo = getSharedGeo('roman_emperor_cloak', () =>
      new THREE.CylinderGeometry(0.19, 0.28, 0.74, 24, 4, true, Math.PI * 0.5, Math.PI)
    );
    const cloak = new THREE.Mesh(cloakGeo, plumeMat);
    cloak.position.y = 0.56;
    bodyGroup.add(cloak);

    headGroup.position.set(0, 1.04, 0);
    addSculptedHumanFace(
      headGroup,
      skinMat,
      mats.eyeScleraMat,
      mats.eyeIrisMat,
      secondaryMat,
      { scale: 1.05, hasBeard: false }
    );

    // Sculpted Golden Laurel Wreath (Corona Triumphalis)
    const wreathBaseGeo = getSharedGeo('roman_laurel_wreath', () =>
      new THREE.TorusGeometry(0.128, 0.018, 12, 28, Math.PI * 1.75)
    );
    const wreathBase = new THREE.Mesh(wreathBaseGeo, trimMat);
    wreathBase.rotation.x = Math.PI / 2 - 0.15;
    wreathBase.rotation.z = -Math.PI * 0.375;
    wreathBase.position.y = 0.055;
    headGroup.add(wreathBase);

    const leafGeo = getSharedGeo('roman_laurel_leaf', () =>
      new THREE.ConeGeometry(0.02, 0.06, 6)
    );
    for (let l = 0; l < 12; l++) {
      const a = -Math.PI * 0.8 + (l / 11) * Math.PI * 1.6;
      const leaf = new THREE.Mesh(leafGeo, trimMat);
      leaf.position.set(Math.sin(a) * 0.132, 0.065, Math.cos(a) * 0.132);
      leaf.rotation.z = -Math.cos(a) * 0.6;
      leaf.rotation.x = Math.sin(a) * 0.6;
      headGroup.add(leaf);
    }

    shieldGroup.position.set(-0.24, 0.62, 0.18);
    shieldGroup.rotation.y = 0.25;
    addRomanScutumShield(shieldGroup, plumeMat, trimMat, 0.96);

    weaponGroup.position.set(0.24, 0.62, 0.16);
    weaponGroup.rotation.x = 0.28;
    addRomanGladiusSword(
      weaponGroup,
      mats.weaponForgedSteel,
      trimMat,
      mats.spartanWornLeather,
      1.15
    );
  } else {
    // DEFAULT / CRUSADER HIGH MONARCH KING: Chainmail + Draped Heraldic Surcoat + Sculpted Bearded Face with Eyes + Royal Crown & Broadsword!
    const chainmailMat = isWhite ? mats.crusaderChainmailLight : mats.crusaderChainmailDark;
    const surcoatMat = isWhite ? mats.crusaderWovenSurcoatLight : mats.crusaderWovenSurcoatDark;

    addCrusaderChainmailAndSurcoat(
      bodyGroup,
      chainmailMat,
      surcoatMat,
      primaryMat,
      trimMat,
      1.16
    );

    headGroup.position.set(0, 1.12, 0);
    addCrusaderOpenHelmetWithFace(
      headGroup,
      primaryMat,
      chainmailMat,
      trimMat,
      mats,
      isWhite,
      true,
      true,
      1.08
    );

    // Royal Crown Cross Finial
    const vCross = new THREE.Mesh(
      getSharedGeo('king_cross_v', () => new THREE.BoxGeometry(0.036, 0.18, 0.036)),
      trimMat
    );
    vCross.position.y = 0.26;
    const hCross = new THREE.Mesh(
      getSharedGeo('king_cross_h', () => new THREE.BoxGeometry(0.14, 0.036, 0.036)),
      trimMat
    );
    hCross.position.y = 0.28;
    headGroup.add(vCross, hCross);

    shieldGroup.position.set(-0.24, 0.64, 0.18);
    shieldGroup.rotation.y = 0.28;
    addGothicHeaterShield(shieldGroup, secondaryMat, trimMat, 1.02);

    weaponGroup.position.set(0.24, 0.62, 0.18);
    weaponGroup.rotation.x = 0.25;
    addRomanGladiusSword(
      weaponGroup,
      mats.weaponForgedSteel,
      trimMat,
      secondaryMat,
      1.22
    );
  }
}

/**
 * Resolves the PBR material palette for a given FactionTheme and PieceColor.
 */
function resolveFactionMaterials(
  theme: FactionTheme,
  color: PieceColor,
  materials: SanctumMaterialLibrary
): {
  primaryMat: THREE.Material;
  secondaryMat: THREE.Material;
  trimMat: THREE.Material;
  plumeMat: THREE.Material;
} {
  const isWhite = color === 'w';
  if (theme === 'spartan') {
    return {
      primaryMat: isWhite ? materials.spartanBronze : materials.spartanDarkBronze,
      secondaryMat: materials.spartanWornLeather,
      trimMat: isWhite ? materials.goldFiligree : materials.spartanBronze,
      plumeMat: isWhite ? materials.spartanCrimsonPlume : materials.spartanBlackPlume,
    };
  }
  if (theme === 'roman') {
    return {
      primaryMat: isWhite ? materials.romanPolishedSteel : materials.romanDarkSteel,
      secondaryMat: isWhite ? materials.romanImperialMarble : materials.romanDarkBasalt,
      trimMat: materials.romanImperialGold,
      plumeMat: isWhite ? materials.romanCrimsonTunic : materials.romanPurpleTunic,
    };
  }
  return {
    primaryMat: isWhite ? materials.marblePolished : materials.obsidianGlass,
    secondaryMat: isWhite ? materials.marbleCarvedMatte : materials.obsidianEtchedMatte,
    trimMat: materials.goldFiligree,
    plumeMat: materials.crimsonTrim,
  };
}

interface MergedMeshPart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

interface CompiledPieceTemplate {
  bodyParts: MergedMeshPart[];
  headParts: MergedMeshPart[];
  weaponParts: MergedMeshPart[];
  shieldParts: MergedMeshPart[];
  headPos: THREE.Vector3;
  headRot: THREE.Euler;
  weaponPos: THREE.Vector3;
  weaponRot: THREE.Euler;
  shieldPos: THREE.Vector3;
  shieldRot: THREE.Euler;
}

const MERGED_TEMPLATE_CACHE = new Map<string, CompiledPieceTemplate>();
const _invGroupMatrix = new THREE.Matrix4();
const _childRelativeMatrix = new THREE.Matrix4();

/**
 * Merges all descendant THREE.Mesh geometries within a sub-group that share the same
 * THREE.Material into a single BufferGeometry, reducing per-piece draw calls by ~75%
 * while preserving full vertex/normal/UV/UV2 detail and sub-group articulation.
 */
function compileSubGroupParts(subGroup: THREE.Group): MergedMeshPart[] {
  subGroup.updateWorldMatrix(true, true);
  _invGroupMatrix.copy(subGroup.matrixWorld).invert();

  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();

  subGroup.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat) return;

    _childRelativeMatrix.multiplyMatrices(_invGroupMatrix, mesh.matrixWorld);
    const nonIndexed = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();

    nonIndexed.applyMatrix4(_childRelativeMatrix);
    if (!nonIndexed.attributes.normal) {
      nonIndexed.computeVertexNormals();
    }

    const posAttr = nonIndexed.attributes.position;
    if (!posAttr) {
      nonIndexed.dispose();
      return;
    }

    let uvAttr = nonIndexed.attributes.uv;
    if (!uvAttr || uvAttr.count !== posAttr.count) {
      uvAttr = new THREE.Float32BufferAttribute(new Float32Array(posAttr.count * 2), 2);
      nonIndexed.setAttribute('uv', uvAttr);
    }
    nonIndexed.setAttribute('uv2', uvAttr.clone());

    // Keep only position, normal, uv, uv2 so mergeGeometries always succeeds
    for (const attrName of Object.keys(nonIndexed.attributes)) {
      if (
        attrName !== 'position' &&
        attrName !== 'normal' &&
        attrName !== 'uv' &&
        attrName !== 'uv2'
      ) {
        nonIndexed.deleteAttribute(attrName);
      }
    }
    nonIndexed.morphAttributes = {};

    let list = byMat.get(mat);
    if (!list) {
      list = [];
      byMat.set(mat, list);
    }
    list.push(nonIndexed);
  });

  const result: MergedMeshPart[] = [];
  byMat.forEach((geos, mat) => {
    if (geos.length === 0) return;
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) {
      for (const g of geos) g.dispose();
    }
    if (merged) {
      result.push({ geo: merged, mat });
    }
  });

  return result;
}

function populateGroupFromParts(group: THREE.Group, parts: MergedMeshPart[]): void {
  for (const part of parts) {
    const mesh = new THREE.Mesh(part.geo, part.mat);
    mesh.castShadow = !IS_HEADLESS;
    mesh.receiveShadow = !IS_HEADLESS;
    group.add(mesh);
  }
}

/**
 * Populates a PieceActor's geometry groups for the specified FactionTheme,
 * utilizing cached & per-material merged geometry templates for zero-lag rendering.
 */
export function populatePieceGeometry(
  actor: PieceActor,
  theme: FactionTheme,
  materials: SanctumMaterialLibrary
): void {
  const clearGroup = (g: THREE.Group) => {
    while (g.children.length > 0) {
      g.remove(g.children[0]);
    }
  };

  clearGroup(actor.bodyGroup);
  clearGroup(actor.headGroup);
  clearGroup(actor.weaponGroup);
  clearGroup(actor.shieldGroup);

  actor.theme = theme;
  const cacheKey = `${theme}_${actor.type}_${actor.color}`;
  let template = MERGED_TEMPLATE_CACHE.get(cacheKey);

  if (!template) {
    const { primaryMat, secondaryMat, trimMat, plumeMat } = resolveFactionMaterials(
      theme,
      actor.color,
      materials
    );

    actor.bodyGroup.position.set(0, 0, 0);
    actor.bodyGroup.rotation.set(0, 0, 0);
    actor.headGroup.position.set(0, 0, 0);
    actor.headGroup.rotation.set(0, 0, 0);
    actor.weaponGroup.position.set(0, 0, 0);
    actor.weaponGroup.rotation.set(0, 0, 0);
    actor.shieldGroup.position.set(0, 0, 0);
    actor.shieldGroup.rotation.set(0, 0, 0);

    switch (actor.type) {
      case 'p':
        buildPawn(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat, materials);
        break;
      case 'r':
        buildRook(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat, materials);
        break;
      case 'n':
        buildKnight(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat, materials);
        break;
      case 'b':
        buildBishop(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat, materials);
        break;
      case 'q':
        buildQueen(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat, materials);
        break;
      case 'k':
        buildKing(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat, materials);
        break;
    }

    template = {
      bodyParts: compileSubGroupParts(actor.bodyGroup),
      headParts: compileSubGroupParts(actor.headGroup),
      weaponParts: compileSubGroupParts(actor.weaponGroup),
      shieldParts: compileSubGroupParts(actor.shieldGroup),
      headPos: actor.headGroup.position.clone(),
      headRot: actor.headGroup.rotation.clone(),
      weaponPos: actor.weaponGroup.position.clone(),
      weaponRot: actor.weaponGroup.rotation.clone(),
      shieldPos: actor.shieldGroup.position.clone(),
      shieldRot: actor.shieldGroup.rotation.clone(),
    };
    MERGED_TEMPLATE_CACHE.set(cacheKey, template);

    clearGroup(actor.bodyGroup);
    clearGroup(actor.headGroup);
    clearGroup(actor.weaponGroup);
    clearGroup(actor.shieldGroup);
  }

  actor.headGroup.position.copy(template.headPos);
  actor.headGroup.rotation.copy(template.headRot);
  actor.weaponGroup.position.copy(template.weaponPos);
  actor.weaponGroup.rotation.copy(template.weaponRot);
  actor.shieldGroup.position.copy(template.shieldPos);
  actor.shieldGroup.rotation.copy(template.shieldRot);

  actor.weaponGroup.userData.restZ = template.weaponPos.z;
  actor.weaponGroup.userData.restY = template.weaponPos.y;
  actor.weaponGroup.userData.restRotX = template.weaponRot.x;
  actor.shieldGroup.userData.restZ = template.shieldPos.z;
  actor.shieldGroup.userData.restRotY = template.shieldRot.y;

  populateGroupFromParts(actor.bodyGroup, template.bodyParts);
  populateGroupFromParts(actor.headGroup, template.headParts);
  populateGroupFromParts(actor.weaponGroup, template.weaponParts);
  populateGroupFromParts(actor.shieldGroup, template.shieldParts);
}

/**
 * Builds a complete, forward-oriented 3D Chess Piece for the active FactionTheme.
 */
export function buildWizardChessPiece(
  id: string,
  type: PieceType,
  color: PieceColor,
  row: number,
  col: number,
  materials: SanctumMaterialLibrary,
  theme: FactionTheme = 'gothic'
): PieceActor {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const headGroup = new THREE.Group();
  const weaponGroup = new THREE.Group();
  const shieldGroup = new THREE.Group();

  root.add(bodyGroup);
  root.add(headGroup);
  root.add(weaponGroup);
  root.add(shieldGroup);

  const facingYaw = getPieceFacingYaw(color);
  root.rotation.y = facingYaw;

  const actor: PieceActor = {
    id,
    type,
    color,
    theme,
    row,
    col,
    facingYaw,
    root,
    bodyGroup,
    headGroup,
    weaponGroup,
    shieldGroup,
    phaseOffset: (row * 8 + col) * 0.73,
  };

  populatePieceGeometry(actor, theme, materials);
  return actor;
}

export function disposePieceBuilderGeometries(): void {
  SHARED_GEO_POOL.forEach((geo) => geo.dispose());
  SHARED_GEO_POOL.clear();
  MERGED_TEMPLATE_CACHE.forEach((tpl) => {
    tpl.bodyParts.forEach((p) => p.geo.dispose());
    tpl.headParts.forEach((p) => p.geo.dispose());
    tpl.weaponParts.forEach((p) => p.geo.dispose());
    tpl.shieldParts.forEach((p) => p.geo.dispose());
  });
  MERGED_TEMPLATE_CACHE.clear();
}



