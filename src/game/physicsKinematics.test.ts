import test from 'node:test';
import assert from 'node:assert/strict';
import {
  easeInOutCubic,
  easeInOutQuint,
  computePieceTrajectory,
  computeDefenderRecoil,
  computePieceSpecificAttackFrame,
  getTriggeredAttackAudioCues,
  computeDissolveReconstructState,
  getPieceFacingYaw,
  getDirectionYaw,
  generateVoronoiSeeds,
  buildVoronoiCellGeometryData,
} from './physicsKinematics.ts';

test('getPieceFacingYaw orients White toward -Z (Math.PI) and Black toward +Z (0)', () => {
  assert.equal(getPieceFacingYaw('w'), Math.PI);
  assert.equal(getPieceFacingYaw('b'), 0);
  assert.ok(Math.abs(getDirectionYaw(0, -1, 'w') - Math.PI) < 1e-6);
  assert.ok(Math.abs(getDirectionYaw(0, 1, 'b') - 0) < 1e-6);
});

test('easeInOutQuint and easeInOutCubic satisfy boundary conditions and midpoint symmetry', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);

  assert.equal(easeInOutQuint(0), 0);
  assert.equal(easeInOutQuint(0.5), 0.5);
  assert.equal(easeInOutQuint(1), 1);
  assert.ok(easeInOutQuint(0.2) < easeInOutCubic(0.2));
  assert.ok(easeInOutQuint(0.8) > easeInOutCubic(0.8));
});

test('computePieceTrajectory produces parabolic jump arc with easeInOutQuint, inertia tilt, and micro-settle bounce', () => {
  const start = computePieceTrajectory(0, 2.2, false);
  assert.equal(start.u, 0);
  assert.equal(start.y, 0);

  const midAir = computePieceTrajectory(0.425, 2.2, false);
  assert.ok(midAir.y > 0.3, 'Mid-air height should be elevated along parabolic arc');

  const knightMid = computePieceTrajectory(0.425, 2.5, true);
  assert.ok(knightMid.y > midAir.y + 0.5, 'Knight leaps higher than standard piece');

  const end = computePieceTrajectory(1.0, 2.2, false);
  assert.equal(end.u, 1.0);
  assert.ok(end.y < 0.01, 'Settles flush on the board at t = 1.0');
});

test('computePieceSpecificAttackFrame implements unique signatures for all 6 piece types (p, n, b, r, q, k)', () => {
  // 1. Pawn: Parabolic spear/pilum throw before marching into captured square
  const pawnThrow = computePieceSpecificAttackFrame('p', 'roman', 0.32, 2.2);
  assert.ok(
    pawnThrow.rangedProjectileProgress !== null && pawnThrow.rangedProjectileProgress > 0.3,
    'Pawn throws ranged Pilum/Spear while still near origin square'
  );
  assert.ok(pawnThrow.rangedProjectileArcY > 0.4, 'Pawn spear/pilum follows a high parabolic arc');
  assert.ok(pawnThrow.attackerU < 0.1, 'Pawn stays back until ranged throw shatters enemy');
  const pawnMarch = computePieceSpecificAttackFrame('p', 'roman', 0.75, 2.2);
  assert.equal(pawnMarch.rangedProjectileProgress, null, 'Ranged projectile completes before march');
  assert.ok(pawnMarch.attackerU > 0.5, 'Pawn marches into captured square after shatter');

  // 2. Knight: Warhorse/chariot rears up violently and ruthlessly tramples defender
  const knightRear = computePieceSpecificAttackFrame('n', 'spartan', 0.48, 2.5);
  assert.ok(knightRear.attackerLift > 0.9, 'Knight warhorse rears high into the air');
  assert.ok(knightRear.bodyPitch < -0.6, 'Knight pitches backward while rearing up on hind legs');

  // 3. Bishop: Summons localized vertical divine light-beam / kinetic shockwave from above
  const bishopSweep = computePieceSpecificAttackFrame('b', 'gothic', 0.38, 3.0);
  assert.ok(bishopSweep.divineBeamIntensity > 0.6, 'Bishop summons intense divine light-beam from above');
  assert.ok(bishopSweep.rangedProjectileProgress !== null, 'Bishop projects kinetic energy onto target');

  // 4. Rook: Terrifying earth-shaking forward sprint & massive shield-bash / body-tackle
  const rookCharge = computePieceSpecificAttackFrame('r', 'spartan', 0.45, 3.0);
  assert.ok(rookCharge.bodyPitch > 0.3, 'Rook leans heavily forward into full-momentum tackle');
  assert.ok(rookCharge.shieldBashZ > 0.25, 'Rook delivers massive shield bash on impact');

  // 5. Queen: Lightning-fast teleport dash with afterimages & flurry of lethal blade slashes
  const queenBlur = computePieceSpecificAttackFrame('q', 'gothic', 0.11, 3.0);
  assert.ok(queenBlur.afterimageIntensity > 0.7, 'Queen emits teleport afterimages during dash');
  const queenCombo = computePieceSpecificAttackFrame('q', 'gothic', 0.38, 3.0);
  assert.ok(Math.abs(queenCombo.bodySpinYaw) > 0.1, 'Queen spins through multi-hit weapon combo');
  assert.ok(queenCombo.activeSlashIndex >= 1, 'Queen triggers blade slash arcs during flurry');

  // 6. King: Slow, majestic overhead execution strike
  const kingWindup = computePieceSpecificAttackFrame('k', 'roman', 0.52, 1.5);
  assert.ok(kingWindup.weaponPitch < -1.3, 'King raises weapon high overhead in dramatic execution windup');
  const kingCleave = computePieceSpecificAttackFrame('k', 'roman', 0.655, 1.5);
  assert.ok(kingCleave.weaponPitch > 1.0, 'King brings weapon down in heavy execution cleave');
});

