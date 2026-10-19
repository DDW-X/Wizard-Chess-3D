import * as THREE from 'three';
import type { FactionTheme } from '../game/physicsKinematics';
import type { SanctumMaterialLibrary } from './materials';
import { prepareGeometryForPBR } from './assetLoader';

const IS_HEADLESS =
  typeof navigator !== 'undefined' &&
  /HeadlessChrome|Playwright/i.test(navigator.userAgent);

// ============================================================================
// CACHED SHARED GEOMETRIES (Zero Duplicate Allocations Across 32 Pieces)
// ============================================================================

const GEO_CACHE = new Map<string, THREE.BufferGeometry>();

function getCachedGeo<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
  let geo = GEO_CACHE.get(key) as T | undefined;
  if (!geo) {
    geo = factory();
    prepareGeometryForPBR(geo);
    GEO_CACHE.set(key, geo);
  }
  return geo;
}

/**
 * Builds a sculpted human face with distinct facial features:
 * - Cranial & jaw contour
 * - Brow ridge & cheekbones
 * - Deep-set eyes (white sclera + dark/glowing iris pupils)
 * - Sculpted nose bridge
 * - Stern warrior mouth / expression (and optional royal beard)
 */
export function addSculptedHumanFace(
  headGroup: THREE.Group,
  skinMat: THREE.Material,
  scleraMat: THREE.Material,
  irisMat: THREE.Material,
  hairOrBeardMat: THREE.Material,
  options: {
    scale?: number;
    hasBeard?: boolean;
    sternExpression?: boolean;
    glowingEyes?: boolean;
  } = {}
): void {
  const s = options.scale ?? 1.0;

  // 1. Sculpted Head / Visage Core
  const headGeo = getCachedGeo('human_head_core', () => {
    const g = new THREE.SphereGeometry(0.105, 24, 20);
    g.scale(0.88, 1.08, 0.95);
    return g;
  });
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // 2. Sculpted Jawline & Chin (+Z forward)
  const jawGeo = getCachedGeo('human_jaw', () =>
    new THREE.CylinderGeometry(0.078, 0.056, 0.095, 16)
  );
  const jawMesh = new THREE.Mesh(jawGeo, skinMat);
  jawMesh.position.set(0, -0.042 * s, 0.022 * s);
  jawMesh.scale.setScalar(s);
  headGroup.add(jawMesh);

  // 3. Prominent Brow Ridge (Creates dramatic shadow over the eyes)
  const browGeo = getCachedGeo('human_brow', () =>
    new THREE.BoxGeometry(0.115, 0.022, 0.045)
  );
  const browMesh = new THREE.Mesh(browGeo, skinMat);
  browMesh.position.set(0, 0.032 * s, 0.082 * s);
  browMesh.rotation.x = 0.12;
  browMesh.scale.setScalar(s);
  headGroup.add(browMesh);

  // 4. Sculpted Nose Bridge (+Z center)
  const noseGeo = getCachedGeo('human_nose', () =>
    new THREE.ConeGeometry(0.019, 0.058, 6)
  );
  const noseMesh = new THREE.Mesh(noseGeo, skinMat);
  noseMesh.position.set(0, 0.002 * s, 0.102 * s);
  noseMesh.rotation.x = Math.PI * 0.38;
  noseMesh.scale.setScalar(s);
  headGroup.add(noseMesh);

  // 5. Distinct Left & Right Eyes (Sclera + Iris/Pupil)
  const scleraGeo = getCachedGeo('human_eye_sclera', () =>
    new THREE.SphereGeometry(0.017, 12, 10)
  );
  const irisGeo = getCachedGeo('human_eye_iris', () =>
    new THREE.SphereGeometry(0.01, 10, 8)
  );

  for (const side of [-1, 1]) {
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);
    sclera.scale.set(1.25 * s, 0.82 * s, 0.7 * s);
    sclera.position.set(side * 0.034 * s, 0.015 * s, 0.091 * s);
    headGroup.add(sclera);

    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.scale.set(1.0 * s, 1.0 * s, 0.65 * s);
    iris.position.set(side * 0.034 * s, 0.015 * s, 0.099 * s);
    headGroup.add(iris);

    // Cheekbone relief
    const cheekGeo = getCachedGeo('human_cheekbone', () =>
      new THREE.SphereGeometry(0.028, 10, 8)
    );
    const cheek = new THREE.Mesh(cheekGeo, skinMat);
    cheek.scale.set(1.1 * s, 0.75 * s, 0.65 * s);
    cheek.position.set(side * 0.048 * s, -0.012 * s, 0.078 * s);
    headGroup.add(cheek);
  }

  // 6. Stern Warrior Mouth / Expression Line
  const mouthGeo = getCachedGeo('human_mouth', () =>
    new THREE.BoxGeometry(0.048, 0.01, 0.018)
  );
  const mouth = new THREE.Mesh(mouthGeo, hairOrBeardMat);
  mouth.position.set(0, -0.036 * s, 0.094 * s);
  mouth.scale.setScalar(s);
  headGroup.add(mouth);

  // 7. Optional Sculpted Royal/Prelate Beard
  if (options.hasBeard) {
    const beardGeo = getCachedGeo('human_beard', () =>
      new THREE.ConeGeometry(0.068, 0.13, 12)
    );
    const beard = new THREE.Mesh(beardGeo, hairOrBeardMat);
    beard.rotation.x = Math.PI + 0.18;
    beard.position.set(0, -0.085 * s, 0.052 * s);
    beard.scale.set(1.05 * s, 1.0 * s, 0.78 * s);
    headGroup.add(beard);
  }
}

