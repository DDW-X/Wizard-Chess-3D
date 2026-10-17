import * as THREE from 'three';
import { PieceColor, PieceType } from '../game/chessEngine';
import { FactionTheme, getPieceFacingYaw } from '../game/physicsKinematics';
import { SanctumMaterialLibrary } from './materials';

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

function createLatheProfile(points: [number, number][], segments = 48): THREE.LatheGeometry {
  const vecs = points.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(vecs, IS_HEADLESS ? 16 : segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Adds a faction-themed circular plinth base at the bottom of every piece.
 */
function addPedestalBase(
  parent: THREE.Group,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material
): void {
  const baseGeo = createLatheProfile(
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
    48
  );
  const baseMesh = new THREE.Mesh(baseGeo, primaryMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  parent.add(baseMesh);

  const ringGeo = new THREE.TorusGeometry(0.355, 0.017, 16, 48);
  ringGeo.rotateX(Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, trimMat);
  ringMesh.position.y = 0.09;
  parent.add(ringMesh);

  const upperRingGeo = new THREE.TorusGeometry(0.265, 0.014, 16, 48);
  upperRingGeo.rotateX(Math.PI / 2);
  const upperRingMesh = new THREE.Mesh(upperRingGeo, trimMat);
  upperRingMesh.position.y = 0.2;
  parent.add(upperRingMesh);

  const collarGeo = new THREE.CylinderGeometry(0.25, 0.28, 0.04, 32);
  const collarMesh = new THREE.Mesh(collarGeo, secondaryMat);
  collarMesh.position.y = 0.22;
  parent.add(collarMesh);
}

// ============================================================================
// 1. GOTHIC FACTION BUILDERS (Museum-Grade Carved Alabaster SSS vs Obsidian)
// ============================================================================

function addGothicHeaterShield(
  shieldGroup: THREE.Group,
  primaryMat: THREE.Material,
  trimMat: THREE.Material,
  scale = 1.0
): void {
  const shape = new THREE.Shape();
  shape.moveTo(-0.14 * scale, 0.16 * scale);
  shape.lineTo(0.14 * scale, 0.16 * scale);
  shape.quadraticCurveTo(0.15 * scale, -0.04 * scale, 0, -0.22 * scale);
  shape.quadraticCurveTo(-0.15 * scale, -0.04 * scale, -0.14 * scale, 0.16 * scale);

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.026 * scale,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 2,
    bevelSize: 0.012 * scale,
    bevelThickness: 0.012 * scale,
  });
  extrudeGeo.center();

  const shieldMesh = new THREE.Mesh(extrudeGeo, primaryMat);
  shieldMesh.castShadow = true;
  shieldMesh.receiveShadow = true;
  shieldGroup.add(shieldMesh);

  const vBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.028 * scale, 0.26 * scale, 0.018 * scale),
    trimMat
  );
  vBar.position.set(0, 0.01 * scale, 0.022 * scale);
  shieldGroup.add(vBar);

  const hBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * scale, 0.028 * scale, 0.018 * scale),
    trimMat
  );
  hBar.position.set(0, 0.04 * scale, 0.022 * scale);
  shieldGroup.add(hBar);
}

function addGothicHalberd(
  weaponGroup: THREE.Group,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  height = 0.88
): void {
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.019, height, 16),
    trimMat
  );
  shaft.position.y = height * 0.35;
  shaft.castShadow = true;
  weaponGroup.add(shaft);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.22, 12), trimMat);
  tip.position.y = height * 0.85;
  weaponGroup.add(tip);

  const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.16, 0.13), secondaryMat);
  axeBlade.position.set(0, height * 0.68, 0.06);
  weaponGroup.add(axeBlade);
}

// ============================================================================
// 2. SPARTAN FACTION BUILDERS (Corinthian Helmets, Muscle Cuirass, Pteruges, Dented Aspis)
// ============================================================================

const SHARED_STUD_GEO = new THREE.SphereGeometry(0.012, 8, 6);
const SHARED_AB_GEO = new THREE.SphereGeometry(0.044, 12, 10);
const SHARED_PEC_GEO = new THREE.SphereGeometry(0.088, 16, 12);
const SHARED_SHOULDER_GEO = new THREE.SphereGeometry(0.082, 14, 12);

/**
 * Builds a historically accurate two-tiered Woven Leather Pteruges skirt with
 * individual overlapping leather lappets and bronze terminal studs.
 */
function addSpartanPterugesSkirt(
  parent: THREE.Group,
  leatherMat: THREE.Material,
  bronzeMat: THREE.Material,
  waistY = 0.34,
  radius = 0.16,
  length = 0.16
): void {
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.02, radius * 1.04, 0.038, 20),
    bronzeMat
  );
  belt.position.y = waistY + length * 0.45;
  parent.add(belt);

  const lappetGeo = new THREE.BoxGeometry(0.052, length, 0.018, 2, 4, 1);
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
    strip.position.y = -length * 0.5;
    lappetGroup.add(strip);

    const stud = new THREE.Mesh(SHARED_STUD_GEO, bronzeMat);
    stud.position.set(0, -length * 0.86, 0.01);
    lappetGroup.add(stud);

    parent.add(lappetGroup);
  }
}

