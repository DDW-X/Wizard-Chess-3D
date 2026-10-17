import type { PieceColor, PieceType } from './chessEngine.ts';

export type FactionTheme = 'gothic' | 'spartan' | 'roman';

export interface TrajectorySample {
  /** Interpolated horizontal progress [0..1] using easeInOutQuint */
  u: number;
  /** Vertical height offset above board surface */
  y: number;
  /** Forward/backward pitch angle (radians) due to acceleration/deceleration inertia */
  pitchTilt: number;
  /** Banking roll angle (radians) */
  rollTilt: number;
  /** Vertical scale squash/stretch factor for landing bounce */
  scaleY: number;
  /** Horizontal scale squash/stretch factor (inverse of scaleY) */
  scaleXZ: number;
}

export interface DefenderRecoilSample {
  /** Backward displacement along attack vector */
  knockbackOffset: number;
  /** Backward pitch angle (radians) from taking the hit */
  recoilPitch: number;
  /** High-frequency hit-stop shudder offset */
  lateralJitter: number;
  /** Vertical compression before shattering */
  scaleY: number;
  scaleXZ: number;
}

export type AttackAudioCueType =
  | 'pawn_whoosh'
  | 'pawn_pierce_thud'
  | 'knight_neigh'
  | 'knight_trample_crush'
  | 'bishop_hum_charge'
  | 'bishop_divine_boom'
  | 'rook_sprint_tremor'
  | 'rook_boulder_crash'
  | 'queen_teleport_dash'
  | 'queen_blade_slash'
  | 'king_sovereign_windup'
  | 'king_execution_gong'
  | 'voronoi_crumble_debris';

export interface PieceSpecificAttackFrame {
  /** Attacker's horizontal progress from origin (0) to destination square (1) */
  attackerU: number;
  /** Attacker's vertical lift above the board */
  attackerLift: number;
  /** Lateral zig-zag blur offset perpendicular to attack direction (used by Queen's blur combo) */
  lateralOffset: number;
  /** Body forward/backward pitch (radians) */
  bodyPitch: number;
  /** Body local Y-axis spin offset (radians, used by Queen/Bishop) */
  bodySpinYaw: number;
  /** Weapon arm X-axis pitch (radians) */
  weaponPitch: number;
  /** Weapon arm Z-axis roll/sweep (radians) */
  weaponRoll: number;
  /** Weapon forward thrust offset along local +Z */
  weaponThrustZ: number;
  /** Shield Y-axis yaw angle (radians) */
  shieldYaw: number;
  /** Shield forward bash offset along local +Z */
  shieldBashZ: number;
  /** If non-null, a detached ranged projectile or shockwave travels from origin (0) to target (1) */
  rangedProjectileProgress: number | null;
  /** Parabolic height of detached projectile (e.g. Pawn spear/pilum arc) */
  rangedProjectileArcY: number;
  /** Pitch angle of detached projectile along its parabolic flight tangent (radians) */
  rangedProjectilePitch: number;
  /** Intensity [0..1] of Bishop's vertical divine light-beam / kinetic pillar from above */
  divineBeamIntensity: number;
  /** Intensity [0..1] of Queen's high-speed teleport afterimage ghosts */
  afterimageIntensity: number;
  /** Active blade slash crescent index (0 = none, 1..3 = slash index for Queen/King) */
  activeSlashIndex: number;
  /** Normalized progress [0..1] of the defender's pre-shatter recoil */
  defenderRecoilProgress: number;
  /** Normalized timeline point [0..1] at which the defender shatters into Voronoi rigid bodies */
  shatterTriggerT: number;
}

export interface FactionCombatFrame {
  /** Attacker's horizontal progress along the attack line [0..1] */
  attackerU: number;
  /** Attacker's vertical jump/leap height above the board */
  attackerLift: number;
  /** Body forward/backward pitch (radians) */
  bodyPitch: number;
  /** Weapon arm X-axis pitch (radians) */
  weaponPitch: number;
  /** Weapon arm Z-axis roll (radians) */
  weaponRoll: number;
  /** Weapon forward thrust offset along local +Z */
  weaponThrustZ: number;
  /** Shield Y-axis yaw angle (radians) */
  shieldYaw: number;
  /** Shield forward bash offset along local +Z */
  shieldBashZ: number;
  /** If non-null, a detached projectile (e.g. Roman Pilum) is in flight at progress [0..1] */
  pilumFlightProgress: number | null;
  /** Normalized progress [0..1] of the defender's pre-shatter recoil */
  defenderRecoilProgress: number;
}

export interface DissolveReconstructState {
  phase: 'dissolve' | 'reconstruct';
  /** Vertical scale multiplier [0.001..1] */
  scaleY: number;
  /** Horizontal scale multiplier [0.001..1] */
  scaleXZ: number;
  /** Vertical levitation offset during arcane morph */
  floatY: number;
  /** Swirl rotation offset around Y axis (radians) */
  spinYaw: number;
  /** Glow/emissive pulse intensity [0..1] */
  emissivePulse: number;
  /** Whether the 3D geometry should be swapped to the target faction at this point */
  shouldSwapGeometry: boolean;
}

