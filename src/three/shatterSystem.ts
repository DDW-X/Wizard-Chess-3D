import * as THREE from 'three';
import { PieceColor } from '../game/chessEngine';
import {
  FactionTheme,
  buildVoronoiCellGeometryData,
  generateVoronoiSeeds,
} from '../game/physicsKinematics';

const MAX_SHARDS = 220;
const MAX_DUST_PUFFS = 84;
const MAX_SHOCKWAVES = 8;

interface ShardState {
  active: boolean;
  settled: boolean;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  age: number;
  maxAge: number;
}

interface DustPuffState {
  active: boolean;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  baseScale: number;
  age: number;
  maxAge: number;
}

interface ShockwaveState {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
}

const _dummy = new THREE.Object3D();
const _shardColor = new THREE.Color();
const _puffColor = new THREE.Color();

export class ShatterParticleSystem {
  public instancedMesh: THREE.InstancedMesh;
  public dustPuffMesh: THREE.InstancedMesh;

  private shards: ShardState[] = [];
  private shardCursor = 0;
  private puffs: DustPuffState[] = [];
  private puffCursor = 0;
  private shockwaves: ShockwaveState[] = [];
  private shockwaveCursor = 0;

  private voronoiGeo: THREE.BufferGeometry;
  private shardMat: THREE.MeshPhysicalMaterial;
  private puffGeo: THREE.SphereGeometry;
  private puffMat: THREE.MeshStandardMaterial;
  private shockwaveGeo: THREE.RingGeometry;

  constructor(
    scene: THREE.Scene,
    _lightMat?: THREE.Material,
    _darkMat?: THREE.Material,
    _goldMat?: THREE.Material
  ) {
    const isHeadless =
      typeof navigator !== 'undefined' &&
      /HeadlessChrome|Playwright/i.test(navigator.userAgent);

    const seeds = generateVoronoiSeeds(14);
    const cellData = buildVoronoiCellGeometryData(0, seeds);
    this.voronoiGeo = new THREE.BufferGeometry();
    this.voronoiGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(cellData.positions, 3)
    );
    this.voronoiGeo.setAttribute(
      'normal',
      new THREE.BufferAttribute(cellData.normals, 3)
    );