/**
 * Builds an anatomically sculpted Greek Bronze Muscle Cuirass (Thorax)
 * with pectoral reliefs, six-pack abdominal contours, and Pteruges leather lappets.
 */
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
    [
      [0.16 * scale, 0.38 * scale],
      [0.155 * scale, 0.45 * scale],
      [0.195 * scale, 0.56 * scale],
      [0.215 * scale, 0.65 * scale],
      [0.16 * scale, 0.72 * scale],
      [0.0, 0.73 * scale],
    ],
    36
  );
  const torso = new THREE.Mesh(torsoGeo, bronzeMat);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);

  for (const side of [-1, 1]) {
    const pec = new THREE.Mesh(SHARED_PEC_GEO, bronzeMat);
    pec.scale.set(1.05 * scale, 0.85 * scale, 0.55 * scale);
    pec.position.set(side * 0.068 * scale, 0.61 * scale, 0.145 * scale);
    bodyGroup.add(pec);

    for (let row = 0; row < 3; row++) {
      const ab = new THREE.Mesh(SHARED_AB_GEO, bronzeMat);
      ab.scale.set(1.1 * scale, 0.72 * scale, 0.48 * scale);
      ab.position.set(
        side * 0.038 * scale,
        (0.52 - row * 0.045) * scale,
        (0.155 - row * 0.006) * scale
      );
      bodyGroup.add(ab);
    }

    const shoulder = new THREE.Mesh(SHARED_SHOULDER_GEO, bronzeMat);
    shoulder.scale.set(1.1 * scale, 0.75 * scale, 1.15 * scale);
    shoulder.position.set(side * 0.195 * scale, 0.67 * scale, 0.01 * scale);
    bodyGroup.add(shoulder);
  }
}

/**
 * Builds a photorealistic Spartan Corinthian Helmet with high-subdivision dome,
 * swept cheek plates, flared neck guard, vertical nasal bar, and horsehair crest.
 */
function addCorinthianHelmet(
  headGroup: THREE.Group,
  bronzeMat: THREE.Material,
  darkRecessMat: THREE.Material,
  plumeMat: THREE.Material,
  transverseCrest = false,
  scale = 1.0
): void {
  // High-segment cranial bronze dome (displaced by scarred bronze displacement map)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.145 * scale, 36, 28), bronzeMat);
  skull.scale.set(0.95, 1.12, 1.08);
  skull.position.y = 0.04 * scale;
  skull.castShadow = true;
  headGroup.add(skull);

  // Dark inner shadow core visible through eye slits and mouth opening
  const shadowCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.2 * scale, 20),
    darkRecessMat
  );
  shadowCore.position.set(0, -0.01 * scale, 0.02 * scale);
  headGroup.add(shadowCore);

  // Flared rear neck guard
  const neckFlare = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135 * scale, 0.165 * scale, 0.1 * scale, 24, 4, true, Math.PI * 0.55, Math.PI * 0.9),
    bronzeMat
  );
  neckFlare.position.set(0, -0.04 * scale, -0.01 * scale);
  headGroup.add(neckFlare);

  // Prominent Brow Ridge
  const brow = new THREE.Mesh(
    new THREE.TorusGeometry(0.138 * scale, 0.018 * scale, 12, 28, Math.PI * 0.85),
    bronzeMat
  );
  brow.rotation.x = Math.PI / 2 - 0.12;
  brow.rotation.z = -Math.PI * 0.425;
  brow.position.set(0, 0.035 * scale, 0.02 * scale);
  headGroup.add(brow);

  // Central Corinthian Nasal Guard Bar (+Z front)
  const nasal = new THREE.Mesh(
    new THREE.BoxGeometry(0.026 * scale, 0.11 * scale, 0.032 * scale),
    bronzeMat
  );
  nasal.position.set(0, -0.005 * scale, 0.148 * scale);
  nasal.rotation.x = -0.08;
  headGroup.add(nasal);

  // Swept Left & Right Corinthian Cheek Plates framing the central T-slit
  for (const side of [-1, 1]) {
    const cheekShape = new THREE.Shape();
    cheekShape.moveTo(0, 0.02 * scale);
    cheekShape.lineTo(0.095 * scale, 0.01 * scale);
    cheekShape.lineTo(0.08 * scale, -0.11 * scale);
    cheekShape.lineTo(0.012 * scale, -0.095 * scale);
    cheekShape.closePath();

    const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
      depth: 0.022 * scale,
      bevelEnabled: true,
      bevelSize: 0.006 * scale,
      bevelThickness: 0.006 * scale,
      bevelSegments: 3,
    });
    const cheek = new THREE.Mesh(cheekGeo, bronzeMat);
    cheek.scale.x = side;
    cheek.position.set(side * 0.018 * scale, -0.005 * scale, 0.132 * scale);
    cheek.rotation.y = side * 0.52;
    cheek.castShadow = true;
    headGroup.add(cheek);
  }

  // Iconic Horsehair Crest (Longitudinal for Hoplites, Transverse for Spartan Royals/Commanders)
  const crestHolder = new THREE.Mesh(
    new THREE.TorusGeometry(0.155 * scale, 0.018 * scale, 12, 28, Math.PI * 1.05),
    bronzeMat
  );
  const crestHair = new THREE.Mesh(
    new THREE.TorusGeometry(0.185 * scale, 0.052 * scale, 18, 36, Math.PI * 1.12),
    plumeMat
  );
  crestHair.castShadow = true;

  if (transverseCrest) {
    crestHolder.rotation.z = -0.02;
    crestHolder.position.set(0, 0.06 * scale, 0);
    crestHair.rotation.z = -0.06;
    crestHair.scale.set(1.15, 1.08, 0.42);
    crestHair.position.set(0, 0.08 * scale, 0);
  } else {
    crestHolder.rotation.y = Math.PI / 2;
    crestHolder.rotation.z = 0.1;
    crestHolder.position.set(0, 0.05 * scale, -0.01 * scale);
    crestHair.rotation.y = Math.PI / 2;
    crestHair.rotation.z = 0.08;
    crestHair.scale.set(1.05, 1.1, 0.42);
    crestHair.position.set(0, 0.07 * scale, -0.01 * scale);
  }
  headGroup.add(crestHolder, crestHair);
}

/**
 * Builds a heavy, battle-dented concave Spartan Bronze Aspis (Hoplon) shield
 * with embossed Lambda (Λ) emblem and displacement-mapped surface.
 */