test('getTriggeredAttackAudioCues fires frame-accurate spatial SFX cues for every piece type', () => {
  assert.deepEqual(getTriggeredAttackAudioCues('p', 0.1, 0.25), ['pawn_whoosh']);
  assert.deepEqual(getTriggeredAttackAudioCues('p', 0.4, 0.5), [
    'pawn_pierce_thud',
    'voronoi_crumble_debris',
  ]);
  assert.deepEqual(getTriggeredAttackAudioCues('n', 0.05, 0.2), ['knight_neigh']);
  assert.deepEqual(getTriggeredAttackAudioCues('b', 0.0, 0.1), ['bishop_hum_charge']);
  assert.deepEqual(getTriggeredAttackAudioCues('r', 0.45, 0.55), [
    'rook_boulder_crash',
    'voronoi_crumble_debris',
  ]);
  assert.deepEqual(getTriggeredAttackAudioCues('q', 0.0, 0.08), ['queen_teleport_dash']);
  assert.deepEqual(getTriggeredAttackAudioCues('k', 0.6, 0.7), [
    'king_execution_gong',
    'voronoi_crumble_debris',
  ]);
});

test('computeDissolveReconstructState transitions cleanly across midpoint swap', () => {
  const d = computeDissolveReconstructState(0.25);
  assert.equal(d.phase, 'dissolve');
  assert.equal(d.shouldSwapGeometry, false);

  const r = computeDissolveReconstructState(0.75);
  assert.equal(r.phase, 'reconstruct');
  assert.equal(r.shouldSwapGeometry, true);
  assert.equal(r.scaleXZ, 0.675);
});

test('computeDefenderRecoil produces progressive knockback and backward tilt before shatter', () => {
  const r0 = computeDefenderRecoil(0);
  assert.equal(r0.knockbackOffset, 0);
  assert.equal(r0.recoilPitch, 0);

  const r1 = computeDefenderRecoil(1);
  assert.ok(r1.knockbackOffset > 0.2);
  assert.ok(r1.recoilPitch < -0.3);
  assert.ok(r1.scaleY < 0.9);
});

test('buildVoronoiCellGeometryData generates valid 3D Voronoi fragment geometry with normals', () => {
  const seeds = generateVoronoiSeeds(14);
  assert.equal(seeds.length, 14);

  for (let i = 0; i < seeds.length; i++) {
    const cell = buildVoronoiCellGeometryData(i, seeds);
    assert.ok(cell.positions.length >= 12);
    assert.equal(cell.positions.length, cell.normals.length);
  }
});