export interface VoronoiFragmentSeed {
  id: number;
  cx: number;
  cy: number;
  cz: number;
  colorWeight: number;
}

export interface VoronoiCellGeometryData {
  positions: Float32Array;
  normals: Float32Array;
  centroid: [number, number, number];
}

/**
 * Canonical forward orientation for chess pieces on the board.
 * Piece geometry is sculpted facing local +Z.
 * - Black (rows 0, 1) faces toward +Z (toward rows 6, 7) -> rotation.y = 0
 * - White (rows 6, 7) faces toward -Z (toward rows 0, 1) -> rotation.y = Math.PI
 */
export function getPieceFacingYaw(color: PieceColor): number {
  return color === 'w' ? Math.PI : 0;
}

/**
 * Computes the world Y rotation so a piece's local +Z axis points along (dx, dz).
 */
export function getDirectionYaw(dx: number, dz: number, fallbackColor: PieceColor = 'w'): number {
  if (Math.abs(dx) < 1e-5 && Math.abs(dz) < 1e-5) {
    return getPieceFacingYaw(fallbackColor);
  }
  return Math.atan2(dx, dz);
}

/**
 * Smooth cubic easing: easeInOutCubic for secondary motions
 */
export function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Ultra-smooth quintic easing: easeInOutQuint for weight-accurate AAA movement tweens
 */
export function easeInOutQuint(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 16 * clamped * clamped * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 5) / 2;
}

/**
 * Computes realistic piece movement kinematics with:
 * - Parabolic jump arc
 * - Smooth easeInOutQuint horizontal progression
 * - Natural inertia (forward tilt during acceleration, backward tilt on braking)
 * - Micro-settle bounce upon landing
 */
export function computePieceTrajectory(
  progress: number,
  distanceWorld: number,
  isKnight: boolean
): TrajectorySample {
  const t = Math.max(0, Math.min(1, progress));
  const flightSplit = 0.85;

  if (t <= flightSplit) {
    const f = t / flightSplit;
    const u = easeInOutQuint(f);

    const basePeak = isKnight ? 1.18 : 0.34;
    const distanceBoost = Math.min(0.45, distanceWorld * 0.065);
    const peakHeight = basePeak + distanceBoost;

    const arc = Math.sin(f * Math.PI);
    const y = peakHeight * (isKnight ? Math.pow(arc, 0.82) : arc);

    const pitchTilt = Math.sin(f * Math.PI * 2) * (isKnight ? 0.24 : 0.15);
    const rollTilt = Math.sin(f * Math.PI) * (isKnight ? 0.09 : 0.035);

    const stretch = 1 + 0.055 * Math.sin(f * Math.PI);
    return {
      u,
      y,
      pitchTilt,
      rollTilt,
      scaleY: stretch,
      scaleXZ: 1 / Math.sqrt(stretch),
    };
  } else {
    const s = (t - flightSplit) / (1 - flightSplit);
    const u = 1.0;

    const damping = Math.exp(-5.5 * s);
    const bounceWave = Math.abs(Math.sin(s * Math.PI * 1.5));
    const y = 0.042 * damping * bounceWave;

    const pitchTilt = -0.09 * damping * Math.sin(s * Math.PI * 2);
    const rollTilt = 0;

    const squash = 1 - 0.065 * Math.sin(s * Math.PI) * damping;
    return {
      u,
      y,
      pitchTilt,
      rollTilt,
      scaleY: squash,
      scaleXZ: 1 / Math.sqrt(squash),
    };
  }
}

/**
 * Computes unique, piece-specific AAA attack animations across all factions:
 * - Pawn ('p'): Hurls spear/pilum through the air in a high parabolic arc, piercing the enemy, then marches in.
 * - Knight ('n'): Warhorse/chariot rears up violently on hind legs and ruthlessly tramples the enemy under hooves.
 * - Bishop ('b'): Raises staff/crozier overhead, summoning a localized vertical divine light-beam / kinetic shockwave from above.
 * - Rook ('r'): Terrifying, earth-shaking forward sprint culminating in a massive shield-bash / body-tackle.
 * - Queen ('q'): Lightning-fast teleport dash with afterimages followed by a lethal 3-slash blade combo.
 * - King ('k'): Slow, majestic, immensely heavy execution strike with broadsword or royal scepter.
 */