function addSpartanAspisShield(
  shieldGroup: THREE.Group,
  bronzeMat: THREE.Material,
  trimMat: THREE.Material,
  radius = 0.25
): void {
  // Deep concave bronze dish (high segments so displacement map creates authentic battle dents)
  const dishGeo = createLatheProfile(
    [
      [0.0, 0.048],
      [radius * 0.45, 0.044],
      [radius * 0.84, 0.022],
      [radius, 0.0],
      [radius, -0.018],
      [radius * 0.85, 0.008],
      [0.0, 0.028],
    ],
    48
  );
  dishGeo.rotateX(Math.PI / 2);
  const dish = new THREE.Mesh(dishGeo, bronzeMat);
  dish.castShadow = true;
  dish.receiveShadow = true;
  shieldGroup.add(dish);

  // Heavy reinforced outer rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.96, 0.022, 16, 48),
    bronzeMat
  );
  rim.position.z = 0.012;
  shieldGroup.add(rim);

  // Raised Spartan Lambda (Λ) chevron on +Z outer face
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, radius * 0.86, 0.018),
    trimMat
  );
  leftLeg.position.set(-0.044, 0.01, 0.046);
  leftLeg.rotation.z = -0.34;
  shieldGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, radius * 0.86, 0.018),
    trimMat
  );
  rightLeg.position.set(0.044, 0.01, 0.046);
  rightLeg.rotation.z = 0.34;
  shieldGroup.add(rightLeg);
}

function addSpartanDorySpear(
  weaponGroup: THREE.Group,
  shaftMat: THREE.Material,
  bronzeMat: THREE.Material,
  length = 1.15
): void {
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.017, length, 16),
    shaftMat
  );
  shaft.position.y = length * 0.36;
  shaft.castShadow = true;
  weaponGroup.add(shaft);

  // Leaf-shaped iron/bronze spearhead
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.25, 12), bronzeMat);
  head.scale.set(0.55, 1.0, 1.25);
  head.position.y = length * 0.88;
  weaponGroup.add(head);

  // Sauroter ("lizard-killer" bronze butt-spike)
  const buttSpike = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.14, 12), bronzeMat);
  buttSpike.rotation.x = Math.PI;
  buttSpike.position.y = -length * 0.14;
  weaponGroup.add(buttSpike);
}

// ============================================================================
// 3. ROMAN EMPIRE FACTION BUILDERS (Polished Lorica Segmentata Steel, Galea & Scutum)
// ============================================================================

/**
 * Builds historically accurate Roman Lorica Segmentata laminated steel plate armor:
 * - Highly polished horizontal overlapping iron/steel girth hoops (`romanPolishedSteel` / `romanDarkSteel`)
 * - Multi-band curved shoulder guards (Epaulettes)
 * - Brass lobate hinges & leather subarmalis tunic
 */
function addLoricaSegmentataTorso(
  bodyGroup: THREE.Group,
  steelMat: THREE.Material,
  tunicMat: THREE.Material,
  goldMat: THREE.Material,
  scale = 1.0
): void {
  // Underlying crimson/purple woolen Tunica & leather subarmalis
  const tunic = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165 * scale, 0.215 * scale, 0.28 * scale, 32),
    tunicMat
  );
  tunic.position.y = 0.33 * scale;
  tunic.castShadow = true;
  bodyGroup.add(tunic);

  // Cingulum Militare (Roman military belt with hanging brass-studded Baltea apron)
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.182 * scale, 0.182 * scale, 0.036 * scale, 32),
    goldMat
  );
  belt.position.y = 0.4 * scale;
  bodyGroup.add(belt);

  for (let i = -2; i <= 2; i++) {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.022 * scale, 0.16 * scale, 0.015 * scale),
      goldMat
    );
    strap.position.set(i * 0.032 * scale, 0.31 * scale, 0.182 * scale);
    bodyGroup.add(strap);
  }

  // 6 Horizontal Overlapping Polished Steel Girth Hoops (Lorica Segmentata)
  for (let h = 0; h < 6; h++) {
    const y = (0.43 + h * 0.044) * scale;
    const r = (0.178 + h * 0.0055) * scale;
    const hoop = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.02, r * 0.98, 0.042 * scale, 36),
      steelMat
    );
    hoop.position.y = y;
    hoop.castShadow = true;
    hoop.receiveShadow = true;
    bodyGroup.add(hoop);

    // Central vertical split seam & brass fastening hooks on chest (+Z)
    const fastener = new THREE.Mesh(
      new THREE.BoxGeometry(0.034 * scale, 0.02 * scale, 0.018 * scale),
      goldMat
    );
    fastener.position.set(0, y, r + 0.006 * scale);
    bodyGroup.add(fastener);
  }

  // 4-Band Segmented Shoulder Epaulettes (Left & Right)
  for (const side of [-1, 1]) {
    for (let b = 0; b < 4; b++) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry((0.088 - b * 0.008) * scale, 0.024 * scale, 12, 24, Math.PI),
        steelMat
      );
      arch.position.set(
        side * (0.13 + b * 0.024) * scale,
        0.65 * scale,
        0
      );
      arch.rotation.y = Math.PI / 2;
      arch.rotation.x = side * 0.22;
      arch.castShadow = true;
      bodyGroup.add(arch);
    }
  }
}

/**
 * Builds a historically accurate Roman Imperial Galea Helmet with polished steel skull-cap,
 * projecting brow deflector, flared lobster-tail neck guard, hinged Bucca cheek plates,
 * and vibrant crimson/purple horsehair crest.
 */