/**
 * Builds Default / Crusader (Gothic) Faction Chainmail Hauberk, Draped Woven Surcoat
 * with 3D Cloth Folds, and Raised Heraldic Cross Emblem.
 */
export function addCrusaderChainmailAndSurcoat(
  bodyGroup: THREE.Group,
  chainmailMat: THREE.Material,
  surcoatClothMat: THREE.Material,
  plateArmorMat: THREE.Material,
  heraldicTrimMat: THREE.Material,
  scale = 1.0
): void {
  // 1. Lower Chainmail Hauberk Skirt (visible beneath surcoat hem)
  const mailSkirtGeo = getCachedGeo('crusader_mail_skirt', () =>
    new THREE.CylinderGeometry(0.185, 0.235, 0.24, 28)
  );
  const mailSkirt = new THREE.Mesh(mailSkirtGeo, chainmailMat);
  mailSkirt.position.y = 0.31 * scale;
  mailSkirt.scale.setScalar(scale);
  mailSkirt.castShadow = true;
  mailSkirt.receiveShadow = true;
  bodyGroup.add(mailSkirt);

  // 2. Upper Chainmail Chest & Shoulders
  const mailTorsoGeo = getCachedGeo('crusader_mail_torso', () =>
    new THREE.CylinderGeometry(0.195, 0.175, 0.34, 28)
  );
  const mailTorso = new THREE.Mesh(mailTorsoGeo, chainmailMat);
  mailTorso.position.y = 0.56 * scale;
  mailTorso.scale.setScalar(scale);
  mailTorso.castShadow = true;
  bodyGroup.add(mailTorso);

  // 3. Draped Woven Surcoat / Tabard with Realistic 3D Cloth Folds
  const surcoatGeo = getCachedGeo('crusader_surcoat_base', () =>
    new THREE.CylinderGeometry(0.185, 0.225, 0.46, 32)
  );
  const surcoat = new THREE.Mesh(surcoatGeo, surcoatClothMat);
  surcoat.position.y = 0.48 * scale;
  surcoat.scale.set(0.96 * scale, scale, 1.04 * scale);
  surcoat.castShadow = true;
  surcoat.receiveShadow = true;
  bodyGroup.add(surcoat);

  // Sculpted 3D Vertical Cloth Fold Pleats around the surcoat skirt
  const pleatGeo = getCachedGeo('crusader_cloth_pleat', () =>
    new THREE.CylinderGeometry(0.022, 0.034, 0.36, 10)
  );
  const pleatAngles = [-0.85, -0.45, 0.45, 0.85, Math.PI - 0.5, Math.PI, Math.PI + 0.5];
  for (const ang of pleatAngles) {
    const pleat = new THREE.Mesh(pleatGeo, surcoatClothMat);
    pleat.position.set(
      Math.sin(ang) * 0.205 * scale,
      0.39 * scale,
      Math.cos(ang) * 0.205 * scale
    );
    pleat.rotation.z = -Math.sin(ang) * 0.08;
    pleat.rotation.x = Math.cos(ang) * 0.08;
    pleat.scale.setScalar(scale);
    pleat.castShadow = true;
    bodyGroup.add(pleat);
  }

  // 4. Heraldic Crusader Cross Emblem on the Front Surcoat Chest (+Z)
  const crossVGeo = getCachedGeo('heraldic_cross_v', () =>
    new THREE.BoxGeometry(0.036, 0.22, 0.016)
  );
  const crossHGeo = getCachedGeo('heraldic_cross_h', () =>
    new THREE.BoxGeometry(0.14, 0.036, 0.016)
  );
  const crossV = new THREE.Mesh(crossVGeo, heraldicTrimMat);
  crossV.position.set(0, 0.55 * scale, 0.212 * scale);
  crossV.scale.setScalar(scale);
  const crossH = new THREE.Mesh(crossHGeo, heraldicTrimMat);
  crossH.position.set(0, 0.58 * scale, 0.212 * scale);
  crossH.scale.setScalar(scale);
  bodyGroup.add(crossV, crossH);

  // 5. Knightly Leather & Gold Sword Belt + Fluted Gothic Pauldrons
  const beltGeo = getCachedGeo('crusader_belt', () =>
    new THREE.TorusGeometry(0.195, 0.018, 12, 32)
  );
  const belt = new THREE.Mesh(beltGeo, heraldicTrimMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.44 * scale;
  belt.scale.setScalar(scale);
  bodyGroup.add(belt);

  const pauldronGeo = getCachedGeo('crusader_pauldron', () =>
    new THREE.SphereGeometry(0.088, 18, 14)
  );
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(pauldronGeo, plateArmorMat);
    pauldron.scale.set(1.15 * scale, 0.85 * scale, 1.15 * scale);
    pauldron.position.set(side * 0.195 * scale, 0.67 * scale, 0.01 * scale);
    pauldron.castShadow = true;
    bodyGroup.add(pauldron);
  }
}

/**
 * Builds an Open-Faced Crusader Helmet + Chainmail Coif that frames the warrior's
 * sculpted human face and eyes so facial features are 100% visible!
 */