export function computePieceSpecificAttackFrame(
  pieceType: PieceType,
  theme: FactionTheme,
  progress: number,
  distanceWorld = 2.0
): PieceSpecificAttackFrame {
  const t = Math.max(0, Math.min(1, progress));

  if (pieceType === 'p') {
    // PAWN: Parabolic Spear/Pilum Hurl (0..0.46) -> Enemy Pierced & Shattered at 0.46 -> Disciplined March into Square (0.46..1.0)
    const shatterTriggerT = 0.46;
    if (t < 0.18) {
      // Phase 1: Step back & draw Spear/Pilum/Halberd high behind shoulder
      const w = easeInOutCubic(t / 0.18);
      return {
        attackerU: -0.04 * w,
        attackerLift: 0.05 * w,
        lateralOffset: 0,
        bodyPitch: -0.26 * w,
        bodySpinYaw: -0.22 * w,
        weaponPitch: -1.35 * w,
        weaponRoll: 0.2 * w,
        weaponThrustZ: -0.18 * w,
        shieldYaw: 0.42 * w,
        shieldBashZ: 0.06 * w,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 0,
        shatterTriggerT,
      };
    } else if (t < shatterTriggerT) {
      // Phase 2: Hurl Spear/Pilum along a true parabolic ballistic trajectory!
      const p = (t - 0.18) / (shatterTriggerT - 0.18); // [0..1]
      const snap = easeInOutCubic(Math.min(1, p * 2.5));
      const peakArc = Math.min(1.35, 0.72 + distanceWorld * 0.12);
      const arcY = Math.sin(p * Math.PI) * peakArc;
      // Derivative dy/dp = PI * peakArc * cos(p * PI); pitch follows ballistic tangent
      const dy = Math.PI * peakArc * Math.cos(p * Math.PI);
      const dz = Math.max(1.2, distanceWorld);
      const ballisticPitch = Math.atan2(-dy, dz);
      const recoilP = p > 0.72 ? (p - 0.72) / 0.28 : 0;
      return {
        attackerU: -0.04 + 0.09 * snap,
        attackerLift: 0.05 * (1 - snap),
        lateralOffset: 0,
        bodyPitch: -0.26 + 0.56 * snap,
        bodySpinYaw: -0.22 + 0.35 * snap,
        weaponPitch: -1.35 + 2.15 * snap,
        weaponRoll: 0.15 * (1 - snap),
        weaponThrustZ: 0.32 * snap,
        shieldYaw: 0.42 - 0.55 * snap,
        shieldBashZ: 0.08,
        rangedProjectileProgress: p,
        rangedProjectileArcY: arcY,
        rangedProjectilePitch: ballisticPitch,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: recoilP,
        shatterTriggerT,
      };
    } else {
      // Phase 3: Enemy shatters from piercing spear; Pawn marches decisively into captured square
      const m = (t - shatterTriggerT) / (1 - shatterTriggerT);
      const marchU = easeInOutQuint(m);
      const stepCadence = Math.abs(Math.sin(m * Math.PI * 3)) * 0.13 * (1 - 0.25 * m);
      return {
        attackerU: 0.05 + 0.95 * marchU,
        attackerLift: stepCadence,
        lateralOffset: 0,
        bodyPitch: 0.15 * Math.sin(m * Math.PI),
        bodySpinYaw: 0,
        weaponPitch: 0.8 * (1 - marchU),
        weaponRoll: 0,
        weaponThrustZ: 0.32 * (1 - marchU),
        shieldYaw: 0.28 * Math.sin(m * Math.PI),
        shieldBashZ: 0.12 * Math.sin(m * Math.PI),
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 1,
        shatterTriggerT,
      };
    }
  } else if (pieceType === 'n') {
    // KNIGHT: Approach Gallop (0..0.26) -> Violent Rear Up on Hind Legs (0.26..0.52) -> Ruthless Hoof Trample (0.52..0.72) -> Settle
    const shatterTriggerT = 0.66;
    if (t < 0.26) {
      const a = easeInOutQuint(t / 0.26);
      return {
        attackerU: a * 0.78,
        attackerLift: Math.sin(a * Math.PI) * 0.36,
        lateralOffset: 0,
        bodyPitch: 0.22 * Math.sin(a * Math.PI),
        bodySpinYaw: 0,
        weaponPitch: -0.35 * a,
        weaponRoll: 0.15 * a,
        weaponThrustZ: 0,
        shieldYaw: 0.2 * a,
        shieldBashZ: 0,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 0,
        shatterTriggerT,
      };
    } else if (t < 0.52) {
      // Warhorse rears violently up on its hind legs directly in front of the target
      const r = easeInOutCubic((t - 0.26) / 0.26);
      return {
        attackerU: 0.78 + 0.08 * r,
        attackerLift: 1.24 * r,
        lateralOffset: Math.sin(r * Math.PI * 3) * 0.03,
        bodyPitch: -0.96 * r, // Dramatic vertical horse rear-up
        bodySpinYaw: 0,
        weaponPitch: -0.35 - 0.65 * r,
        weaponRoll: 0.25 * r,
        weaponThrustZ: 0.1 * r,
        shieldYaw: 0.28 * r,
        shieldBashZ: 0,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 0.18 * r,
        shatterTriggerT,
      };
    } else if (t < shatterTriggerT) {
      // Ruthless downward hoof slam crushing the defender
      const c = Math.pow((t - 0.52) / (shatterTriggerT - 0.52), 2);
      return {
        attackerU: 0.86 + 0.12 * c,
        attackerLift: 1.24 * (1 - c),
        lateralOffset: 0,
        bodyPitch: -0.96 + 1.38 * c, // Slamming forehooves down onto target
        bodySpinYaw: 0,
        weaponPitch: -1.0 + 1.65 * c,
        weaponRoll: 0.25 * (1 - c),
        weaponThrustZ: 0.36 * c,
        shieldYaw: 0.28 * (1 - c),
        shieldBashZ: 0.24 * c,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 0.18 + 0.82 * c,
        shatterTriggerT,
      };
    } else {
      // Secondary trampling stomp & settle
      const s = (t - shatterTriggerT) / (1 - shatterTriggerT);
      const settleU = easeInOutCubic(s);
      const stomp = Math.abs(Math.sin(s * Math.PI * 2)) * 0.16 * (1 - s);
      return {
        attackerU: 0.98 + 0.02 * settleU,
        attackerLift: stomp,
        lateralOffset: 0,
        bodyPitch: 0.42 * (1 - settleU) - 0.12 * Math.sin(s * Math.PI * 2) * (1 - s),
        bodySpinYaw: 0,
        weaponPitch: 0.65 * (1 - settleU),
        weaponRoll: 0,
        weaponThrustZ: 0.36 * (1 - settleU),
        shieldYaw: 0,
        shieldBashZ: 0,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 1,
        shatterTriggerT,
      };
    }
  } else if (pieceType === 'b') {
    // BISHOP: Levitate & Raise Staff/Crozier (0..0.24) -> Summon Localized Divine Light-Beam / Kinetic Pillar from Above (0.24..0.52) -> Glide into Square (0.52..1.0)
    const shatterTriggerT = 0.5;
    if (t < 0.24) {
      const w = easeInOutCubic(t / 0.24);
      return {
        attackerU: 0.08 * w,
        attackerLift: 0.38 * w,
        lateralOffset: 0,
        bodyPitch: -0.22 * w,
        bodySpinYaw: -0.35 * w,
        weaponPitch: -1.25 * w, // Raise staff/crozier skyward
        weaponRoll: -0.65 * w,
        weaponThrustZ: 0.12 * w,
        shieldYaw: 0.35 * w,
        shieldBashZ: 0,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0.35 * w, // Sky beam begins forming overhead
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 0,
        shatterTriggerT,
      };
    } else if (t < shatterTriggerT) {
      // Sweeping staff strike & blinding vertical divine light-beam vaporizing target
      const s = (t - 0.24) / (shatterTriggerT - 0.24);
      const sweep = easeInOutCubic(s);
      return {
        attackerU: 0.08 + 0.14 * sweep,
        attackerLift: 0.38 + 0.12 * Math.sin(s * Math.PI),
        lateralOffset: 0,
        bodyPitch: -0.22 + 0.48 * sweep,
        bodySpinYaw: -0.35 + 0.72 * sweep,
        weaponPitch: -1.25 + 1.85 * sweep,
        weaponRoll: -0.65 + 1.55 * sweep,
        weaponThrustZ: 0.35 * Math.sin(s * Math.PI),
        shieldYaw: 0.35 - 0.65 * sweep,
        shieldBashZ: 0.16 * sweep,
        rangedProjectileProgress: s,
        rangedProjectileArcY: (1 - s) * 3.2, // Descending from heavens onto target
        rangedProjectilePitch: Math.PI / 2,
        divineBeamIntensity: 0.35 + 0.65 * Math.sin(s * Math.PI * 0.85),
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: s > 0.45 ? (s - 0.45) / 0.55 : 0,
        shatterTriggerT,
      };
    } else {
      // Ethereal glide into the newly purified square as divine beam dissipates
      const g = (t - shatterTriggerT) / (1 - shatterTriggerT);
      const glideU = easeInOutQuint(g);
      return {
        attackerU: 0.22 + 0.78 * glideU,
        attackerLift: 0.38 * (1 - glideU) + Math.sin(g * Math.PI) * 0.2,
        lateralOffset: 0,
        bodyPitch: 0.26 * (1 - glideU),
        bodySpinYaw: 0.37 * (1 - glideU),
        weaponPitch: 0.6 * (1 - glideU),
        weaponRoll: 0.9 * (1 - glideU),
        weaponThrustZ: 0,
        shieldYaw: -0.3 * (1 - glideU),
        shieldBashZ: 0,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: Math.max(0, (1 - g * 2.2) * 0.85),
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 1,
        shatterTriggerT,
      };
    }
  } else if (pieceType === 'r') {
    // ROOK: Terrifying Earth-Shaking Forward Sprint (0..0.50) -> Massive Shield-Bash / Body-Tackle (0.50) -> Heavy Skid Settle (0.50..1.0)
    const shatterTriggerT = 0.5;
    if (t < shatterTriggerT) {
      const c = t / shatterTriggerT;
      // Accelerating heavy battering-ram sprint
      const chargeU = c * c * (3 - 2 * c);
      const impactWindow = c > 0.66 ? (c - 0.66) / 0.34 : 0;
      return {
        attackerU: chargeU * 0.94,
        attackerLift: Math.abs(Math.sin(c * Math.PI * 5)) * 0.11, // Heavy earth-shaking sprint strides
        lateralOffset: Math.sin(c * Math.PI * 5) * 0.035,
        bodyPitch: 0.42 * chargeU, // Lowering shoulder/shield into full-momentum tackle
        bodySpinYaw: 0,
        weaponPitch: 0.48 * chargeU,
        weaponRoll: 0,
        weaponThrustZ: 0.24 * impactWindow,
        shieldYaw: -0.15 * impactWindow,
        shieldBashZ: 0.42 * impactWindow, // Massive forward shield-bash / body-tackle
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: impactWindow,
        shatterTriggerT,
      };
    } else {
      const skidT = (t - shatterTriggerT) / (1 - shatterTriggerT);
      const skidU = 1 - Math.pow(1 - skidT, 3);
      const rock = Math.sin(skidT * Math.PI * 2.5) * 0.18 * Math.exp(-4 * skidT);
      return {
        attackerU: 0.94 + 0.06 * skidU,
        attackerLift: 0,
        lateralOffset: 0,
        bodyPitch: 0.42 * (1 - skidU) + rock,
        bodySpinYaw: 0,
        weaponPitch: 0,
        weaponRoll: 0,
        weaponThrustZ: 0,
        shieldYaw: 0,
        shieldBashZ: 0.42 * (1 - skidU),
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 1,
        shatterTriggerT,
      };
    }
  } else if (pieceType === 'q') {
    // QUEEN: Near-Teleport Dash with Afterimages (0..0.22) -> Flurry of 3 Rapid Lethal Blade Slashes (0.22..0.62) -> Sovereign Recovery
    const shatterTriggerT = 0.62;
    if (t < 0.22) {
      const dashU = easeInOutQuint(t / 0.22);
      return {
        attackerU: dashU * 0.85,
        attackerLift: Math.sin(dashU * Math.PI) * 0.26,
        lateralOffset: Math.sin(dashU * Math.PI * 2) * 0.3, // High-speed zig-zag phantom blur
        bodyPitch: 0.38 * Math.sin(dashU * Math.PI),
        bodySpinYaw: 0,
        weaponPitch: -0.85 * dashU,
        weaponRoll: 0.65 * dashU,
        weaponThrustZ: 0,
        shieldYaw: 0,
        shieldBashZ: 0,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: Math.sin(dashU * Math.PI), // Peak teleport afterimages during dash
        activeSlashIndex: 0,
        defenderRecoilProgress: 0,
        shatterTriggerT,
      };
    } else if (t < shatterTriggerT) {
      // Flurry of 3 rapid, lethal blade slashes (Slash 1: Diagonal Left, Slash 2: Spinning Right, Slash 3: Lethal Cross-Finisher)
      const comboT = (t - 0.22) / (shatterTriggerT - 0.22); // [0..1]
      const hitPhase = comboT * 3; // 3 rapid slashes
      const slashIndex = Math.min(3, Math.floor(hitPhase) + 1);
      const wave = Math.sin(hitPhase * Math.PI * 2);
      return {
        attackerU: 0.85 + 0.1 * comboT,
        attackerLift: comboT > 0.66 ? Math.sin(((comboT - 0.66) / 0.34) * Math.PI) * 0.58 : 0.09,
        lateralOffset: Math.sin(comboT * Math.PI * 3) * 0.24,
        bodyPitch: 0.3 * Math.sin(hitPhase * Math.PI),
        bodySpinYaw: wave * 0.64,
        weaponPitch: comboT > 0.66 ? -1.15 + ((comboT - 0.66) / 0.34) * 2.6 : 0.95 * wave,
        weaponRoll: Math.cos(hitPhase * Math.PI * 2) * 1.05,
        weaponThrustZ: 0.36 * Math.abs(wave),
        shieldYaw: -wave * 0.38,
        shieldBashZ: 0.14,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0.65 * (1 - comboT * 0.5),
        activeSlashIndex: slashIndex,
        defenderRecoilProgress: comboT,
        shatterTriggerT,
      };
    } else {
      const recT = (t - shatterTriggerT) / (1 - shatterTriggerT);
      const recU = easeInOutQuint(recT);
      return {
        attackerU: 0.95 + 0.05 * recU,
        attackerLift: 0,
        lateralOffset: 0,
        bodyPitch: 0.2 * (1 - recU),
        bodySpinYaw: 0,
        weaponPitch: 1.45 * (1 - recU),
        weaponRoll: 0,
        weaponThrustZ: 0,
        shieldYaw: 0,
        shieldBashZ: 0,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 1,
        shatterTriggerT,
      };
    }
  } else {
    // KING ('k'): Slow, Majestic Approach (0..0.34) -> Dramatic Two-Handed Overhead Windup & Pause (0.34..0.56) -> Immensely Heavy Execution Strike (0.56..0.68) -> Regal Settle
    const shatterTriggerT = 0.66;
    if (t < 0.34) {
      const m = easeInOutCubic(t / 0.34);
      return {
        attackerU: m * 0.82,
        attackerLift: Math.abs(Math.sin(m * Math.PI * 2)) * 0.09,
        lateralOffset: 0,
        bodyPitch: 0.08 * m,
        bodySpinYaw: 0,
        weaponPitch: -0.45 * m,
        weaponRoll: 0,
        weaponThrustZ: 0,
        shieldYaw: 0.16 * m,
        shieldBashZ: 0,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0,
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 0,
        shatterTriggerT,
      };
    } else if (t < 0.56) {
      // Dramatic slow overhead execution windup
      const w = easeInOutCubic((t - 0.34) / 0.22);
      return {
        attackerU: 0.82 + 0.04 * w,
        attackerLift: 0.2 * w,
        lateralOffset: 0,
        bodyPitch: 0.08 - 0.44 * w,
        bodySpinYaw: -0.15 * w,
        weaponPitch: -0.45 - 1.25 * w, // Raised high above crown (-1.70 rad)
        weaponRoll: 0.14 * w,
        weaponThrustZ: -0.1 * w,
        shieldYaw: 0.42 * w,
        shieldBashZ: 0,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0.25 * w, // Subtle golden execution aura
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 0.12 * w,
        shatterTriggerT,
      };
    } else if (t < shatterTriggerT) {
      // Immensely heavy execution strike cleaving downward
      const c = Math.pow((t - 0.56) / (shatterTriggerT - 0.56), 3);
      return {
        attackerU: 0.86 + 0.1 * c,
        attackerLift: 0.2 * (1 - c),
        lateralOffset: 0,
        bodyPitch: -0.36 + 0.82 * c,
        bodySpinYaw: -0.15 + 0.24 * c,
        weaponPitch: -1.7 + 3.25 * c, // Massive 185-degree execution cleave
        weaponRoll: 0.14 * (1 - c),
        weaponThrustZ: 0.42 * c,
        shieldYaw: 0.42 - 0.52 * c,
        shieldBashZ: 0.22 * c,
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: 0.55 * c,
        afterimageIntensity: 0,
        activeSlashIndex: 3,
        defenderRecoilProgress: 0.12 + 0.88 * c,
        shatterTriggerT,
      };
    } else {
      const s = (t - shatterTriggerT) / (1 - shatterTriggerT);
      const settleU = easeInOutQuint(s);
      return {
        attackerU: 0.96 + 0.04 * settleU,
        attackerLift: 0,
        lateralOffset: 0,
        bodyPitch: 0.46 * (1 - settleU),
        bodySpinYaw: 0.09 * (1 - settleU),
        weaponPitch: 1.55 * (1 - settleU),
        weaponRoll: 0,
        weaponThrustZ: 0.42 * (1 - settleU),
        shieldYaw: 0,
        shieldBashZ: 0.22 * (1 - settleU),
        rangedProjectileProgress: null,
        rangedProjectileArcY: 0,
        rangedProjectilePitch: 0,
        divineBeamIntensity: Math.max(0, 0.55 * (1 - s * 2.5)),
        afterimageIntensity: 0,
        activeSlashIndex: 0,
        defenderRecoilProgress: 1,
        shatterTriggerT,
      };
    }
  }
}