function addRomanGaleaHelmet(
  headGroup: THREE.Group,
  steelMat: THREE.Material,
  goldMat: THREE.Material,
  crestMat: THREE.Material,
  hasCrest = true,
  transverseCenturionCrest = false
): void {
  // Polished steel helmet bowl
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.138, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
    steelMat
  );
  bowl.position.y = 0.02;
  bowl.castShadow = true;
  headGroup.add(bowl);

  // Sculpted Roman face inside helmet
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.095, 0.15, 20),
    steelMat
  );
  face.position.y = -0.01;
  headGroup.add(face);

  // Projecting Frontal Brow Deflector Peak (+Z)
  const browPeak = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.018, 12, 24, Math.PI * 0.95),
    goldMat
  );
  browPeak.rotation.x = Math.PI / 2 + 0.18;
  browPeak.rotation.z = -Math.PI * 0.475;
  browPeak.position.set(0, 0.04, 0.02);
  headGroup.add(browPeak);

  // Angled Rear Lobster-Tail Neck Guard (-Z)
  const neckGuard = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.2, 0.075, 24, 2, true, Math.PI * 0.6, Math.PI * 0.8),
    steelMat
  );
  neckGuard.position.set(0, -0.045, -0.025);
  neckGuard.rotation.x = -0.28;
  headGroup.add(neckGuard);

  // Brass rim trim on neck guard
  const neckTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.185, 0.01, 10, 20, Math.PI * 0.78),
    goldMat
  );
  neckTrim.rotation.x = Math.PI / 2 - 0.28;
  neckTrim.rotation.z = Math.PI * 0.61;
  neckTrim.position.set(0, -0.075, -0.03);
  headGroup.add(neckTrim);

  // Hinged Cheek Guards (Buccae) with brass rosette bosses
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.12, 0.095),
      steelMat
    );
    cheek.position.set(side * 0.118, -0.025, 0.045);
    cheek.rotation.y = side * 0.35;
    cheek.rotation.z = side * -0.12;
    headGroup.add(cheek);

    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 10), goldMat);
    boss.position.set(side * 0.126, -0.025, 0.055);
    headGroup.add(boss);
  }

  if (hasCrest) {
    const crestBox = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.08), goldMat);
    crestBox.position.set(0, 0.15, 0);
    headGroup.add(crestBox);

    const crestPlume = new THREE.Mesh(
      new THREE.TorusGeometry(0.165, 0.046, 16, 32, Math.PI * 1.05),
      crestMat
    );
    crestPlume.castShadow = true;
    if (transverseCenturionCrest) {
      crestPlume.rotation.z = -0.02;
      crestPlume.scale.set(1.12, 1.05, 0.38);
      crestPlume.position.set(0, 0.085, 0);
    } else {
      crestPlume.rotation.y = Math.PI / 2;
      crestPlume.rotation.z = 0.05;
      crestPlume.scale.set(1.0, 1.05, 0.38);
      crestPlume.position.set(0, 0.085, 0);
    }
    headGroup.add(crestPlume);
  }
}

/**
 * Builds a historically accurate curved rectangular Roman Scutum shield with
 * brass edge guttering, iron/gold Umbo boss, and Imperial eagle wings & lightning bolts.
 */
function addRomanScutumShield(
  shieldGroup: THREE.Group,
  tunicMat: THREE.Material,
  goldMat: THREE.Material,
  scale = 1.0
): void {
  const radius = 0.18 * scale;
  const height = 0.44 * scale;
  const arc = Math.PI * 0.68;

  const cylGeo = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    32,
    8,
    true,
    -arc / 2,
    arc
  );
  const scutumBody = new THREE.Mesh(cylGeo, tunicMat);
  scutumBody.position.z = -radius * 0.65;
  scutumBody.castShadow = true;
  scutumBody.receiveShadow = true;
  shieldGroup.add(scutumBody);

  // Top & bottom curved brass edge binding
  for (const ySign of [-1, 1]) {
    const rimArc = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.014 * scale, 12, 28, arc),
      goldMat
    );
    rimArc.rotation.x = Math.PI / 2;
    rimArc.rotation.z = Math.PI / 2 - arc / 2;
    rimArc.position.set(0, ySign * (height / 2), -radius * 0.65);
    shieldGroup.add(rimArc);
  }

  // Central Iron/Gold Umbo Boss + Horizontal Spindle Plate
  const bossPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.11 * scale, 0.11 * scale, 0.02 * scale),
    goldMat
  );
  bossPlate.position.set(0, 0, radius * 0.35);
  shieldGroup.add(bossPlate);

  const umbo = new THREE.Mesh(new THREE.SphereGeometry(0.048 * scale, 20, 16), goldMat);
  umbo.position.set(0, 0, radius * 0.38);
  shieldGroup.add(umbo);

  // Imperial Eagle Wings & Jupiter Fulmen (Lightning Bolts)
  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      const bolt = new THREE.Mesh(
        new THREE.ConeGeometry(0.015 * scale, 0.15 * scale, 6),
        goldMat
      );
      bolt.position.set(xSign * 0.068 * scale, ySign * 0.105 * scale, radius * 0.31);
      bolt.rotation.z = xSign * ySign * -0.52;
      shieldGroup.add(bolt);
    }
  }
}