export function addCrusaderOpenHelmetWithFace(
  headGroup: THREE.Group,
  plateMat: THREE.Material,
  chainmailMat: THREE.Material,
  trimMat: THREE.Material,
  mats: SanctumMaterialLibrary,
  isWhite: boolean,
  hasCrown = false,
  hasBeard = false,
  scale = 1.0
): void {
  const skinMat = isWhite ? mats.sculptedSkinLight : mats.sculptedSkinDark;
  const beardMat = isWhite ? mats.marbleCarvedMatte : mats.obsidianEtchedMatte;

  // 1. Chainmail Coif (Frames neck, chin, and sides of head)
  const coifNeckGeo = getCachedGeo('crusader_coif_neck', () =>
    new THREE.CylinderGeometry(0.115, 0.145, 0.14, 24)
  );
  const coifNeck = new THREE.Mesh(coifNeckGeo, chainmailMat);
  coifNeck.position.y = -0.055 * scale;
  coifNeck.scale.setScalar(scale);
  headGroup.add(coifNeck);

  // 2. Sculpted Human Face with Eyes, Nose, Brow & Expression
  addSculptedHumanFace(headGroup, skinMat, mats.eyeScleraMat, mats.eyeIrisMat, beardMat, {
    scale,
    hasBeard,
  });

  // 3. Open-Faced Crusader Sallet / Bascinet Steel Dome (Leaves face & eyes uncovered in +Z)
  const domeGeo = getCachedGeo('crusader_open_dome', () =>
    new THREE.SphereGeometry(0.128, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.56)
  );
  const dome = new THREE.Mesh(domeGeo, plateMat);
  dome.position.set(0, 0.025 * scale, -0.008 * scale);
  dome.rotation.x = -0.22; // Tilted slightly back to reveal brow & eyes clearly
  dome.scale.setScalar(scale);
  dome.castShadow = true;
  headGroup.add(dome);

  // Side cheek-plates framing the face without covering the eyes/nose/mouth
  const cheekPlateGeo = getCachedGeo('crusader_cheek_guard', () =>
    new THREE.BoxGeometry(0.022, 0.11, 0.085)
  );
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(cheekPlateGeo, plateMat);
    cheek.position.set(side * 0.112 * scale, -0.015 * scale, 0.02 * scale);
    cheek.rotation.y = side * 0.28;
    cheek.scale.setScalar(scale);
    headGroup.add(cheek);
  }

  // Raised Golden Visor / Brow Coronet
  const visorArcGeo = getCachedGeo('crusader_visor_arc', () =>
    new THREE.TorusGeometry(0.132, 0.016, 10, 24, Math.PI * 0.92)
  );
  const visorArc = new THREE.Mesh(visorArcGeo, trimMat);
  visorArc.rotation.x = Math.PI / 2 - 0.35;
  visorArc.rotation.z = -Math.PI * 0.46;
  visorArc.position.set(0, 0.055 * scale, 0.015 * scale);
  visorArc.scale.setScalar(scale);
  headGroup.add(visorArc);

  if (hasCrown) {
    const crownBandGeo = getCachedGeo('crusader_crown_band', () =>
      new THREE.TorusGeometry(0.136, 0.02, 12, 28)
    );
    const crownBand = new THREE.Mesh(crownBandGeo, trimMat);
    crownBand.rotation.x = Math.PI / 2;
    crownBand.position.y = 0.095 * scale;
    crownBand.scale.setScalar(scale);
    headGroup.add(crownBand);

    const spireGeo = getCachedGeo('crusader_crown_spire', () =>
      new THREE.ConeGeometry(0.022, 0.11, 8)
    );
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spire = new THREE.Mesh(spireGeo, trimMat);
      spire.position.set(
        Math.sin(a) * 0.132 * scale,
        0.155 * scale,
        Math.cos(a) * 0.132 * scale
      );
      spire.scale.setScalar(scale);
      headGroup.add(spire);
    }
  }
}

/**
 * Builds a Hyper-Detailed Spartan Corinthian Helmet with VISIBLE EYES underneath!
 * Includes sculpted brow, glowing/intense warrior eyes peering through the Corinthian
 * almond eye cutouts, swept cheek-guards, central nasal bar, and horsehair crest.
 */