/**
 * Pure deterministic scheduler that returns any spatial audio cues crossed between
 * `prevProgress` and `currProgress` for a given piece's attack animation.
 */
export function getTriggeredAttackAudioCues(
  pieceType: PieceType,
  prevProgress: number,
  currProgress: number
): AttackAudioCueType[] {
  const cues: AttackAudioCueType[] = [];
  const crossed = (threshold: number) => prevProgress < threshold && currProgress >= threshold;

  if (pieceType === 'p') {
    if (crossed(0.18)) cues.push('pawn_whoosh');
    if (crossed(0.46)) {
      cues.push('pawn_pierce_thud');
      cues.push('voronoi_crumble_debris');
    }
  } else if (pieceType === 'n') {
    if (crossed(0.12)) cues.push('knight_neigh');
    if (crossed(0.66)) {
      cues.push('knight_trample_crush');
      cues.push('voronoi_crumble_debris');
    }
  } else if (pieceType === 'b') {
    if (crossed(0.05)) cues.push('bishop_hum_charge');
    if (crossed(0.5)) {
      cues.push('bishop_divine_boom');
      cues.push('voronoi_crumble_debris');
    }
  } else if (pieceType === 'r') {
    if (crossed(0.05)) cues.push('rook_sprint_tremor');
    if (crossed(0.24)) cues.push('rook_sprint_tremor');
    if (crossed(0.5)) {
      cues.push('rook_boulder_crash');
      cues.push('voronoi_crumble_debris');
    }
  } else if (pieceType === 'q') {
    if (crossed(0.03)) cues.push('queen_teleport_dash');
    if (crossed(0.24)) cues.push('queen_blade_slash');
    if (crossed(0.38)) cues.push('queen_blade_slash');
    if (crossed(0.52)) cues.push('queen_blade_slash');
    if (crossed(0.62)) {
      cues.push('queen_blade_slash');
      cues.push('voronoi_crumble_debris');
    }
  } else if (pieceType === 'k') {
    if (crossed(0.32)) cues.push('king_sovereign_windup');
    if (crossed(0.66)) {
      cues.push('king_execution_gong');
      cues.push('voronoi_crumble_debris');
    }
  }

  return cues;
}