function addRomanGladiusOrPilum(
  weaponGroup: THREE.Group,
  steelMat: THREE.Material,
  goldMat: THREE.Material,
  isPilum = false
): void {
  if (isPilum) {
    // Authentic Roman Pilum: wooden shaft + pyramidal weighted lead/brass socket + long iron shank
    const woodShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.019, 0.56, 12),
      goldMat
    );
    woodShaft.position.y = 0.12;
    weaponGroup.add(woodShaft);

    const socket = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 6), goldMat);
    socket.position.y = 0.42;
    weaponGroup.add(socket);

    const ironShank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.01, 0.42, 10),
      steelMat
    );
    ironShank.position.y = 0.65;
    weaponGroup.add(ironShank);

    const pyramidalTip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.11, 4), steelMat);
    pyramidalTip.position.y = 0.89;
    weaponGroup.add(pyramidalTip);
  } else {
    // Pompeii/Mainz pattern Roman Gladius sword
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 14), goldMat);
    pommel.position.y = -0.1;
    weaponGroup.add(pommel);

    const hilt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.12, 12),
      goldMat
    );
    hilt.position.y = -0.02;
    weaponGroup.add(hilt);

    const guard = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), goldMat);
    guard.scale.set(1.3, 0.45, 0.7);
    guard.position.y = 0.05;
    weaponGroup.add(guard);

    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.54, 4), steelMat);
    blade.scale.set(1.15, 1.0, 0.28);
    blade.position.y = 0.32;
    blade.castShadow = true;
    weaponGroup.add(blade);
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
  plumeMat: THREE.Material
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup } = actor;
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat);

  if (theme === 'spartan') {
    // SPARTAN HOPLITE: Anatomically sculpted Bronze Muscle Cuirass + Pteruges + Corinthian Helmet + Dented Aspis + Dory Spear
    addSpartanMuscleCuirass(bodyGroup, primaryMat, secondaryMat, 1.0);

    headGroup.position.set(0, 0.84, 0);
    addCorinthianHelmet(headGroup, primaryMat, secondaryMat, plumeMat, false, 1.0);

    shieldGroup.position.set(-0.22, 0.56, 0.19);
    shieldGroup.rotation.y = 0.25;
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.25);

    weaponGroup.position.set(0.22, 0.52, 0.1);
    weaponGroup.rotation.x = 0.36;
    addSpartanDorySpear(weaponGroup, secondaryMat, primaryMat, 1.08);
  } else if (theme === 'roman') {
    // ROMAN LEGIONARY: Polished Lorica Segmentata Steel + Crested Galea Helmet + Curved Scutum + Pilum & Gladius
    addLoricaSegmentataTorso(bodyGroup, primaryMat, plumeMat, trimMat, 1.0);

    headGroup.position.set(0, 0.83, 0);
    // Give Roman Legionaries iconic red/purple horsehair crests on their Galea helmets!
    addRomanGaleaHelmet(headGroup, primaryMat, trimMat, plumeMat, true, false);

    shieldGroup.position.set(-0.2, 0.53, 0.22);
    shieldGroup.rotation.y = 0.16;
    addRomanScutumShield(shieldGroup, plumeMat, trimMat, 0.96);

    weaponGroup.position.set(0.22, 0.52, 0.12);
    weaponGroup.rotation.x = 0.32;
    addRomanGladiusOrPilum(weaponGroup, primaryMat, trimMat, true);
  } else {
    // GOTHIC SENTINEL: Carved Alabaster/Obsidian Plate Armor + Heater Shield + Halberd
    const torsoGeo = createLatheProfile(
      [
        [0.24, 0.21],
        [0.22, 0.34],
        [0.18, 0.48],
        [0.21, 0.62],
        [0.16, 0.72],
        [0.0, 0.73],
      ],
      48
    );
    const torso = new THREE.Mesh(torsoGeo, primaryMat);
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    const breastplate = new THREE.Mesh(new THREE.SphereGeometry(0.18, 28, 20), secondaryMat);
    breastplate.scale.set(1.05, 1.15, 0.7);
    breastplate.position.set(0, 0.56, 0.06);
    bodyGroup.add(breastplate);

    headGroup.position.set(0, 0.83, 0);
    const helm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.135, 0.2, 28),
      primaryMat
    );
    helm.castShadow = true;
    headGroup.add(helm);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.125, 28, 20), secondaryMat);
    dome.position.y = 0.09;
    headGroup.add(dome);

    const visor = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 6), trimMat);
    visor.rotation.x = Math.PI / 2;
    visor.position.set(0, -0.01, 0.1);
    headGroup.add(visor);

    shieldGroup.position.set(-0.21, 0.55, 0.18);
    shieldGroup.rotation.y = 0.32;
    addGothicHeaterShield(shieldGroup, secondaryMat, trimMat, 0.95);

    weaponGroup.position.set(0.21, 0.52, 0.08);
    weaponGroup.rotation.x = 0.18;
    addGothicHalberd(weaponGroup, secondaryMat, trimMat, 0.88);
  }
}