export function addSpartanCorinthianHelmetWithEyes(
  headGroup: THREE.Group,
  bronzeMat: THREE.Material,
  darkRecessMat: THREE.Material,
  plumeMat: THREE.Material,
  mats: SanctumMaterialLibrary,
  transverseCrest = false,
  scale = 1.0
): void {
  // 1. Inner Shadowed Visage + Intense Visible Eyes Underneath the Corinthian Brow!
  const innerHeadGeo = getCachedGeo('spartan_inner_visage', () =>
    new THREE.CylinderGeometry(0.112, 0.108, 0.19, 20)
  );
  const innerHead = new THREE.Mesh(innerHeadGeo, darkRecessMat);
  innerHead.position.set(0, -0.005 * scale, 0.015 * scale);
  innerHead.scale.setScalar(scale);
  headGroup.add(innerHead);

  // Visible Spartan Eyes (Sclera + Iris) positioned precisely inside the almond eye-slits (+Z)
  const eyeScleraGeo = getCachedGeo('spartan_eye_sclera', () =>
    new THREE.SphereGeometry(0.021, 12, 10)
  );
  const eyePupilGeo = getCachedGeo('spartan_eye_pupil', () =>
    new THREE.SphereGeometry(0.011, 10, 8)
  );

  for (const side of [-1, 1]) {
    const eyeSclera = new THREE.Mesh(eyeScleraGeo, mats.eyeGlowingSpartanMat);
    eyeSclera.scale.set(1.35 * scale, 0.68 * scale, 0.65 * scale);
    eyeSclera.position.set(side * 0.042 * scale, 0.018 * scale, 0.122 * scale);
    eyeSclera.rotation.y = side * 0.22;
    headGroup.add(eyeSclera);

    const eyePupil = new THREE.Mesh(eyePupilGeo, mats.eyeIrisMat);
    eyePupil.scale.set(0.95 * scale, 0.95 * scale, 0.6 * scale);
    eyePupil.position.set(side * 0.042 * scale, 0.018 * scale, 0.132 * scale);
    headGroup.add(eyePupil);
  }

  // 2. High-Segment Scarred Bronze Cranial Dome (Leaves eye zone open)
  const domeGeo = getCachedGeo('spartan_corinthian_dome', () =>
    new THREE.SphereGeometry(0.145, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.52)
  );
  const dome = new THREE.Mesh(domeGeo, bronzeMat);
  dome.scale.set(0.96 * scale, 1.12 * scale, 1.08 * scale);
  dome.position.y = 0.032 * scale;
  dome.castShadow = true;
  headGroup.add(dome);

  // 3. Rear & Side Helmet Wall + Flared Neck Guard
  const rearHelmGeo = getCachedGeo('spartan_corinthian_rear', () =>
    new THREE.CylinderGeometry(0.136, 0.162, 0.16, 24, 2, true, Math.PI * 0.35, Math.PI * 1.3)
  );
  const rearHelm = new THREE.Mesh(rearHelmGeo, bronzeMat);
  rearHelm.position.set(0, -0.025 * scale, -0.005 * scale);
  rearHelm.scale.setScalar(scale);
  rearHelm.castShadow = true;
  headGroup.add(rearHelm);

  // 4. Prominent Embossed Corinthian Brow Ridge above the visible eyes
  const browGeo = getCachedGeo('spartan_corinthian_brow', () =>
    new THREE.TorusGeometry(0.14, 0.018, 12, 28, Math.PI * 0.92)
  );
  const brow = new THREE.Mesh(browGeo, bronzeMat);
  brow.rotation.x = Math.PI / 2 - 0.1;
  brow.rotation.z = -Math.PI * 0.46;
  brow.position.set(0, 0.042 * scale, 0.018 * scale);
  brow.scale.setScalar(scale);
  headGroup.add(brow);

  // 5. Central Corinthian Nasal Guard Bar (+Z front between the eyes)
  const nasalGeo = getCachedGeo('spartan_corinthian_nasal', () =>
    new THREE.BoxGeometry(0.024, 0.115, 0.032)
  );
  const nasal = new THREE.Mesh(nasalGeo, bronzeMat);
  nasal.position.set(0, -0.005 * scale, 0.146 * scale);
  nasal.rotation.x = -0.06;
  nasal.scale.setScalar(scale);
  headGroup.add(nasal);

  // 6. Swept Left & Right Corinthian Cheek Plates framing the T-slit and leaving eye cutouts open
  const cheekGeo = getCachedGeo('spartan_corinthian_cheek', () => {
    const cheekShape = new THREE.Shape();
    cheekShape.moveTo(0, 0.0);
    cheekShape.lineTo(0.095, -0.005);
    cheekShape.lineTo(0.082, -0.115);
    cheekShape.lineTo(0.014, -0.098);
    cheekShape.closePath();
    return new THREE.ExtrudeGeometry(cheekShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelSize: 0.005,
      bevelThickness: 0.005,
      bevelSegments: 2,
    });
  });

  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(cheekGeo, bronzeMat);
    cheek.scale.set(side * scale, scale, scale);
    cheek.position.set(side * 0.02 * scale, -0.002 * scale, 0.132 * scale);
    cheek.rotation.y = side * 0.48;
    cheek.castShadow = true;
    headGroup.add(cheek);
  }

  // 7. Iconic Horsehair Crest (Longitudinal for Hoplites, Transverse for Royals)
  const crestHolderGeo = getCachedGeo('spartan_crest_holder', () =>
    new THREE.TorusGeometry(0.155, 0.018, 12, 28, Math.PI * 1.05)
  );
  const crestHairGeo = getCachedGeo('spartan_crest_hair', () =>
    new THREE.TorusGeometry(0.188, 0.054, 16, 32, Math.PI * 1.12)
  );

  const crestHolder = new THREE.Mesh(crestHolderGeo, bronzeMat);
  const crestHair = new THREE.Mesh(crestHairGeo, plumeMat);
  crestHair.castShadow = true;

  if (transverseCrest) {
    crestHolder.rotation.z = -0.02;
    crestHolder.position.set(0, 0.06 * scale, 0);
    crestHolder.scale.setScalar(scale);
    crestHair.rotation.z = -0.06;
    crestHair.scale.set(1.15 * scale, 1.08 * scale, 0.42 * scale);
    crestHair.position.set(0, 0.082 * scale, 0);
  } else {
    crestHolder.rotation.y = Math.PI / 2;
    crestHolder.rotation.z = 0.1;
    crestHolder.position.set(0, 0.052 * scale, -0.01 * scale);
    crestHolder.scale.setScalar(scale);
    crestHair.rotation.y = Math.PI / 2;
    crestHair.rotation.z = 0.08;
    crestHair.scale.set(1.05 * scale, 1.1 * scale, 0.42 * scale);
    crestHair.position.set(0, 0.072 * scale, -0.01 * scale);
  }
  headGroup.add(crestHolder, crestHair);
}

/**
 * Builds a Roman Imperial Galea Helmet with a Sculpted Roman Legionary Face & Eyes inside!
 */