/**
 * Legacy faction-specific combat choreography wrapper preserved for compatibility.
 */
export function computeFactionCombatFrame(
  theme: FactionTheme,
  pieceType: PieceType,
  progress: number
): FactionCombatFrame {
  const frame = computePieceSpecificAttackFrame(pieceType, theme, progress);
  return {
    attackerU: frame.attackerU,
    attackerLift: frame.attackerLift,
    bodyPitch: frame.bodyPitch,
    weaponPitch: frame.weaponPitch,
    weaponRoll: frame.weaponRoll,
    weaponThrustZ: frame.weaponThrustZ,
    shieldYaw: frame.shieldYaw,
    shieldBashZ: frame.shieldBashZ,
    pilumFlightProgress: frame.rangedProjectileProgress,
    defenderRecoilProgress: frame.defenderRecoilProgress,
  };
}

/**
 * Computes the dissolve-and-reconstruct morph animation state when switching factions on the fly.
 */
export function computeDissolveReconstructState(progress: number): DissolveReconstructState {
  const t = Math.max(0, Math.min(1, progress));
  if (t < 0.5) {
    const d = easeInOutQuint(t / 0.5);
    return {
      phase: 'dissolve',
      scaleY: Math.max(0.02, 1 - 0.92 * d),
      scaleXZ: Math.max(0.02, 1 - 0.65 * d),
      floatY: 0.42 * d,
      spinYaw: d * Math.PI * 0.75,
      emissivePulse: Math.sin(d * Math.PI),
      shouldSwapGeometry: false,
    };
  } else {
    const r = easeInOutQuint((t - 0.5) / 0.5);
    return {
      phase: 'reconstruct',
      scaleY: Math.max(0.02, 0.08 + 0.92 * r),
      scaleXZ: Math.max(0.02, 0.35 + 0.65 * r),
      floatY: 0.42 * (1 - r),
      spinYaw: (1 - r) * Math.PI * 0.75,
      emissivePulse: Math.sin((1 - r) * Math.PI),
      shouldSwapGeometry: true,
    };
  }
}

