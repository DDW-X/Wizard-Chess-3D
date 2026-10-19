import type { AttackAudioCueType, FactionTheme } from '../game/physicsKinematics';

export interface Vec3Position {
  x: number;
  y: number;
  z: number;
}

/**
 * AAA Procedural Spatial Audio Engine built on the Web Audio API.
 * Features:
 * - HRTF 3D Spatial PannerNodes positioned at exact chessboard world coordinates
 * - Procedural Gothic Cathedral Convolution Reverb (3.2s stereo impulse response)
 * - Continuous ambient background audio (distant cathedral wind & cavernous echoes)
 * - Frame-accurate piece-specific combat SFX (Pawn spear whoosh/thud, Knight horse neigh/crush,
 *   Bishop ethereal hum/boom, Rook boulder crash, Queen metallic blade slashes, King execution gong)
 * - Multi-fragment Voronoi crumbling debris settling audio
 */
class SpatialSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSendGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted = false;
  private ambientRunning = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.85;
      this.masterGain.connect(this.ctx.destination);

      // Position listener at default camera vantage
      this.updateListenerPosition({ x: 0, y: 7.5, z: 9.2 }, { x: 0, y: 0.4, z: 0 });

      // Generate shared 3-second white/pink noise buffer
      this.noiseBuffer = this.createNoiseBuffer(this.ctx, 3.0);

      // Generate procedural Gothic Cathedral stereo impulse response
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.createCathedralImpulseResponse(this.ctx, 2.8, 3.2);
      this.reverbSendGain = this.ctx.createGain();
      this.reverbSendGain.gain.value = 0.38;
      this.reverbNode.connect(this.reverbSendGain);
      this.reverbSendGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createCathedralImpulseResponse(
    ctx: AudioContext,
    durationSec: number,
    decayRate: number
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        // Early cathedral stone wall reflections + exponential diffuse tail
        const earlyEcho =
          i % Math.floor(sampleRate * 0.047) < 12 ? 0.45 * Math.exp(-t * 2.0) : 0;
        const envelope = Math.pow(1 - i / length, decayRate);
        channelData[i] = ((Math.random() * 2 - 1) * envelope + earlyEcho) * 0.5;
      }
    }
    return impulse;
  }

  private createSpatialPanner(ctx: AudioContext, pos: Vec3Position, reverbAmount = 0.42): PannerNode {
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 3.5;
    panner.maxDistance = 35;
    panner.rolloffFactor = 0.85;
    panner.positionX.value = pos.x;
    panner.positionY.value = pos.y;
    panner.positionZ.value = pos.z;

    if (this.masterGain) {
      panner.connect(this.masterGain);
    }
    if (this.reverbNode && reverbAmount > 0) {
      const send = ctx.createGain();
      send.gain.value = reverbAmount;
      panner.connect(send);
      send.connect(this.reverbNode);
    }
    return panner;
  }

  public updateListenerPosition(cameraPos: Vec3Position, targetPos: Vec3Position): void {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const dx = targetPos.x - cameraPos.x;
    const dy = targetPos.y - cameraPos.y;
    const dz = targetPos.z - cameraPos.z;
    const len = Math.hypot(dx, dy, dz) || 1;

    if (listener.positionX) {
      listener.positionX.value = cameraPos.x;
      listener.positionY.value = cameraPos.y;
      listener.positionZ.value = cameraPos.z;
      listener.forwardX.value = dx / len;
      listener.forwardY.value = dy / len;
      listener.forwardZ.value = dz / len;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.04);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Starts continuous ambient Gothic cathedral soundscape:
   * - Distant whistling wind through high lancet arches
   * - Deep cavernous sanctum air resonance
   */
  public startAmbientSoundscape(): void {
    if (this.ambientRunning) return;
    this.ambientRunning = true;
    try {
      const ctx = this.ensureContext();
      if (!ctx || !this.noiseBuffer || !this.masterGain) {
        this.ambientRunning = false;
        return;
      }

      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.value = 0.085;
      this.ambientGain.connect(this.masterGain);

    // 1. Distant cathedral wind (looping noise through LFO-swept bandpass filter)
    const windSource = ctx.createBufferSource();
    windSource.buffer = this.noiseBuffer;
    windSource.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 260;
    windFilter.Q.value = 4.2;

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.14; // 7-second wind gust cycle
    const windLfoDepth = ctx.createGain();
    windLfoDepth.gain.value = 135;
    windLfo.connect(windLfoDepth);
    windLfoDepth.connect(windFilter.frequency);

    windSource.connect(windFilter);
    windFilter.connect(this.ambientGain);
    windSource.start();
    windLfo.start();

    // 2. Subtle cavernous sanctum sub-drone (55Hz A1 + 82.4Hz E2 fifth)
    const droneOsc1 = ctx.createOscillator();
    const droneOsc2 = ctx.createOscillator();
    droneOsc1.type = 'sine';
    droneOsc2.type = 'triangle';
    droneOsc1.frequency.value = 55.0;
    droneOsc2.frequency.value = 82.41;

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 140;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.18;

    droneOsc1.connect(droneFilter);
    droneOsc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.ambientGain);
    droneOsc1.start();
    droneOsc2.start();
    } catch {
      this.ambientRunning = false;
    }
  }

  /**
   * Triggers piece-specific spatial attack SFX at the exact 3D board coordinates.
   */
  public triggerAttackCue(
    cue: AttackAudioCueType,
    attackerPos: Vec3Position,
    defenderPos: Vec3Position
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    switch (cue) {
      case 'pawn_whoosh': {
        // Aerodynamic spear/pilum hurl "whoosh" panning from attacker to target
        const panner = this.createSpatialPanner(ctx, attackerPos, 0.35);
        panner.positionX.linearRampToValueAtTime(defenderPos.x, now + 0.32);
        panner.positionY.linearRampToValueAtTime(defenderPos.y + 0.9, now + 0.16);
        panner.positionZ.linearRampToValueAtTime(defenderPos.z, now + 0.32);

        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 3.2;
        filter.frequency.setValueAtTime(420, now);
        filter.frequency.exponentialRampToValueAtTime(1450, now + 0.14);
        filter.frequency.exponentialRampToValueAtTime(340, now + 0.32);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.55, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.34);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        noise.start(now);
        noise.stop(now + 0.35);
        break;
      }

      case 'pawn_pierce_thud': {
        // Sharp piercing "thud" as spear/pilum impales target
        const panner = this.createSpatialPanner(ctx, defenderPos, 0.45);

        // 1. Sub-bass body impact thud
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(165, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);

        const thudGain = ctx.createGain();
        thudGain.gain.setValueAtTime(0.75, now);
        thudGain.gain.exponentialRampToValueAtTime(0.005, now + 0.26);

        osc.connect(thudGain);
        thudGain.connect(panner);
        osc.start(now);
        osc.stop(now + 0.27);

        // 2. Sharp metallic/stone puncture transient
        const click = ctx.createOscillator();
        click.type = 'sawtooth';
        click.frequency.setValueAtTime(1920, now);
        click.frequency.exponentialRampToValueAtTime(280, now + 0.065);

        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.45, now);
        clickGain.gain.exponentialRampToValueAtTime(0.005, now + 0.075);

        click.connect(clickGain);
        clickGain.connect(panner);
        click.start(now);
        click.stop(now + 0.08);
        break;
      }

      case 'knight_neigh': {
        // Synthesized warhorse "neigh / whinny" with equine vocal formant glissando & vibrato
        const panner = this.createSpatialPanner(ctx, attackerPos, 0.55);

        const carrier = ctx.createOscillator();
        carrier.type = 'sawtooth';
        carrier.frequency.setValueAtTime(460, now);
        carrier.frequency.exponentialRampToValueAtTime(980, now + 0.16);
        carrier.frequency.exponentialRampToValueAtTime(740, now + 0.36);
        carrier.frequency.exponentialRampToValueAtTime(490, now + 0.58);

        // Equine flutter vibrato (26 Hz)
        const vibrato = ctx.createOscillator();
        vibrato.type = 'sine';
        vibrato.frequency.value = 26;
        const vibGain = ctx.createGain();
        vibGain.gain.value = 48;
        vibrato.connect(vibGain);
        vibGain.connect(carrier.frequency);

        // Dual vocal tract formant filters
        const formant1 = ctx.createBiquadFilter();
        formant1.type = 'bandpass';
        formant1.frequency.value = 1150;
        formant1.Q.value = 4.5;

        const formant2 = ctx.createBiquadFilter();
        formant2.type = 'bandpass';
        formant2.frequency.value = 2450;
        formant2.Q.value = 5.0;

        const neighGain = ctx.createGain();
        neighGain.gain.setValueAtTime(0.01, now);
        neighGain.gain.linearRampToValueAtTime(0.42, now + 0.08);
        neighGain.gain.setValueAtTime(0.38, now + 0.32);
        neighGain.gain.exponentialRampToValueAtTime(0.005, now + 0.62);

        carrier.connect(formant1);
        carrier.connect(formant2);
        formant1.connect(neighGain);
        formant2.connect(neighGain);
        neighGain.connect(panner);

        carrier.start(now);
        vibrato.start(now);
        carrier.stop(now + 0.64);
        vibrato.stop(now + 0.64);
        break;
      }

      case 'knight_trample_crush': {
        // Heavy, crushing stone/bone trampling hooves
        const panner = this.createSpatialPanner(ctx, defenderPos, 0.5);

        for (let stompIdx = 0; stompIdx < 2; stompIdx++) {
          const t0 = now + stompIdx * 0.11;
          const sub = ctx.createOscillator();
          sub.type = 'sine';
          sub.frequency.setValueAtTime(135, t0);
          sub.frequency.exponentialRampToValueAtTime(32, t0 + 0.28);

          const subGain = ctx.createGain();
          subGain.gain.setValueAtTime(0.75, t0);
          subGain.gain.exponentialRampToValueAtTime(0.005, t0 + 0.3);

          sub.connect(subGain);
          subGain.connect(panner);
          sub.start(t0);
          sub.stop(t0 + 0.32);

          // Crushing bone/stone high-energy burst
          const crushNoise = ctx.createBufferSource();
          crushNoise.buffer = this.noiseBuffer;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 1350 - stompIdx * 300;
          bp.Q.value = 1.8;

          const nGain = ctx.createGain();
          nGain.gain.setValueAtTime(0.55, t0);
          nGain.gain.exponentialRampToValueAtTime(0.005, t0 + 0.19);

          crushNoise.connect(bp);
          bp.connect(nGain);
          nGain.connect(panner);
          crushNoise.start(t0);
          crushNoise.stop(t0 + 0.21);
        }
        break;
      }

      case 'bishop_hum_charge': {
        // Ethereal, low-frequency magical hum building up to divine impact
        const panner = this.createSpatialPanner(ctx, attackerPos, 0.68);
        const freqs = [110, 164.81, 220, 329.63];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(f, now);
          osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.48);

          const g = ctx.createGain();
          g.gain.setValueAtTime(0.005, now);
          g.gain.linearRampToValueAtTime(0.18 / (idx + 1), now + 0.38);
          g.gain.exponentialRampToValueAtTime(0.004, now + 0.56);

          osc.connect(g);
          g.connect(panner);
          osc.start(now);
          osc.stop(now + 0.58);
        });
        break;
      }

      case 'bishop_divine_boom': {
        // Explosive divine/arcane "boom" from above
        const panner = this.createSpatialPanner(ctx, defenderPos, 0.72);

        const boomOsc = ctx.createOscillator();
        boomOsc.type = 'sine';
        boomOsc.frequency.setValueAtTime(180, now);
        boomOsc.frequency.exponentialRampToValueAtTime(28, now + 0.55);

        const boomGain = ctx.createGain();
        boomGain.gain.setValueAtTime(0.88, now);
        boomGain.gain.exponentialRampToValueAtTime(0.005, now + 0.62);

        boomOsc.connect(boomGain);
        boomGain.connect(panner);
        boomOsc.start(now);
        boomOsc.stop(now + 0.65);

        // Shimmering harmonic explosion burst
        const bellOsc = ctx.createOscillator();
        bellOsc.type = 'triangle';
        bellOsc.frequency.setValueAtTime(528, now);
        bellOsc.frequency.exponentialRampToValueAtTime(264, now + 0.45);

        const bellGain = ctx.createGain();
        bellGain.gain.setValueAtTime(0.35, now);
        bellGain.gain.exponentialRampToValueAtTime(0.005, now + 0.5);

        bellOsc.connect(bellGain);
        bellGain.connect(panner);
        bellOsc.start(now);
        bellOsc.stop(now + 0.52);
        break;
      }

      case 'rook_sprint_tremor': {
        // Heavy earth-shaking sprint stride tremor
        const panner = this.createSpatialPanner(ctx, attackerPos, 0.4);
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(88, now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);

        osc.connect(gain);
        gain.connect(panner);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }

      case 'rook_boulder_crash': {
        // Deep, bass-heavy metallic/stone crash (like a boulder hitting a wall)
        const panner = this.createSpatialPanner(ctx, defenderPos, 0.65);

        // 1. Massive seismic boulder sub-wave
        const boulderOsc = ctx.createOscillator();
        boulderOsc.type = 'sine';
        boulderOsc.frequency.setValueAtTime(120, now);
        boulderOsc.frequency.exponentialRampToValueAtTime(24, now + 0.65);

        const boulderGain = ctx.createGain();
        boulderGain.gain.setValueAtTime(0.95, now);
        boulderGain.gain.exponentialRampToValueAtTime(0.005, now + 0.7);

        boulderOsc.connect(boulderGain);
        boulderGain.connect(panner);
        boulderOsc.start(now);
        boulderOsc.stop(now + 0.72);

        // 2. Heavy bronze/stone wall impact roar
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(920, now);
        lp.frequency.exponentialRampToValueAtTime(140, now + 0.55);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.8, now);
        nGain.gain.exponentialRampToValueAtTime(0.005, now + 0.58);

        noise.connect(lp);
        lp.connect(nGain);
        nGain.connect(panner);
        noise.start(now);
        noise.stop(now + 0.6);
        break;
      }

      case 'queen_teleport_dash': {
        // Lightning-fast phase dash whoosh
        const panner = this.createSpatialPanner(ctx, attackerPos, 0.45);
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(1680, now + 0.14);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.32, now);
        g.gain.exponentialRampToValueAtTime(0.005, now + 0.16);

        osc.connect(g);
        g.connect(panner);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }

      case 'queen_blade_slash': {
        // Sharp, high-pitched metallic "swooshes" and lethal blade clashes
        const panner = this.createSpatialPanner(ctx, defenderPos, 0.5);

        // High-Q metallic steel ring partials
        const steelFreqs = [1940, 2860, 4120];
        steelFreqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq + Math.random() * 120, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.86, now + 0.18);

          const g = ctx.createGain();
          g.gain.setValueAtTime(0.22 / (i + 1), now);
          g.gain.exponentialRampToValueAtTime(0.003, now + 0.2);

          osc.connect(g);
          g.connect(panner);
          osc.start(now);
          osc.stop(now + 0.21);
        });

        // Razor air-slice swoosh
        const sliceNoise = ctx.createBufferSource();
        sliceNoise.buffer = this.noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.setValueAtTime(2600, now);
        hp.frequency.exponentialRampToValueAtTime(900, now + 0.12);
        hp.Q.value = 3.5;

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.45, now);
        nGain.gain.exponentialRampToValueAtTime(0.005, now + 0.14);

        sliceNoise.connect(hp);
        hp.connect(nGain);
        nGain.connect(panner);
        sliceNoise.start(now);
        sliceNoise.stop(now + 0.15);
        break;
      }

      case 'king_sovereign_windup': {
        // Slow, majestic metallic draw & ominous low brass tension
        const panner = this.createSpatialPanner(ctx, attackerPos, 0.6);
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(82.4, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.35);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 360;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.01, now);
        g.gain.linearRampToValueAtTime(0.32, now + 0.28);
        g.gain.exponentialRampToValueAtTime(0.005, now + 0.42);

        osc.connect(filter);
        filter.connect(g);
        g.connect(panner);
        osc.start(now);
        osc.stop(now + 0.44);
        break;
      }

      case 'king_execution_gong': {
        // Slow, resonant, cinematic metallic gong + heavy execution impact
        const panner = this.createSpatialPanner(ctx, defenderPos, 0.82);

        // 1. Inharmonic cinematic bronze gong partials with long resonant tail
        const gongPartials = [138, 219, 346, 518, 764, 1120];
        gongPartials.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = idx < 2 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.975, now + 1.8);

          const g = ctx.createGain();
          const peak = 0.42 / Math.pow(idx + 1, 0.75);
          g.gain.setValueAtTime(peak, now);
          g.gain.exponentialRampToValueAtTime(0.002, now + 1.85 - idx * 0.15);

          osc.connect(g);
          g.connect(panner);
          osc.start(now);
          osc.stop(now + 1.9);
        });

        // 2. Heavy execution cleave sub-impact
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(26, now + 0.55);

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.9, now);
        subGain.gain.exponentialRampToValueAtTime(0.005, now + 0.6);

        sub.connect(subGain);
        subGain.connect(panner);
        sub.start(now);
        sub.stop(now + 0.62);
        break;
      }

      case 'voronoi_crumble_debris': {
        // Universal "crumbling debris" sound when pieces shatter and Voronoi fragments bounce on the board
        const panner = this.createSpatialPanner(ctx, defenderPos, 0.48);

        for (let i = 0; i < 16; i++) {
          const delay = 0.02 + i * 0.055 + Math.random() * 0.035;
          const tHit = now + delay;
          const energy = Math.pow(1 - i / 16, 1.5);

          // Individual stone/marble/bronze shard clatter
          const shardOsc = ctx.createOscillator();
          shardOsc.type = 'triangle';
          const basePitch = 520 + ((i * 233) % 1150);
          shardOsc.frequency.setValueAtTime(basePitch, tHit);
          shardOsc.frequency.exponentialRampToValueAtTime(basePitch * 0.45, tHit + 0.055);

          const shardGain = ctx.createGain();
          shardGain.gain.setValueAtTime(0.24 * energy, tHit);
          shardGain.gain.exponentialRampToValueAtTime(0.002, tHit + 0.06);

          shardOsc.connect(shardGain);
          shardGain.connect(panner);
          shardOsc.start(tHit);
          shardOsc.stop(tHit + 0.065);
        }
        break;
      }
    }
  }

  /**
   * Subtle stone/marble placement clack when a non-capture move lands on the board.
   */
  public playMoveSettle(pos: Vec3Position): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(ctx, pos, 0.3);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.09);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.004, now + 0.1);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * Ethereal crystalline resonance when swapping Faction Themes in the UI.
   */
  public playFactionMorph(theme: FactionTheme): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const panner = this.createSpatialPanner(ctx, { x: 0, y: 1.2, z: 0 }, 0.65);

    const chord =
      theme === 'spartan'
        ? [146.83, 220.0, 293.66] // D power chord (Bronze & War)
        : theme === 'roman'
          ? [196.0, 293.66, 392.0] // G Imperial fanfare fifth
          : [164.81, 246.94, 329.63]; // E Gothic Cathedral fifth

    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.02, now + 0.55);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.005, now);
      g.gain.linearRampToValueAtTime(0.16 / (idx + 1), now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.003, now + 0.62);

      osc.connect(g);
      g.connect(panner);
      osc.start(now);
      osc.stop(now + 0.65);
    });
  }
}

export const spatialSoundEngine = new SpatialSoundEngine();