export function addRomanGaleaHelmetWithFace(
  headGroup: THREE.Group,
  steelMat: THREE.Material,
  goldMat: THREE.Material,
  crestMat: THREE.Material,
  mats: SanctumMaterialLibrary,
  isWhite: boolean,
  hasCrest = true,
  transverseCenturionCrest = false
): void {
  const skinMat = isWhite ? mats.sculptedSkinLight : mats.sculptedSkinDark;
  const beardMat = isWhite ? mats.romanPolishedSteel : mats.romanDarkSteel;

  // 1. Sculpted Roman Face with Distinct Eyes, Nose, Brow & Stern Mouth
  addSculptedHumanFace(headGroup, skinMat, mats.eyeScleraMat, mats.eyeIrisMat, beardMat, {
    scale: 0.96,
    hasBeard: false,
  });

  // 2. Polished Steel Galea Skull-Bowl (Positioned above brow so eyes & nose are clearly visible)
  const bowlGeo = getCachedGeo('roman_galea_bowl', () =>
    new THREE.SphereGeometry(0.138, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.54)
  );
  const bowl = new THREE.Mesh(bowlGeo, steelMat);
  bowl.position.set(0, 0.03, -0.008);
  bowl.rotation.x = -0.18;
  bowl.castShadow = true;
  headGroup.add(bowl);

  // 3. Projecting Frontal Brow Deflector Peak (+Z)
  const browPeakGeo = getCachedGeo('roman_galea_brow_peak', () =>
    new THREE.TorusGeometry(0.145, 0.016, 12, 24, Math.PI * 0.95)
  );
  const browPeak = new THREE.Mesh(browPeakGeo, goldMat);
  browPeak.rotation.x = Math.PI / 2 + 0.12;
  browPeak.rotation.z = -Math.PI * 0.475;
  browPeak.position.set(0, 0.048, 0.02);
  headGroup.add(browPeak);

  // 4. Angled Rear Lobster-Tail Neck Guard (-Z)
  const neckGuardGeo = getCachedGeo('roman_galea_neck', () =>
    new THREE.CylinderGeometry(0.135, 0.2, 0.08, 24, 2, true, Math.PI * 0.58, Math.PI * 0.84)
  );
  const neckGuard = new THREE.Mesh(neckGuardGeo, steelMat);
  neckGuard.position.set(0, -0.045, -0.025);
  neckGuard.rotation.x = -0.28;
  headGroup.add(neckGuard);

  // 5. Hinged Cheek Guards (Buccae) framing the face with brass rosette bosses
  const cheekGeo = getCachedGeo('roman_galea_cheek', () =>
    new THREE.BoxGeometry(0.02, 0.115, 0.088)
  );
  const bossGeo = getCachedGeo('roman_galea_boss', () =>
    new THREE.SphereGeometry(0.015, 10, 10)
  );
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(cheekGeo, steelMat);
    cheek.position.set(side * 0.112, -0.022, 0.038);
    cheek.rotation.y = side * 0.36;
    cheek.rotation.z = side * -0.1;
    headGroup.add(cheek);

    const boss = new THREE.Mesh(bossGeo, goldMat);
    boss.position.set(side * 0.12, -0.022, 0.048);
    headGroup.add(boss);
  }

  // 6. Galea Horsehair Crest
  if (hasCrest) {
    const crestBoxGeo = getCachedGeo('roman_crest_box', () =>
      new THREE.BoxGeometry(0.025, 0.06, 0.08)
    );
    const crestBox = new THREE.Mesh(crestBoxGeo, goldMat);
    crestBox.position.set(0, 0.15, 0);
    headGroup.add(crestBox);

    const crestPlumeGeo = getCachedGeo('roman_crest_plume', () =>
      new THREE.TorusGeometry(0.165, 0.046, 16, 32, Math.PI * 1.05)
    );
    const crestPlume = new THREE.Mesh(crestPlumeGeo, crestMat);
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
 * Builds an unmistakable Pompeii-Pattern Roman Gladius Sword with a wide double-edged
 * forged steel blade, diamond tip, central fuller ridge, brass guard, ribbed grip & spherical pommel.
 */
export function addRomanGladiusSword(
  weaponGroup: THREE.Group,
  forgedSteelMat: THREE.Material,
  goldMat: THREE.Material,
  gripLeatherMat: THREE.Material,
  scale = 1.0
): void {
  // 1. Spherical Gold/Ivory Pommel
  const pommelGeo = getCachedGeo('gladius_pommel', () =>
    new THREE.SphereGeometry(0.036, 14, 12)
  );
  const pommel = new THREE.Mesh(pommelGeo, goldMat);
  pommel.position.y = -0.11 * scale;
  pommel.scale.set(1.1 * scale, 0.9 * scale, 1.1 * scale);
  weaponGroup.add(pommel);

  // 2. Ribbed Bone/Leather Grip
  const gripGeo = getCachedGeo('gladius_grip', () =>
    new THREE.CylinderGeometry(0.018, 0.018, 0.13, 14)
  );
  const grip = new THREE.Mesh(gripGeo, gripLeatherMat);
  grip.position.y = -0.025 * scale;
  grip.scale.setScalar(scale);
  weaponGroup.add(grip);

  // 3. Hemispherical Brass/Gold Crossguard with RomanStuds
  const guardGeo = getCachedGeo('gladius_guard', () =>
    new THREE.BoxGeometry(0.11, 0.032, 0.048)
  );
  const guard = new THREE.Mesh(guardGeo, goldMat);
  guard.position.y = 0.05 * scale;
  guard.scale.setScalar(scale);
  weaponGroup.add(guard);

  // 4. Wide Double-Edged Forged Steel Gladius Blade with Diamond Cross-Section
  const bladeGeo = getCachedGeo('gladius_blade', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.038, 0.02);
    shape.lineTo(0.036, 0.44);
    shape.lineTo(0, 0.56); // Sharp triangular Pompeii point
    shape.lineTo(-0.036, 0.44);
    shape.lineTo(-0.038, 0.02);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      bevelSegments: 2,
    });
    g.center();
    return g;
  });
  const blade = new THREE.Mesh(bladeGeo, forgedSteelMat);
  blade.position.y = 0.34 * scale;
  blade.rotation.y = Math.PI / 2; // Edge aligned forward/backward (+Z / -Z)
  blade.scale.setScalar(scale);
  blade.castShadow = true;
  weaponGroup.add(blade);

  // 5. Golden Blood-Fuller Inlay Ridge along center of blade
  const fullerGeo = getCachedGeo('gladius_fuller', () =>
    new THREE.BoxGeometry(0.016, 0.38, 0.008)
  );
  const fuller = new THREE.Mesh(fullerGeo, goldMat);
  fuller.position.y = 0.28 * scale;
  fuller.rotation.y = Math.PI / 2;
  fuller.scale.setScalar(scale);
  weaponGroup.add(fuller);
}