/**
 * Computes the defending piece's physical recoil when struck by an attacker
 * immediately prior to Voronoi disintegration.
 */
export function computeDefenderRecoil(recoilProgress: number): DefenderRecoilSample {
  const t = Math.max(0, Math.min(1, recoilProgress));
  const easeOut = 1 - Math.pow(1 - t, 3);

  const knockbackOffset = 0.24 * easeOut;
  const recoilPitch = easeOut === 0 ? 0 : -0.38 * easeOut;
  const lateralJitter = Math.sin(t * Math.PI * 10) * 0.048 * t;
  const scaleY = 1 - 0.14 * easeOut;
  const scaleXZ = 1 + 0.09 * easeOut;

  return {
    knockbackOffset,
    recoilPitch,
    lateralJitter,
    scaleY,
    scaleXZ,
  };
}

type Vec3 = [number, number, number];

interface ConvexPolyhedron {
  vertices: Vec3[];
  faces: number[][];
}

function createInitialBox(halfX: number, minY: number, maxY: number, halfZ: number): ConvexPolyhedron {
  const vertices: Vec3[] = [
    [-halfX, minY, -halfZ],
    [halfX, minY, -halfZ],
    [halfX, maxY, -halfZ],
    [-halfX, maxY, -halfZ],
    [-halfX, minY, halfZ],
    [halfX, minY, halfZ],
    [halfX, maxY, halfZ],
    [-halfX, maxY, halfZ],
  ];

  const faces: number[][] = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [0, 4, 7, 3],
    [1, 2, 6, 5],
  ];

  return { vertices, faces };
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function clipPolyhedronByPlane(
  poly: ConvexPolyhedron,
  planeNormal: Vec3,
  planeConstant: number
): ConvexPolyhedron {
  const eps = 1e-6;
  const dists = poly.vertices.map((v) => dot3(planeNormal, v) - planeConstant);

  if (dists.every((d) => d <= eps)) {
    return poly;
  }
  if (dists.every((d) => d >= -eps)) {
    return { vertices: [], faces: [] };
  }

  const newVertices: Vec3[] = [];
  const oldToNew = new Map<number, number>();
  const edgeCache = new Map<string, number>();

  const getKeepVertex = (oldIdx: number): number => {
    let idx = oldToNew.get(oldIdx);
    if (idx === undefined) {
      idx = newVertices.length;
      newVertices.push(poly.vertices[oldIdx]);
      oldToNew.set(oldIdx, idx);
    }
    return idx;
  };

  const getEdgeIntersection = (i1: number, i2: number): number => {
    const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
    let idx = edgeCache.get(key);
    if (idx !== undefined) return idx;

    const d1 = dists[i1];
    const d2 = dists[i2];
    const t = d1 / (d1 - d2);
    const v1 = poly.vertices[i1];
    const v2 = poly.vertices[i2];
    const interp: Vec3 = [
      v1[0] + (v2[0] - v1[0]) * t,
      v1[1] + (v2[1] - v1[1]) * t,
      v1[2] + (v2[2] - v1[2]) * t,
    ];
    idx = newVertices.length;
    newVertices.push(interp);
    edgeCache.set(key, idx);
    return idx;
  };

  const newFaces: number[][] = [];
  const capEdges: [number, number][] = [];

  for (const face of poly.faces) {
    const clippedFace: number[] = [];
    const n = face.length;
    let entryVertex = -1;
    let exitVertex = -1;

    for (let i = 0; i < n; i++) {
      const curr = face[i];
      const next = face[(i + 1) % n];
      const dCurr = dists[curr];
      const dNext = dists[next];

      const currIn = dCurr <= eps;
      const nextIn = dNext <= eps;

      if (currIn && nextIn) {
        clippedFace.push(getKeepVertex(next));
      } else if (currIn && !nextIn) {
        const inter = getEdgeIntersection(curr, next);
        clippedFace.push(inter);
        exitVertex = inter;
      } else if (!currIn && nextIn) {
        const inter = getEdgeIntersection(curr, next);
        clippedFace.push(inter);
        clippedFace.push(getKeepVertex(next));
        entryVertex = inter;
      }
    }

    if (clippedFace.length >= 3) {
      newFaces.push(clippedFace);
    }
    if (exitVertex !== -1 && entryVertex !== -1 && exitVertex !== entryVertex) {
      capEdges.push([exitVertex, entryVertex]);
    }
  }

  if (capEdges.length >= 3) {
    const capLoop: number[] = [capEdges[0][0], capEdges[0][1]];
    const used = new Set<number>([0]);

    while (used.size < capEdges.length) {
      const tail = capLoop[capLoop.length - 1];
      let found = false;
      for (let i = 0; i < capEdges.length; i++) {
        if (used.has(i)) continue;
        const [a, b] = capEdges[i];
        if (a === tail) {
          used.add(i);
          if (b !== capLoop[0]) capLoop.push(b);
          found = true;
          break;
        } else if (b === tail) {
          used.add(i);
          if (a !== capLoop[0]) capLoop.push(a);
          found = true;
          break;
        }
      }
      if (!found) break;
    }

    if (capLoop.length >= 3) {
      const v0 = newVertices[capLoop[0]];
      const v1 = newVertices[capLoop[1]];
      const v2 = newVertices[capLoop[2]];
      const nCheck = cross3(sub3(v1, v0), sub3(v2, v0));
      if (dot3(nCheck, planeNormal) < 0) {
        capLoop.reverse();
      }
      newFaces.push(capLoop);
    }
  }

  return { vertices: newVertices, faces: newFaces };
}