function buildRook(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup } = actor;
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat);

  if (theme === 'spartan') {
    // SPARTAN PHALANX BASTION: Massive Bronze Doric Watchtower with 4 Locked Aspis Shields & Projecting Sarissa Spears
    const columnGeo = createLatheProfile(
      [
        [0.27, 0.21],
        [0.24, 0.35],
        [0.22, 0.78],
        [0.28, 0.88],
        [0.31, 0.96],
        [0.0, 0.96],
      ],
      48
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

    // Front battering Aspis shield in shieldGroup for massive shield-bash tackle
    shieldGroup.position.set(0, 0.62, 0.26);
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.22);

    headGroup.position.set(0, 1.05, 0);
    addCorinthianHelmet(headGroup, primaryMat, secondaryMat, plumeMat, true, 1.12);

    weaponGroup.position.set(0.24, 0.65, 0.16);
    weaponGroup.rotation.x = Math.PI * 0.36;
    addSpartanDorySpear(weaponGroup, secondaryMat, primaryMat, 0.95);
  } else if (theme === 'roman') {
    // ROMAN CASTRUM TRIUMPHAL PILLAR & TESTUDO RAM: Fluted Column + Testudo Scutum Wall + Golden Aquila
    const columnGeo = createLatheProfile(
      [
        [0.26, 0.21],
        [0.22, 0.36],
        [0.2, 0.82],
        [0.27, 0.92],
        [0.29, 1.0],
        [0.0, 1.0],
      ],
      48
    );
    const column = new THREE.Mesh(columnGeo, secondaryMat);
    column.castShadow = true;
    column.receiveShadow = true;
    bodyGroup.add(column);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pilaster = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.56, 0.035),
        trimMat
      );
      pilaster.position.set(Math.sin(a) * 0.21, 0.6, Math.cos(a) * 0.21);
      pilaster.rotation.y = a;
      bodyGroup.add(pilaster);
    }

    headGroup.position.set(0, 1.02, 0);
    const eaglePedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.1, 20),
      trimMat
    );
    headGroup.add(eaglePedestal);

    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.025), trimMat);
      wing.position.set(s * 0.12, 0.14, 0);
      wing.rotation.z = s * 0.35;
      headGroup.add(wing);
    }

    shieldGroup.position.set(0, 0.56, 0.24);
    addRomanScutumShield(shieldGroup, plumeMat, trimMat, 0.88);

    weaponGroup.position.set(0.22, 0.6, 0.15);
    weaponGroup.rotation.x = 0.4;
    addRomanGladiusOrPilum(weaponGroup, primaryMat, trimMat, false);
  } else {
    // GOTHIC CATHEDRAL CITADEL TOWER with Crenellations & Gargoyles
    const towerGeo = createLatheProfile(
      [
        [0.27, 0.21],
        [0.25, 0.38],
        [0.21, 0.72],
        [0.23, 0.86],
        [0.29, 0.95],
        [0.29, 1.08],
        [0.22, 1.08],
        [0.22, 0.98],
        [0.0, 0.98],
      ],
      48
    );
    const tower = new THREE.Mesh(towerGeo, primaryMat);
    tower.castShadow = true;
    tower.receiveShadow = true;
    bodyGroup.add(tower);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const buttress = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.72, 0.11),
        secondaryMat
      );
      buttress.position.set(Math.sin(a) * 0.21, 0.57, Math.cos(a) * 0.21);
      buttress.rotation.y = a;
      bodyGroup.add(buttress);
    }

    headGroup.position.set(0, 1.08, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const merlon = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.12, 0.065),
        primaryMat
      );
      merlon.position.set(Math.sin(a) * 0.25, 0.05, Math.cos(a) * 0.25);
      merlon.rotation.y = a;
      headGroup.add(merlon);
    }

    shieldGroup.position.set(0, 0.58, 0.25);
    addGothicHeaterShield(shieldGroup, trimMat, secondaryMat, 0.92);
  }
}

function buildKnight(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup } = actor;
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat);

  // Sculpted rearing warhorse chest & muscular neck
  const neckSegments = 20;
  for (let i = 0; i < neckSegments; i++) {
    const t = i / (neckSegments - 1);
    const y = 0.26 + t * 0.66;
    const z = -0.05 + Math.sin(t * Math.PI * 0.85) * 0.15;
    const radius = 0.22 * (1 - t * 0.4) + 0.03 * Math.sin(t * Math.PI * 2);

    const seg = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), primaryMat);
    seg.scale.set(0.86, 0.92, 1.18);
    seg.position.set(0, y, z);
    seg.castShadow = true;
    seg.receiveShadow = true;
    bodyGroup.add(seg);
  }

  // Rearing Forelegs & Hooves (+Z front, poised to trample!)
  for (const side of [-1, 1]) {
    const foreleg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.024, 0.28, 14),
      primaryMat
    );
    foreleg.position.set(side * 0.12, 0.56, 0.2);
    foreleg.rotation.x = -0.65;
    foreleg.castShadow = true;
    bodyGroup.add(foreleg);

    const hoof = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.038, 0.06, 14),
      trimMat
    );
    hoof.position.set(side * 0.12, 0.46, 0.29);
    hoof.rotation.x = 0.25;
    bodyGroup.add(hoof);
  }

  if (theme === 'spartan') {
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.02, 12, 24),
        trimMat
      );
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(s * 0.25, 0.34, -0.04);
      bodyGroup.add(wheel);
    }

    for (let m = 0; m < 10; m++) {
      const mt = m / 9;
      const plume = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.14), plumeMat);
      plume.position.set(0, 0.36 + mt * 0.62, -0.14 + Math.sin(mt * Math.PI * 0.8) * 0.1);
      plume.rotation.x = 0.45;
      bodyGroup.add(plume);
    }
  } else if (theme === 'roman') {
    const peytral = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 0.24, 24, 2, true, -Math.PI * 0.45, Math.PI * 0.9),
      trimMat
    );
    peytral.position.set(0, 0.46, 0.04);
    bodyGroup.add(peytral);

    for (let m = 0; m < 8; m++) {
      const mt = m / 7;
      const lock = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), trimMat);
      lock.scale.set(0.55, 1.0, 1.5);
      lock.position.set(0, 0.36 + mt * 0.54, -0.12 + Math.sin(mt * Math.PI * 0.8) * 0.1);
      bodyGroup.add(lock);
    }
  } else {
    for (let m = 0; m < 9; m++) {
      const mt = m / 8;
      const lock = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 8), trimMat);
      lock.rotation.x = -Math.PI * 0.62;
      lock.position.set(0, 0.35 + mt * 0.56, -0.12 + Math.sin(mt * Math.PI * 0.8) * 0.1);
      bodyGroup.add(lock);
    }
  }

  headGroup.position.set(0, 0.96, 0.08);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.145, 24, 20), primaryMat);
  skull.scale.set(0.84, 0.95, 1.18);
  headGroup.add(skull);

  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.115, 0.28, 20),
    primaryMat
  );
  muzzle.rotation.x = Math.PI * 0.38;
  muzzle.position.set(0, -0.05, 0.16);
  headGroup.add(muzzle);

  const chanfron = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.032, 0.3),
     theme === 'spartan' ? primaryMat : trimMat
  );
  chanfron.rotation.x = 0.42;
  chanfron.position.set(0, 0.02, 0.14);
  headGroup.add(chanfron);

  if (theme === 'spartan' || theme === 'roman') {
    const horsePlume = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.038, 12, 24, Math.PI * 0.95),
      plumeMat
    );
    horsePlume.rotation.y = Math.PI / 2;
    horsePlume.position.set(0, 0.12, -0.02);
    headGroup.add(horsePlume);
  }

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.13, 8), secondaryMat);
    ear.position.set(s * 0.075, 0.14, -0.03);
    ear.rotation.x = -0.2;
    headGroup.add(ear);
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
  const lance = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.82, 14), trimMat);
  lance.position.y = 0.25;
  weaponGroup.add(lance);
}