    this.shardMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.25,
      clearcoat: isHeadless ? 0 : 0.85,
      clearcoatRoughness: 0.08,
      flatShading: true,
    });

    this.instancedMesh = new THREE.InstancedMesh(
      this.voronoiGeo,
      this.shardMat,
      MAX_SHARDS
    );
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.castShadow = !isHeadless;
    this.instancedMesh.receiveShadow = !isHeadless;

    for (let i = 0; i < MAX_SHARDS; i++) {
      this.shards.push({
        active: false,
        settled: false,
        px: 0,
        py: -50,
        pz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        vrx: 0,
        vry: 0,
        vrz: 0,
        scaleX: 0,
        scaleY: 0,
        scaleZ: 0,
        age: 0,
        maxAge: 1,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, _dummy.matrix);
      this.instancedMesh.setColorAt(i, _shardColor.setHex(0xffffff));
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
    scene.add(this.instancedMesh);

    this.puffGeo = new THREE.SphereGeometry(0.18, 10, 8);
    this.puffMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3cd,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    this.dustPuffMesh = new THREE.InstancedMesh(
      this.puffGeo,
      this.puffMat,
      MAX_DUST_PUFFS
    );
    this.dustPuffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dustPuffMesh.frustumCulled = false;

    for (let i = 0; i < MAX_DUST_PUFFS; i++) {
      this.puffs.push({
        active: false,
        px: 0,
        py: -50,
        pz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        baseScale: 0,
        age: 0,
        maxAge: 1,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.dustPuffMesh.setMatrixAt(i, _dummy.matrix);
      this.dustPuffMesh.setColorAt(i, _puffColor.setHex(0xe5e0d5));
    }
    this.dustPuffMesh.instanceMatrix.needsUpdate = true;
    if (this.dustPuffMesh.instanceColor) {
      this.dustPuffMesh.instanceColor.needsUpdate = true;
    }
    scene.add(this.dustPuffMesh);

    this.shockwaveGeo = new THREE.RingGeometry(0.28, 0.46, 32);
    this.shockwaveGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1.0,
        polygonOffsetUnits: -4.0,
      });
      const mesh = new THREE.Mesh(this.shockwaveGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.shockwaves.push({
        active: false,
        mesh,
        mat,
        age: 0,
        maxAge: 0.56,
      });
    }
  }

  public triggerLandingDust(worldPos: THREE.Vector3, pieceColor: PieceColor): void {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const idx = this.puffCursor;
      this.puffCursor = (this.puffCursor + 1) % MAX_DUST_PUFFS;
      const p = this.puffs[idx];

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 0.65 + Math.random() * 0.6;
      p.active = true;
      p.px = worldPos.x + Math.cos(angle) * 0.22;
      p.py = 0.06;
      p.pz = worldPos.z + Math.sin(angle) * 0.22;
      p.vx = Math.cos(angle) * speed;
      p.vy = 0.25 + Math.random() * 0.35;
      p.vz = Math.sin(angle) * speed;
      p.baseScale = 0.45 + Math.random() * 0.35;
      p.age = 0;
      p.maxAge = 0.55 + Math.random() * 0.25;

      _puffColor.setHex(pieceColor === 'w' ? 0xf5f0e6 : 0x94a3b8);
      this.dustPuffMesh.setColorAt(idx, _puffColor);
    }
    if (this.dustPuffMesh.instanceColor) {
      this.dustPuffMesh.instanceColor.needsUpdate = true;
    }
  }

  public triggerShatter(
    worldPos: THREE.Vector3,
    victimColor: PieceColor,
    strikeDir: THREE.Vector3,
    theme: FactionTheme = 'gothic'
  ): void {
    const shardCount = 44;
    for (let i = 0; i < shardCount; i++) {
      const idx = this.shardCursor;
      this.shardCursor = (this.shardCursor + 1) % MAX_SHARDS;
      const s = this.shards[idx];

      s.active = true;
      s.settled = false;
      const layerY = 0.12 + (i / shardCount) * 1.38;
      const cellAngle = i * 2.39996;
      const cellRadius = 0.08 + ((i % 4) / 4) * 0.22;
      const offsetX = Math.cos(cellAngle) * cellRadius;
      const offsetZ = Math.sin(cellAngle) * cellRadius;

      s.px = worldPos.x + offsetX;
      s.py = worldPos.y + layerY;
      s.pz = worldPos.z + offsetZ;

      const radialSpeed = 1.2 + Math.random() * 2.9;
      const kineticTransfer = 2.2 + Math.random() * 2.1;
      s.vx =
        Math.cos(cellAngle) * radialSpeed + strikeDir.x * kineticTransfer;
      s.vy = 1.8 + Math.random() * 3.8 + layerY * 0.85;
      s.vz =
        Math.sin(cellAngle) * radialSpeed + strikeDir.z * kineticTransfer;

      s.rx = Math.random() * Math.PI * 2;
      s.ry = Math.random() * Math.PI * 2;
      s.rz = Math.random() * Math.PI * 2;
      s.vrx = (Math.random() - 0.5) * 15;
      s.vry = (Math.random() - 0.5) * 15;
      s.vrz = (Math.random() - 0.5) * 15;

      const baseSize = 0.72 + Math.random() * 1.15;
      s.scaleX = baseSize * (0.7 + Math.random() * 0.7);
      s.scaleY = baseSize * (0.6 + Math.random() * 0.9);
      s.scaleZ = baseSize * (0.7 + Math.random() * 0.8);
      s.age = 0;
      s.maxAge = 5.5 + Math.random() * 2.5;

      if (theme === 'spartan') {
        if (i % 5 === 0) _shardColor.setHex(0x2dd4bf);
        else if (i % 4 === 0)
          _shardColor.setHex(victimColor === 'w' ? 0x991b1b : 0xb45309);
        else _shardColor.setHex(victimColor === 'w' ? 0xd89a4e : 0x4e3826);
      } else if (theme === 'roman') {
        if (i % 4 === 0) _shardColor.setHex(0xf5c542);
        else if (i % 3 === 0)
          _shardColor.setHex(victimColor === 'w' ? 0x9e1322 : 0x581c87);
        else _shardColor.setHex(victimColor === 'w' ? 0xe4e9f2 : 0x2d3340);
      } else {
        if (victimColor === 'w') {
          if (i % 5 === 0) _shardColor.setHex(0xe5be55);
          else if (i % 9 === 0) _shardColor.setHex(0x60a5fa);
          else _shardColor.setHex(0xf7f3eb);
        } else {
          if (i % 5 === 0) _shardColor.setHex(0xf43f5e);
          else if (i % 7 === 0) _shardColor.setHex(0xb46947);
          else _shardColor.setHex(0x161b2e);
        }
      }
      this.instancedMesh.setColorAt(idx, _shardColor);
    }

    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    const puffCount = 22;
    for (let i = 0; i < puffCount; i++) {
      const idx = this.puffCursor;
      this.puffCursor = (this.puffCursor + 1) % MAX_DUST_PUFFS;
      const p = this.puffs[idx];

      const angle = (i / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 1.1 + Math.random() * 2.2;
      p.active = true;
      p.px = worldPos.x + Math.cos(angle) * 0.18;
      p.py = worldPos.y + 0.1 + Math.random() * 0.7;
      p.pz = worldPos.z + Math.sin(angle) * 0.18;
      p.vx = Math.cos(angle) * speed + strikeDir.x * 1.1;
      p.vy = 0.5 + Math.random() * 1.4;
      p.vz = Math.sin(angle) * speed + strikeDir.z * 1.1;
      p.baseScale = 0.75 + Math.random() * 0.95;
      p.age = 0;
      p.maxAge = 0.75 + Math.random() * 0.55;

      if (victimColor === 'w') {
        _puffColor.setHex(i % 3 === 0 ? 0xfde68a : 0xf5f0e6);
      } else {
        _puffColor.setHex(i % 3 === 0 ? 0xfda4af : 0x64748b);
      }
      this.dustPuffMesh.setColorAt(idx, _puffColor);
    }

    if (this.dustPuffMesh.instanceColor) {
      this.dustPuffMesh.instanceColor.needsUpdate = true;
    }

    const sw = this.shockwaves[this.shockwaveCursor];
    this.shockwaveCursor = (this.shockwaveCursor + 1) % MAX_SHOCKWAVES;
    sw.active = true;
    sw.age = 0;
    sw.maxAge = 0.56;
    sw.mat.color.setHex(victimColor === 'w' ? 0x60a5fa : 0xf43f5e);
    sw.mat.opacity = 0.92;
    sw.mesh.position.set(worldPos.x, 0.032, worldPos.z);
    sw.mesh.scale.setScalar(0.35);
    sw.mesh.visible = true;
  }

  public update(dt: number): void {
    let anyShardUpdated = false;
    const gravity = -18.5;

    for (let i = 0; i < MAX_SHARDS; i++) {
      const s = this.shards[i];
      if (!s.active) continue;

      anyShardUpdated = true;
      s.age += dt;
      if (s.age >= s.maxAge) {
        s.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      if (!s.settled) {
        s.vy += gravity * dt;
        s.vx *= 1 - 0.45 * dt;
        s.vz *= 1 - 0.45 * dt;

        s.px += s.vx * dt;
        s.py += s.vy * dt;
        s.pz += s.vz * dt;

        if (s.py <= 0.044) {
          s.py = 0.044;
          if (Math.abs(s.vy) < 0.65 && Math.hypot(s.vx, s.vz) < 0.45) {
            s.settled = true;
            s.vy = 0;
            s.vx = 0;
            s.vz = 0;
            s.vrx = 0;
            s.vry = 0;
            s.vrz = 0;
          } else {
            s.vy = -s.vy * 0.38;
            s.vx *= 0.64;
            s.vz *= 0.64;
            s.vrx *= 0.56;
            s.vry *= 0.56;
            s.vrz *= 0.56;
          }
        }

        s.rx += s.vrx * dt;
        s.ry += s.vry * dt;
        s.rz += s.vrz * dt;
      }

      const lifeRatio = s.age / s.maxAge;
      const fade = lifeRatio > 0.84 ? 1 - (lifeRatio - 0.84) / 0.16 : 1.0;

      _dummy.position.set(s.px, s.py, s.pz);
      _dummy.rotation.set(s.rx, s.ry, s.rz);
      _dummy.scale.set(s.scaleX * fade, s.scaleY * fade, s.scaleZ * fade);
      _dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, _dummy.matrix);
    }

    if (anyShardUpdated) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    let anyPuffUpdated = false;
    for (let i = 0; i < MAX_DUST_PUFFS; i++) {
      const p = this.puffs[i];
      if (!p.active) continue;

      anyPuffUpdated = true;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.dustPuffMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      p.vx *= 1 - 2.8 * dt;
      p.vz *= 1 - 2.8 * dt;
      p.vy *= 1 - 1.5 * dt;

      p.px += p.vx * dt;
      p.py += p.vy * dt;
      p.pz += p.vz * dt;

      const u = p.age / p.maxAge;
      const envelope =
        u < 0.35 ? (u / 0.35) * 1.35 : 1.35 * (1 - (u - 0.35) / 0.65);
      const s = Math.max(0.001, p.baseScale * envelope);

      _dummy.position.set(p.px, p.py, p.pz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(s * 1.25, s * 0.75, s * 1.25);
      _dummy.updateMatrix();
      this.dustPuffMesh.setMatrixAt(i, _dummy.matrix);
    }

    if (anyPuffUpdated) {
      this.dustPuffMesh.instanceMatrix.needsUpdate = true;
    }

    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      sw.age += dt;
      if (sw.age >= sw.maxAge) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      const u = sw.age / sw.maxAge;
      const easeOut = 1 - Math.pow(1 - u, 3);
      sw.mesh.scale.setScalar(0.35 + easeOut * 4.2);
      sw.mat.opacity = (1 - u) * 0.9;
    }
  }

  public dispose(): void {
    this.voronoiGeo.dispose();
    this.shardMat.dispose();
    this.puffGeo.dispose();
    this.puffMat.dispose();
    this.shockwaveGeo.dispose();
    this.shockwaves.forEach((sw) => sw.mat.dispose());
  }
}