/**
 * Builds the Roman Queen's (Empress Augusta) Distinct Regal Weapon:
 * An Imperial Aquila Parazonium Sword-Scepter with spread golden eagle wings crossguard,
 * crimson-jeweled hilt, and gleaming forged-steel royal blade.
 */
export function addRomanQueenRegalWeapon(
  weaponGroup: THREE.Group,
  forgedSteelMat: THREE.Material,
  goldMat: THREE.Material,
  crimsonMat: THREE.Material
): void {
  // 1. Jeweled Ruby & Gold Pommel
  const pommelGeo = getCachedGeo('queen_regal_pommel', () =>
    new THREE.OctahedronGeometry(0.044, 1)
  );
  const pommel = new THREE.Mesh(pommelGeo, crimsonMat);
  pommel.position.y = -0.14;
  weaponGroup.add(pommel);

  // 2. Ornate Gold-Wrapped Regal Grip
  const gripGeo = getCachedGeo('queen_regal_grip', () =>
    new THREE.CylinderGeometry(0.02, 0.018, 0.18, 16)
  );
  const grip = new THREE.Mesh(gripGeo, goldMat);
  grip.position.y = -0.02;
  weaponGroup.add(grip);

  // 3. Spread Imperial Eagle-Wing Crossguard
  const wingGeo = getCachedGeo('queen_regal_wing', () =>
    new THREE.BoxGeometry(0.18, 0.042, 0.032)
  );
  const wingGuard = new THREE.Mesh(wingGeo, goldMat);
  wingGuard.position.y = 0.08;
  weaponGroup.add(wingGuard);

  const jewelGeo = getCachedGeo('queen_regal_jewel', () =>
    new THREE.SphereGeometry(0.026, 12, 12)
  );
  const centerJewel = new THREE.Mesh(jewelGeo, crimsonMat);
  centerJewel.position.set(0, 0.08, 0);
  weaponGroup.add(centerJewel);

  // 4. Long Gleaming Royal Parazonium Forged-Steel Blade
  const bladeGeo = getCachedGeo('queen_regal_blade', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.042, 0.04);
    shape.lineTo(0.032, 0.58);
    shape.lineTo(0, 0.74);
    shape.lineTo(-0.032, 0.58);
    shape.lineTo(-0.042, 0.04);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.014,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      bevelSegments: 2,
    });
    g.center();
    return g;
  });
  const blade = new THREE.Mesh(bladeGeo, forgedSteelMat);
  blade.position.y = 0.45;
  blade.rotation.y = Math.PI / 2;
  blade.castShadow = true;
  weaponGroup.add(blade);

  // 5. Golden Filigree Royal Spine along the blade
  const spineGeo = getCachedGeo('queen_regal_spine', () =>
    new THREE.BoxGeometry(0.018, 0.52, 0.012)
  );
  const spine = new THREE.Mesh(spineGeo, goldMat);
  spine.position.y = 0.38;
  spine.rotation.y = Math.PI / 2;
  weaponGroup.add(spine);
}

/**
 * Builds an Anatomically Recognizable 3D Warhorse for the Knight (`n`) across all 3 Factions!
 * Features:
 * - Extruded anatomical horse torso/barrel chest, withers, and muscular S-curved neck
 * - True anatomical equine head (`headGroup`) with long tapered muzzle, cheekbones, mandible/jaw,
 *   flared nostrils, sculpted horse eyes (sclera + iris), alert ears, bridle bit & reins, and chanfron armor
 * - Articulated rearing forelegs (`bodyGroup`) with upper arm, knee, cannon bone, and angled hooves
 * - Flowing / braided horsehair mane along the crest of the neck
 */