export function generateVoronoiSeeds(count = 14): VoronoiFragmentSeed[] {
  const seeds: VoronoiFragmentSeed[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const frac = (i + 0.5) / count;
    const y = 0.08 + frac * 1.12;
    const radius = 0.1 + 0.16 * Math.sin(frac * Math.PI);
    const theta = i * goldenAngle;

    seeds.push({
      id: i,
      cx: Math.cos(theta) * radius,
      cy: y,
      cz: Math.sin(theta) * radius,
      colorWeight: (i % 3) / 2,
    });
  }
  return seeds;
}

export function buildVoronoiCellGeometryData(
  seedIndex: number,
  seeds: VoronoiFragmentSeed[] = generateVoronoiSeeds()
): VoronoiCellGeometryData {
  const target = seeds[seedIndex];
  let poly = createInitialBox(0.32, 0.0, 1.32, 0.32);

  for (let j = 0; j < seeds.length; j++) {
    if (j === seedIndex) continue;
    const other = seeds[j];
    const diff: Vec3 = [other.cx - target.cx, other.cy - target.cy, other.cz - target.cz];
    const normal = normalize3(diff);
    const mid: Vec3 = [
      (target.cx + other.cx) * 0.5,
      (target.cy + other.cy) * 0.5,
      (target.cz + other.cz) * 0.5,
    ];
    const constant = dot3(normal, mid);
    poly = clipPolyhedronByPlane(poly, normal, constant);
    if (poly.vertices.length === 0) break;
  }

  let cx = 0;
  let cy = 0;
  let cz = 0;
  const nVerts = poly.vertices.length || 1;
  for (const v of poly.vertices) {
    cx += v[0];
    cy += v[1];
    cz += v[2];
  }
  cx /= nVerts;
  cy /= nVerts;
  cz /= nVerts;

  const posList: number[] = [];
  const normList: number[] = [];

  for (const face of poly.faces) {
    if (face.length < 3) continue;
    const v0 = poly.vertices[face[0]];
    const v1 = poly.vertices[face[1]];
    const v2 = poly.vertices[face[2]];
    const faceNormal = normalize3(cross3(sub3(v1, v0), sub3(v2, v0)));

    for (let k = 1; k < face.length - 1; k++) {
      const a = poly.vertices[face[0]];
      const b = poly.vertices[face[k]];
      const c = poly.vertices[face[k + 1]];

      posList.push(
        a[0] - cx,
        a[1] - cy,
        a[2] - cz,
        b[0] - cx,
        b[1] - cy,
        b[2] - cz,
        c[0] - cx,
        c[1] - cy,
        c[2] - cz
      );
      normList.push(
        faceNormal[0],
        faceNormal[1],
        faceNormal[2],
        faceNormal[0],
        faceNormal[1],
        faceNormal[2],
        faceNormal[0],
        faceNormal[1],
        faceNormal[2]
      );
    }
  }

  return {
    positions: new Float32Array(posList),
    normals: new Float32Array(normList),
    centroid: [cx, cy, cz],
  };
}