function buildBishop(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup } = actor;
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat);

  if (theme === 'spartan') {
    addSpartanMuscleCuirass(bodyGroup, primaryMat, secondaryMat, 1.05);

    const cloak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.26, 0.62, 24, 4, true, Math.PI * 0.55, Math.PI * 0.9),
      plumeMat
    );
    cloak.position.y = 0.52;
    bodyGroup.add(cloak);

    headGroup.position.set(0, 0.92, 0);
    addCorinthianHelmet(headGroup, primaryMat, secondaryMat, plumeMat, true, 1.04);

    shieldGroup.position.set(-0.22, 0.58, 0.16);
    shieldGroup.rotation.y = 0.3;
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.22);

    weaponGroup.position.set(0.22, 0.56, 0.12);
    addSpartanDorySpear(weaponGroup, secondaryMat, trimMat, 1.15);
  } else if (theme === 'roman') {
    const togaGeo = createLatheProfile(
      [
        [0.25, 0.21],
        [0.22, 0.42],
        [0.18, 0.68],
        [0.2, 0.82],
        [0.14, 0.92],
        [0.0, 0.92],
      ],
      48
    );
    const toga = new THREE.Mesh(togaGeo, secondaryMat);
    toga.castShadow = true;
    toga.receiveShadow = true;
    bodyGroup.add(toga);

    const sash = new THREE.Mesh(
      new THREE.TorusGeometry(0.195, 0.038, 14, 32),
      plumeMat
    );
    sash.rotation.x = Math.PI / 3;
    sash.rotation.y = 0.4;
    sash.position.y = 0.62;
    bodyGroup.add(sash);

    headGroup.position.set(0, 0.98, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 24, 20), secondaryMat);
    headGroup.add(head);

    const veil = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.65),
      plumeMat
    );
    veil.rotation.x = -0.35;
    veil.position.y = 0.02;
    headGroup.add(veil);

    const wreath = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.018, 12, 28),
      trimMat
    );
    wreath.rotation.x = Math.PI / 2 - 0.15;
    wreath.position.y = 0.04;
    headGroup.add(wreath);

    weaponGroup.position.set(0.22, 0.54, 0.12);
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.018, 1.05, 16),
      trimMat
    );
    staff.position.y = 0.35;
    weaponGroup.add(staff);

    const eagle = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 1), trimMat);
    eagle.scale.set(1.5, 0.9, 0.5);
    eagle.position.y = 0.92;
    weaponGroup.add(eagle);
  } else {
    const robeGeo = createLatheProfile(
      [
        [0.25, 0.21],
        [0.23, 0.38],
        [0.16, 0.66],
        [0.19, 0.82],
        [0.14, 0.92],
        [0.0, 0.92],
      ],
      48
    );
    const robe = new THREE.Mesh(robeGeo, primaryMat);
    robe.castShadow = true;
    robe.receiveShadow = true;
    bodyGroup.add(robe);

    const stole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.58, 0.025), trimMat);
    stole.position.set(0, 0.56, 0.18);
    bodyGroup.add(stole);

    headGroup.position.set(0, 0.94, 0);
    const mitreGeo = createLatheProfile(
      [
        [0.0, 0.0],
        [0.14, 0.0],
        [0.165, 0.12],
        [0.12, 0.26],
        [0.035, 0.36],
        [0.0, 0.38],
      ],
      36
    );
    const mitre = new THREE.Mesh(mitreGeo, secondaryMat);
    mitre.castShadow = true;
    headGroup.add(mitre);

    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.022), trimMat);
    crossV.position.y = 0.42;
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 0.022), trimMat);
    crossH.position.y = 0.43;
    headGroup.add(crossV, crossH);

    weaponGroup.position.set(0.22, 0.52, 0.12);
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.018, 0.98, 16),
      trimMat
    );
    staff.position.y = 0.32;
    weaponGroup.add(staff);

    const spiral = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.015, 14, 32, Math.PI * 1.65),
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
  plumeMat: THREE.Material
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup } = actor;
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat);

  const gownGeo = createLatheProfile(
    [
      [0.27, 0.21],
      [0.23, 0.45],
      [0.15, 0.72],
      [0.19, 0.9],
      [0.14, 1.05],
      [0.0, 1.05],
    ],
    48
  );
  const gown = new THREE.Mesh(gownGeo, theme === 'roman' ? secondaryMat : primaryMat);
  gown.castShadow = true;
  gown.receiveShadow = true;
  bodyGroup.add(gown);

  const mantle = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.038, 16, 36),
    theme === 'gothic' ? trimMat : plumeMat
  );
  mantle.rotation.x = Math.PI / 2 + 0.18;
  mantle.position.set(0, 0.96, -0.02);
  bodyGroup.add(mantle);

  headGroup.position.set(0, 1.12, 0);
  if (theme === 'spartan') {
    addCorinthianHelmet(headGroup, primaryMat, secondaryMat, plumeMat, true, 1.05);
    shieldGroup.position.set(-0.22, 0.68, 0.15);
    shieldGroup.rotation.y = 0.35;
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.21);

    weaponGroup.position.set(0.22, 0.68, 0.12);
    addSpartanDorySpear(weaponGroup, secondaryMat, trimMat, 1.12);
  } else {
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 28, 22),
      theme === 'roman' ? secondaryMat : primaryMat
    );
    headGroup.add(head);

    const crownCirclet = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.02, 16, 36),
      trimMat
    );
    crownCirclet.rotation.x = Math.PI / 2;
    crownCirclet.position.y = 0.08;
    headGroup.add(crownCirclet);

    const spireCount = 8;
    for (let i = 0; i < spireCount; i++) {
      const a = (i * Math.PI * 2) / spireCount;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.13, 10), trimMat);
      spire.position.set(Math.sin(a) * 0.13, 0.15, Math.cos(a) * 0.13);
      spire.rotation.z = -Math.sin(a) * 0.22;
      spire.rotation.x = Math.cos(a) * 0.22;
      headGroup.add(spire);
    }

    weaponGroup.position.set(0.22, 0.68, 0.14);
    const scepter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.016, 0.88, 16),
      trimMat
    );
    scepter.position.y = 0.24;
    weaponGroup.add(scepter);

    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 1), trimMat);
    finial.position.y = 0.72;
    weaponGroup.add(finial);
  }
}