export function buildAnatomicalWarhorse(
  bodyGroup: THREE.Group,
  headGroup: THREE.Group,
  theme: FactionTheme,
  primaryMat: THREE.Material,
  secondaryMat: THREE.Material,
  trimMat: THREE.Material,
  plumeMat: THREE.Material,
  mats: SanctumMaterialLibrary
): void {
  // ==========================================================================
  // 1. ANATOMICAL EQUINE CHEST, WITHERS & ARCHED MUSCULAR NECK (ExtrudeGeometry)
  // ==========================================================================
  const horseBodyGeo = getCachedGeo('anatomical_horse_body_neck', () => {
    // 2D Sagittal Silhouette (X = forward Z in 3D, Y = height Y in 3D)
    const shape = new THREE.Shape();
    shape.moveTo(-0.18, 0.21); // Base of hindquarters on plinth
    shape.quadraticCurveTo(-0.23, 0.38, -0.17, 0.54); // Muscular croup / back
    shape.quadraticCurveTo(-0.14, 0.66, -0.15, 0.8); // Arching back of neck (nape)
    shape.quadraticCurveTo(-0.12, 0.94, 0.02, 0.98); // Poll / top of neck crest
    shape.lineTo(0.11, 0.88); // Throat / gullet connection to head
    shape.quadraticCurveTo(0.15, 0.72, 0.21, 0.56); // Proudly puffed muscular horse chest (+Z)
    shape.quadraticCurveTo(0.22, 0.38, 0.15, 0.21); // Lower sternum to plinth
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.065,
      bevelSize: 0.055,
      bevelSegments: IS_HEADLESS ? 2 : 5,
      curveSegments: IS_HEADLESS ? 8 : 20,
    });
    // Center X and rotate so sagittal X becomes +Z forward
    g.translate(0, 0, -0.11);
    g.rotateY(-Math.PI / 2);
    return g;
  });

  const horseBodyMesh = new THREE.Mesh(horseBodyGeo, primaryMat);
  horseBodyMesh.castShadow = true;
  horseBodyMesh.receiveShadow = true;
  bodyGroup.add(horseBodyMesh);

  // Muscular Shoulder Blades (Scapulae) on Left & Right flanks
  const shoulderGeo = getCachedGeo('horse_shoulder_muscle', () =>
    new THREE.SphereGeometry(0.115, 16, 14)
  );
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(shoulderGeo, primaryMat);
    shoulder.scale.set(0.65, 1.25, 1.15);
    shoulder.position.set(side * 0.11, 0.54, 0.09);
    shoulder.rotation.x = -0.25;
    shoulder.castShadow = true;
    bodyGroup.add(shoulder);
  }

  // ==========================================================================
  // 2. ARTICULATED REARING FORELEGS & IRON-SHOD HOOVES (+Z Front)
  // ==========================================================================
  const upperLegGeo = getCachedGeo('horse_upper_foreleg', () =>
    new THREE.CylinderGeometry(0.044, 0.034, 0.22, 14)
  );
  const kneeGeo = getCachedGeo('horse_knee_joint', () =>
    new THREE.SphereGeometry(0.036, 12, 10)
  );
  const lowerLegGeo = getCachedGeo('horse_cannon_bone', () =>
    new THREE.CylinderGeometry(0.03, 0.025, 0.2, 12)
  );
  const hoofGeo = getCachedGeo('horse_hoof', () =>
    new THREE.CylinderGeometry(0.028, 0.042, 0.058, 14)
  );

  for (const side of [-1, 1]) {
    const legLift = side === 1 ? 0.04 : 0.0; // Asymmetric dynamic rearing stride
    // Upper foreleg (humerus/radius) extending forward and up
    const upperLeg = new THREE.Mesh(upperLegGeo, primaryMat);
    upperLeg.position.set(side * 0.125, 0.55 + legLift, 0.19);
    upperLeg.rotation.x = -1.08;
    upperLeg.rotation.z = side * -0.08;
    upperLeg.castShadow = true;
    bodyGroup.add(upperLeg);

    // Knee joint (carpus)
    const knee = new THREE.Mesh(kneeGeo, primaryMat);
    knee.position.set(side * 0.132, 0.6 + legLift, 0.285);
    bodyGroup.add(knee);

    // Lower cannon bone tucked downward in rearing strike pose
    const lowerLeg = new THREE.Mesh(lowerLegGeo, primaryMat);
    lowerLeg.position.set(side * 0.132, 0.51 + legLift, 0.325);
    lowerLeg.rotation.x = -0.38;
    lowerLeg.castShadow = true;
    bodyGroup.add(lowerLeg);

    // Iron/Gold Hoof
    const hoof = new THREE.Mesh(hoofGeo, trimMat);
    hoof.position.set(side * 0.132, 0.41 + legLift, 0.36);
    hoof.rotation.x = 0.28;
    bodyGroup.add(hoof);
  }

  // ==========================================================================
  // 3. FACTION BARDING ARMOR & BRAIDED/FLOWING HORSE MANE
  // ==========================================================================
  const peytralGeo = getCachedGeo('horse_peytral_armor', () =>
    new THREE.CylinderGeometry(0.19, 0.22, 0.22, 24, 2, true, -Math.PI * 0.42, Math.PI * 0.84)
  );
  const peytral = new THREE.Mesh(
    peytralGeo,
    theme === 'gothic' ? secondaryMat : trimMat
  );
  peytral.position.set(0, 0.48, 0.04);
  bodyGroup.add(peytral);

  // Flowing Sculpted Mane Locks along the arched neck crest (-Z spine)
  const maneLockGeo = getCachedGeo('horse_mane_lock', () =>
    new THREE.ConeGeometry(0.042, 0.16, 8)
  );
  const maneMat = theme === 'gothic' ? trimMat : plumeMat;
  for (let m = 0; m < 9; m++) {
    const mt = m / 8;
    const lock = new THREE.Mesh(maneLockGeo, maneMat);
    lock.position.set(
      (m % 2 === 0 ? 1 : -1) * 0.012,
      0.42 + mt * 0.52,
      -0.16 + Math.sin(mt * Math.PI * 0.75) * 0.05
    );
    lock.rotation.x = -Math.PI * 0.62;
    lock.rotation.z = (m % 2 === 0 ? 1 : -1) * 0.15;
    lock.castShadow = true;
    bodyGroup.add(lock);
  }

  // ==========================================================================
  // 4. ANATOMICAL HORSE HEAD (`headGroup`): Skull, Tapered Muzzle, Jaw, Eyes, Ears, Nostril, Bridle
  // ==========================================================================
  headGroup.position.set(0, 0.96, 0.06);

  const horseHeadGeo = getCachedGeo('anatomical_horse_head', () => {
    const hShape = new THREE.Shape();
    hShape.moveTo(-0.1, -0.04); // Back of jaw/throat
    hShape.quadraticCurveTo(-0.12, 0.08, -0.03, 0.13); // Poll / cranium top
    hShape.lineTo(0.11, 0.08); // Forehead bridge
    hShape.lineTo(0.28, -0.02); // Long straight equine nasal bridge (+Z)
    hShape.quadraticCurveTo(0.32, -0.06, 0.28, -0.11); // Upper lip / muzzle tip
    hShape.lineTo(0.21, -0.13); // Chin / lower lip
    hShape.lineTo(0.06, -0.09); // Lower mandible
    hShape.quadraticCurveTo(0.0, -0.11, -0.06, -0.07); // Prominent rounded horse cheek/jowl (ganache)
    hShape.closePath();

    const g = new THREE.ExtrudeGeometry(hShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.038,
      bevelSize: 0.032,
      bevelSegments: IS_HEADLESS ? 2 : 4,
      curveSegments: IS_HEADLESS ? 8 : 16,
    });
    g.translate(0, 0, -0.06);
    g.rotateY(-Math.PI / 2);
    return g;
  });

  const horseHeadMesh = new THREE.Mesh(horseHeadGeo, primaryMat);
  horseHeadMesh.castShadow = true;
  horseHeadMesh.receiveShadow = true;
  headGroup.add(horseHeadMesh);

  // Tapered Snout / Muzzle Bridge & Flared Nostrils (+Z tip)
  const nostrilGeo = getCachedGeo('horse_nostril', () =>
    new THREE.SphereGeometry(0.022, 10, 8)
  );
  const eyeScleraGeo = getCachedGeo('horse_eye_sclera', () =>
    new THREE.SphereGeometry(0.022, 12, 10)
  );
  const eyeIrisGeo = getCachedGeo('horse_eye_iris', () =>
    new THREE.SphereGeometry(0.013, 10, 8)
  );
  const earGeo = getCachedGeo('horse_ear', () =>
    new THREE.ConeGeometry(0.03, 0.13, 10)
  );
  const bitRingGeo = getCachedGeo('horse_bit_ring', () =>
    new THREE.TorusGeometry(0.026, 0.006, 8, 16)
  );

  for (const side of [-1, 1]) {
    // Flared Nostril
    const nostril = new THREE.Mesh(nostrilGeo, secondaryMat);
    nostril.scale.set(0.7, 0.85, 1.2);
    nostril.position.set(side * 0.048, -0.045, 0.265);
    headGroup.add(nostril);

    // Distinct Equine Eye (Sclera + Dark/Glowing Pupil) on side of skull
    const eyeSclera = new THREE.Mesh(eyeScleraGeo, mats.eyeScleraMat);
    eyeSclera.scale.set(0.65, 0.9, 1.2);
    eyeSclera.position.set(side * 0.088, 0.045, 0.095);
    headGroup.add(eyeSclera);

    const eyeIris = new THREE.Mesh(eyeIrisGeo, mats.eyeIrisMat);
    eyeIris.scale.set(0.65, 0.95, 1.1);
    eyeIris.position.set(side * 0.096, 0.045, 0.102);
    headGroup.add(eyeIris);

    // Alert Pointed Horse Ears on Poll
    const ear = new THREE.Mesh(earGeo, primaryMat);
    ear.position.set(side * 0.058, 0.165, -0.02);
    ear.rotation.x = 0.22; // Pitched forward alertly
    ear.rotation.z = side * -0.18;
    ear.castShadow = true;
    headGroup.add(ear);

    // Golden Bridle Bit Ring at corner of mouth + Rein Strap
    const bitRing = new THREE.Mesh(bitRingGeo, trimMat);
    bitRing.rotation.y = Math.PI / 2;
    bitRing.position.set(side * 0.068, -0.085, 0.22);
    headGroup.add(bitRing);
  }

  // Armored Chanfron Faceplate along the nasal bridge
  const chanfronGeo = getCachedGeo('horse_chanfron_plate', () =>
    new THREE.BoxGeometry(0.075, 0.024, 0.26)
  );
  const chanfron = new THREE.Mesh(chanfronGeo, trimMat);
  chanfron.rotation.x = 0.42;
  chanfron.position.set(0, 0.045, 0.15);
  headGroup.add(chanfron);

  // Bridle Noseband
  const nosebandGeo = getCachedGeo('horse_noseband', () =>
    new THREE.TorusGeometry(0.072, 0.009, 8, 20)
  );
  const noseband = new THREE.Mesh(nosebandGeo, trimMat);
  noseband.rotation.x = -0.35;
  noseband.position.set(0, -0.035, 0.21);
  headGroup.add(noseband);

  if (theme === 'spartan' || theme === 'roman') {
    const horsePlumeGeo = getCachedGeo('horse_head_plume', () =>
      new THREE.TorusGeometry(0.11, 0.034, 12, 24, Math.PI * 0.9)
    );
    const horsePlume = new THREE.Mesh(horsePlumeGeo, plumeMat);
    horsePlume.rotation.y = Math.PI / 2;
    horsePlume.position.set(0, 0.13, -0.02);
    headGroup.add(horsePlume);
  }
}

export function disposeSculptorGeometries(): void {
  GEO_CACHE.forEach((geo) => geo.dispose());
  GEO_CACHE.clear();
}