function buildKing(
  actor: PieceActor,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material
): void {
  const { bodyGroup, headGroup, weaponGroup, shieldGroup } = actor;
  addPedestalBase(bodyGroup, primaryMat, secondaryMat, trimMat);

  if (theme === 'spartan') {
    addSpartanMuscleCuirass(bodyGroup, primaryMat, secondaryMat, 1.16);

    const cape = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.29, 0.76, 28, 4, true, Math.PI * 0.55, Math.PI * 0.9),
      plumeMat
    );
    cape.position.y = 0.58;
    bodyGroup.add(cape);

    headGroup.position.set(0, 1.05, 0);
    addCorinthianHelmet(headGroup, primaryMat, secondaryMat, plumeMat, true, 1.15);

    shieldGroup.position.set(-0.25, 0.66, 0.18);
    shieldGroup.rotation.y = 0.28;
    addSpartanAspisShield(shieldGroup, primaryMat, trimMat, 0.26);

    weaponGroup.position.set(0.25, 0.64, 0.14);
    weaponGroup.rotation.x = 0.25;
    addSpartanDorySpear(weaponGroup, secondaryMat, trimMat, 1.25);
  } else if (theme === 'roman') {
    addLoricaSegmentataTorso(bodyGroup, primaryMat, plumeMat, trimMat, 1.14);

    const cloak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.28, 0.74, 28, 4, true, Math.PI * 0.5, Math.PI),
      plumeMat
    );
    cloak.position.y = 0.56;
    bodyGroup.add(cloak);

    headGroup.position.set(0, 1.04, 0);
    const empHead = new THREE.Mesh(new THREE.SphereGeometry(0.135, 28, 22), secondaryMat);
    headGroup.add(empHead);

    // Sculpted Golden Laurel Wreath (Corona Triumphalis)
    const wreathBase = new THREE.Mesh(
      new THREE.TorusGeometry(0.142, 0.018, 14, 32, Math.PI * 1.75),
      trimMat
    );
    wreathBase.rotation.x = Math.PI / 2 - 0.15;
    wreathBase.rotation.z = -Math.PI * 0.375;
    wreathBase.position.y = 0.05;
    headGroup.add(wreathBase);

    for (let l = 0; l < 12; l++) {
      const a = -Math.PI * 0.8 + (l / 11) * Math.PI * 1.6;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.065, 6), trimMat);
      leaf.position.set(Math.sin(a) * 0.148, 0.06, Math.cos(a) * 0.148);
      leaf.rotation.z = -Math.cos(a) * 0.6;
      leaf.rotation.x = Math.sin(a) * 0.6;
      headGroup.add(leaf);
    }

    shieldGroup.position.set(-0.24, 0.62, 0.18);
    shieldGroup.rotation.y = 0.25;
    addRomanScutumShield(shieldGroup, plumeMat, trimMat, 0.96);

    weaponGroup.position.set(0.24, 0.62, 0.16);
    addRomanGladiusOrPilum(weaponGroup, primaryMat, trimMat, false);
  } else {
    const torsoGeo = createLatheProfile(
      [
        [0.28, 0.21],
        [0.25, 0.48],
        [0.19, 0.78],
        [0.24, 0.98],
        [0.18, 1.12],
        [0.0, 1.12],
      ],
      48
    );
    const torso = new THREE.Mesh(torsoGeo, primaryMat);
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    for (const s of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), secondaryMat);
      pauldron.position.set(s * 0.22, 0.98, 0.02);
      bodyGroup.add(pauldron);
    }

    headGroup.position.set(0, 1.16, 0);
    const helm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.145, 0.22, 28),
      secondaryMat
    );
    headGroup.add(helm);

    const crownBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.024, 16, 36),
      trimMat
    );
    crownBand.rotation.x = Math.PI / 2;
    crownBand.position.y = 0.09;
    headGroup.add(crownBand);

    const vCross = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), trimMat);
    vCross.position.y = 0.28;
    const hCross = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.04), trimMat);
    hCross.position.y = 0.3;
    headGroup.add(vCross, hCross);

    weaponGroup.position.set(0, 0.62, 0.23);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.66, 0.018), trimMat);
    blade.position.y = -0.05;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.036, 0.036), trimMat);
    guard.position.y = 0.25;
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.15, 14),
      secondaryMat
    );
    grip.position.y = 0.34;
    weaponGroup.add(blade, guard, grip);
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

/**
 * Populates a PieceActor's geometry groups for the specified FactionTheme.
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
  const { primaryMat, secondaryMat, trimMat, plumeMat } = resolveFactionMaterials(
    theme,
    actor.color,
    materials
  );

  switch (actor.type) {
    case 'p':
      buildPawn(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat);
      break;
    case 'r':
      buildRook(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat);
      break;
    case 'n':
      buildKnight(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat);
      break;
    case 'b':
      buildBishop(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat);
      break;
    case 'q':
      buildQueen(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat);
      break;
    case 'k':
      buildKing(actor, theme, primaryMat, secondaryMat, trimMat, plumeMat);
      break;
  }
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
