import * as THREE from 'three';

export interface SanctumMaterialLibrary {
  // 1. GOTHIC / CRUSADER FACTION (Default): Carved Alabaster with Extreme SSS, Obsidian, Chainmail & Woven Cloth
  marblePolished: THREE.MeshPhysicalMaterial;
  marbleCarvedMatte: THREE.MeshPhysicalMaterial;
  obsidianGlass: THREE.MeshPhysicalMaterial;
  obsidianEtchedMatte: THREE.MeshPhysicalMaterial;
  goldFiligree: THREE.MeshStandardMaterial;
  crimsonTrim: THREE.MeshStandardMaterial;
  crusaderChainmailLight: THREE.MeshPhysicalMaterial;
  crusaderChainmailDark: THREE.MeshPhysicalMaterial;
  crusaderWovenSurcoatLight: THREE.MeshPhysicalMaterial;
  crusaderWovenSurcoatDark: THREE.MeshPhysicalMaterial;

  // 2. THE SPARTANS FACTION: Oxidized Dented Bronze, Verdigris Patina & Woven Leather Pteruges
  spartanBronze: THREE.MeshPhysicalMaterial;
  spartanDarkBronze: THREE.MeshPhysicalMaterial;
  spartanWornLeather: THREE.MeshPhysicalMaterial;
  spartanCrimsonPlume: THREE.MeshStandardMaterial;
  spartanBlackPlume: THREE.MeshStandardMaterial;

  // 3. THE ROMAN EMPIRE FACTION: Polished Lorica Segmentata Steel, Imperial Marble, Galea Crests & Weathered Scutum
  romanPolishedSteel: THREE.MeshPhysicalMaterial;
  romanDarkSteel: THREE.MeshPhysicalMaterial;
  romanImperialMarble: THREE.MeshPhysicalMaterial;
  romanDarkBasalt: THREE.MeshPhysicalMaterial;
  romanImperialGold: THREE.MeshStandardMaterial;
  romanCrimsonTunic: THREE.MeshStandardMaterial;
  romanPurpleTunic: THREE.MeshStandardMaterial;

  // 4. SHARED ANATOMICAL FACE, EYES & FORGED WEAPON STEEL
  sculptedSkinLight: THREE.MeshPhysicalMaterial;
  sculptedSkinDark: THREE.MeshPhysicalMaterial;
  eyeScleraMat: THREE.MeshStandardMaterial;
  eyeIrisMat: THREE.MeshStandardMaterial;
  eyeGlowingSpartanMat: THREE.MeshStandardMaterial;
  weaponForgedSteel: THREE.MeshPhysicalMaterial;

  // 5. BOARD & CATHEDRAL ENVIRONMENT (with SSR / Planar Reflection support)
  boardLightSquare: THREE.MeshPhysicalMaterial;
  boardDarkSquare: THREE.MeshPhysicalMaterial;
  boardGrooveAO: THREE.MeshStandardMaterial;
  boardFrameStone: THREE.MeshStandardMaterial;
  boardBrassTrim: THREE.MeshStandardMaterial;
  cathedralStone: THREE.MeshStandardMaterial;
  cathedralFloor: THREE.MeshStandardMaterial;
  candleWax: THREE.MeshStandardMaterial;
  highlightLegal: THREE.MeshBasicMaterial;
  highlightCapture: THREE.MeshBasicMaterial;
  highlightSelected: THREE.MeshBasicMaterial;
  highlightLastMove: THREE.MeshBasicMaterial;
  dispose: () => void;
}

/**
 * Generates a 4K (4096x2048) High-Dynamic-Range Studio + Gothic Cathedral Equirectangular Environment Map
 * for multi-bounce global illumination reflections across polished steel, scarred bronze, marble, and obsidian.
 */
export function createCinematicHDRIEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const isHeadless =
    typeof navigator !== 'undefined' &&
    /HeadlessChrome|Playwright/i.test(navigator.userAgent);
  const width = isHeadless ? 1024 : 4096;
  const height = isHeadless ? 512 : 2048;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Base studio sky-to-ground multi-bounce gradient
  const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
  baseGrad.addColorStop(0.0, '#1e2c48'); // Deep zenith cathedral vault bounce
  baseGrad.addColorStop(0.28, '#384c6e'); // Upper clerestory studio fill
  baseGrad.addColorStop(0.48, '#645448'); // Warm horizon bounce
  baseGrad.addColorStop(0.52, '#2a221c'); // Dark stone floor horizon line
  baseGrad.addColorStop(0.78, '#1a1512'); // Warm indirect table bounce
  baseGrad.addColorStop(1.0, '#0d0b0a'); // Deep nadir shadow
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Primary Studio Key Light Softbox + Cathedral Rose Window (Warm Golden-White Sunlight)
  const keyGrad = ctx.createRadialGradient(
    width * 0.28,
    height * 0.25,
    20,
    width * 0.28,
    height * 0.25,
    width * 0.22
  );
  keyGrad.addColorStop(0.0, 'rgba(255, 252, 240, 1.0)');
  keyGrad.addColorStop(0.2, 'rgba(255, 232, 185, 0.92)');
  keyGrad.addColorStop(0.5, 'rgba(240, 180, 110, 0.45)');
  keyGrad.addColorStop(1.0, 'rgba(240, 180, 110, 0.0)');
  ctx.fillStyle = keyGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. Secondary Cool Rim Studio Softbox (Opposite azimuth for crisp silhouette speculars)
  const rimGrad = ctx.createRadialGradient(
    width * 0.78,
    height * 0.28,
    20,
    width * 0.78,
    height * 0.28,
    width * 0.2
  );
  rimGrad.addColorStop(0.0, 'rgba(220, 238, 255, 0.95)');
  rimGrad.addColorStop(0.35, 'rgba(155, 195, 245, 0.52)');
  rimGrad.addColorStop(1.0, 'rgba(130, 175, 235, 0.0)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, width, height);

  // 4. Overhead Studio Strip-Bank (for clean anisotropic highlights along helmets, spears, and crowns)
  const overheadGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.09,
    10,
    width * 0.5,
    height * 0.09,
    width * 0.32
  );
  overheadGrad.addColorStop(0.0, 'rgba(255, 248, 238, 0.88)');
  overheadGrad.addColorStop(0.45, 'rgba(215, 225, 245, 0.35)');
  overheadGrad.addColorStop(1.0, 'rgba(200, 210, 230, 0.0)');
  ctx.fillStyle = overheadGrad;
  ctx.fillRect(0, 0, width, height);

  // 5. High-contrast Lancet Window Light Strips (creates authentic specular bands on curved armor & marble)
  for (let i = 0; i < 8; i++) {
    const x = width * (0.08 + i * 0.115);
    const y = height * 0.3;
    const w = 52;
    const h = 280;
    const winGrad = ctx.createLinearGradient(x, y - h * 0.5, x, y + h * 0.5);
    if (i % 2 === 0) {
      winGrad.addColorStop(0, 'rgba(255, 238, 200, 0.82)');
      winGrad.addColorStop(0.5, 'rgba(255, 195, 125, 0.55)');
      winGrad.addColorStop(1, 'rgba(255, 160, 90, 0.0)');
    } else {
      winGrad.addColorStop(0, 'rgba(205, 228, 255, 0.78)');
      winGrad.addColorStop(0.5, 'rgba(150, 190, 245, 0.48)');
      winGrad.addColorStop(1, 'rgba(120, 160, 220, 0.0)');
    }
    ctx.fillStyle = winGrad;
    ctx.fillRect(x - w * 0.5, y - h * 0.5, w, h);
  }

  // 6. Warm Candelabra Ground-Level Bounce Pods
  for (let i = 0; i < 6; i++) {
    const cx = width * (0.12 + i * 0.16);
    const cy = height * 0.58;
    const cGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 180);
    cGrad.addColorStop(0, 'rgba(255, 185, 95, 0.5)');
    cGrad.addColorStop(1, 'rgba(255, 140, 50, 0.0)');
    ctx.fillStyle = cGrad;
    ctx.fillRect(cx - 180, cy - 180, 360, 360);
  }

  const equirectTexture = new THREE.CanvasTexture(canvas);
  equirectTexture.mapping = THREE.EquirectangularReflectionMapping;
  equirectTexture.colorSpace = THREE.SRGBColorSpace;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envMap = pmremGenerator.fromEquirectangular(equirectTexture).texture;

  equirectTexture.dispose();
  pmremGenerator.dispose();

  return envMap;
}

/**
 * Injects physically-inspired Subsurface Scattering (SSS) wrap-lighting & edge back-bleed into
 * MeshPhysicalMaterial so light physically bleeds through the edges and thin ridges of carved white marble.
 */
function injectSubsurfaceScatteringShader(
  material: THREE.MeshPhysicalMaterial,
  scatterColorHex: number,
  scatterStrength = 0.55
): void {
  const scatterColor = new THREE.Color(scatterColorHex);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSssColor = { value: scatterColor };
    shader.uniforms.uSssStrength = { value: scatterStrength };

    shader.fragmentShader =
      `
      uniform vec3 uSssColor;
      uniform float uSssStrength;
      ` +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
        // Subsurface Scattering (SSS) Edge Bleed & Wrap Translucency
        vec3 sssViewDir = normalize(vViewPosition);
        vec3 sssNormal = normalize(normal);
        float sssEdgeRim = pow(1.0 - clamp(abs(dot(sssNormal, sssViewDir)), 0.0, 1.0), 2.1);
        float sssUpwardBleed = clamp(sssNormal.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 sssContribution = uSssColor * (sssEdgeRim * 0.78 + sssUpwardBleed * 0.28) * uSssStrength;
        outgoingLight += sssContribution;
        #include <opaque_fragment>
        `
      );
  };
  material.customProgramCacheKey = () => `sss_${scatterColorHex}_${scatterStrength}`;
}

interface ProceduralPBRMaps {
  albedoMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  displacementMap: THREE.CanvasTexture;
}

/**
 * Converts a grayscale height canvas into a tangent-space normal map using a 3x3 Sobel filter.
 */
function heightCanvasToNormalTexture(
  heightCanvas: HTMLCanvasElement,
  strength = 2.8,
  repeat = 2
): THREE.CanvasTexture {
  const size = heightCanvas.width;
  const ctx = heightCanvas.getContext('2d')!;
  const src = ctx.getImageData(0, 0, size, size).data;

  const normCanvas = document.createElement('canvas');
  normCanvas.width = size;
  normCanvas.height = size;
  const nCtx = normCanvas.getContext('2d')!;
  const dstImg = nCtx.createImageData(size, size);
  const dst = dstImg.data;

  const sample = (x: number, y: number): number => {
    const wx = (x + size) % size;
    const wy = (y + size) % size;
    return src[(wy * size + wx) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  nCtx.putImageData(dstImg, 0, 0);
  const normalTex = new THREE.CanvasTexture(normCanvas);
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(repeat, repeat);
  return normalTex;
}

function configureDisplacementTexture(heightCanvas: HTMLCanvasElement, repeat = 2): THREE.CanvasTexture {
  const dispTex = new THREE.CanvasTexture(heightCanvas);
  dispTex.wrapS = THREE.RepeatWrapping;
  dispTex.wrapT = THREE.RepeatWrapping;
  dispTex.repeat.set(repeat, repeat);
  return dispTex;
}

/**
 * Generates museum-grade carved alabaster marble maps AND fingerprint/micro-fracture obsidian maps
 * with true geometric displacement maps.
 */
function createMarbleAndObsidianMaps(isLight: boolean, repeat = 2): ProceduralPBRMaps {
  const isHeadless =
    typeof navigator !== 'undefined' &&
    /HeadlessChrome|Playwright/i.test(navigator.userAgent);
  const size = isHeadless ? 128 : 512;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  aCtx.fillStyle = isLight ? '#f7f2e9' : '#080a10';
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = isLight ? '#303030' : '#181818';
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle ambient occlusion and mineral blotches
  for (let i = 0; i < 160; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 78.233) * 0.5 + 0.5) * size;
    const radius = 16 + (i % 55);

    const grad = aCtx.createRadialGradient(x, y, 2, x, y, radius);
    if (isLight) {
      grad.addColorStop(0, i % 4 === 0 ? 'rgba(218, 198, 170, 0.18)' : 'rgba(255, 252, 246, 0.2)');
      grad.addColorStop(1, 'rgba(245, 239, 230, 0)');
    } else {
      grad.addColorStop(0, i % 3 === 0 ? 'rgba(26, 34, 52, 0.25)' : 'rgba(4, 5, 9, 0.3)');
      grad.addColorStop(1, 'rgba(8, 10, 16, 0)');
    }
    aCtx.fillStyle = grad;
    aCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Carved veining + displacement relief ridges
  for (let v = 0; v < 26; v++) {
    let x = ((v * 67) % size);
    let y = 0;

    aCtx.beginPath();
    rCtx.beginPath();
    bCtx.beginPath();
    aCtx.moveTo(x, y);
    rCtx.moveTo(x, y);
    bCtx.moveTo(x, y);

    while (y < size) {
      y += 10;
      const wave = Math.sin(y * 0.032 + v * 1.7) * 14 + Math.cos(y * 0.08 - v) * 6;
      x = (x + wave * 0.25 + size) % size;
      aCtx.lineTo(x, y);
      rCtx.lineTo(x, y);
      bCtx.lineTo(x, y);
    }

    if (isLight) {
      aCtx.strokeStyle =
        v % 4 === 0 ? 'rgba(198, 160, 96, 0.26)' : 'rgba(155, 145, 135, 0.2)';
      aCtx.lineWidth = v % 3 === 0 ? 2.2 : 1.1;
      aCtx.stroke();

      rCtx.strokeStyle = 'rgba(115, 115, 115, 0.35)';
      rCtx.lineWidth = 2.4;
      rCtx.stroke();

      bCtx.strokeStyle = v % 2 === 0 ? 'rgba(220, 220, 220, 0.45)' : 'rgba(40, 40, 40, 0.42)';
      bCtx.lineWidth = 2.2;
      bCtx.stroke();
    } else {
      aCtx.strokeStyle =
        v % 5 === 0 ? 'rgba(92, 118, 175, 0.16)' : 'rgba(20, 26, 38, 0.32)';
      aCtx.lineWidth = 1.4;
      aCtx.stroke();

      rCtx.strokeStyle = 'rgba(95, 95, 95, 0.38)';
      rCtx.lineWidth = 1.6;
      rCtx.stroke();

      bCtx.strokeStyle = 'rgba(35, 35, 35, 0.5)';
      bCtx.lineWidth = 1.5;
      bCtx.stroke();
    }
  }

  if (!isLight) {
    // OBSIDIAN: Tactile Fingerprint Whorls & Conchoidal Micro-Fractures
    for (let f = 0; f < 10; f++) {
      const fx = ((f * 97 + 45) % (size - 80)) + 40;
      const fy = ((f * 131 + 50) % (size - 80)) + 40;
      const angle = (f * 0.65) % Math.PI;

      rCtx.save();
      rCtx.translate(fx, fy);
      rCtx.rotate(angle);
      for (let ring = 3; ring <= 28; ring += 3.2) {
        rCtx.beginPath();
        rCtx.ellipse(0, 0, ring * 0.72, ring, 0, 0.2, Math.PI * 1.75);
        rCtx.strokeStyle = 'rgba(128, 128, 128, 0.26)';
        rCtx.lineWidth = 1.3;
        rCtx.stroke();
      }
      rCtx.restore();
    }

    // Conchoidal volcanic glass micro-fractures (sharp displacement steps)
    for (let c = 0; c < 42; c++) {
      const cx = (c * 83) % size;
      const cy = (c * 113) % size;
      const len = 14 + (c % 22);
      const ang = (c * 2.1) % (Math.PI * 2);

      bCtx.beginPath();
      bCtx.moveTo(cx, cy);
      bCtx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      bCtx.strokeStyle = c % 2 === 0 ? 'rgba(235, 235, 235, 0.55)' : 'rgba(20, 20, 20, 0.65)';
      bCtx.lineWidth = 1.2;
      bCtx.stroke();
    }
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(repeat, repeat);
  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeat, repeat);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat, repeat);

  const normalMap = heightCanvasToNormalTexture(bumpCanvas, isLight ? 2.8 : 3.4, repeat);
  const displacementMap = configureDisplacementTexture(bumpCanvas, repeat);

  return { albedoMap, roughnessMap, bumpMap, normalMap, displacementMap };
}

/**
 * Generates Spartan Hammered & Dented Bronze with Verdigris Patina AND Deep Displacement Scars.
 */
function createSpartanBronzeMaps(isDark: boolean): ProceduralPBRMaps {
  const isHeadless =
    typeof navigator !== 'undefined' &&
    /HeadlessChrome|Playwright/i.test(navigator.userAgent);
  const size = isHeadless ? 128 : 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  aCtx.fillStyle = isDark ? '#322419' : '#c68c46';
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = isDark ? '#545454' : '#404040';
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // 1. Hammered bronze dimples & heavy combat dents on Aspis shield / Corinthian helmet
  for (let i = 0; i < 220; i++) {
    const x = ((i * 73) % size);
    const y = ((i * 137) % size);
    const rad = 10 + (i % 28);

    const bGrad = bCtx.createRadialGradient(x, y, 1, x, y, rad);
    bGrad.addColorStop(0, i % 4 === 0 ? 'rgba(15, 15, 15, 0.72)' : 'rgba(110, 110, 110, 0.35)');
    bGrad.addColorStop(0.75, 'rgba(175, 175, 175, 0.4)');
    bGrad.addColorStop(1, 'rgba(128, 128, 128, 0)');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(x - rad, y - rad, rad * 2, rad * 2);

    // Verdigris turquoise-green copper oxidation in deep crevices
    if (i % 4 === 0) {
      const vGrad = aCtx.createRadialGradient(x, y, 2, x, y, rad * 0.95);
      vGrad.addColorStop(
        0,
        isDark ? 'rgba(42, 118, 96, 0.42)' : 'rgba(56, 142, 115, 0.38)'
      );
      vGrad.addColorStop(0.6, 'rgba(38, 88, 72, 0.18)');
      vGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      aCtx.fillStyle = vGrad;
      aCtx.fillRect(x - rad, y - rad, rad * 2, rad * 2);

      rCtx.fillStyle = 'rgba(205, 205, 205, 0.5)';
      rCtx.beginPath();
      rCtx.arc(x, y, rad * 0.55, 0, Math.PI * 2);
      rCtx.fill();
    }
  }

  // 2. Deep sword-slash gouges & spear-tip dents (true geometric displacement grooves)
  for (let s = 0; s < 130; s++) {
    const x1 = ((s * 89) % size);
    const y1 = ((s * 53) % size);
    const len = 18 + (s % 48);
    const angle = (s * 1.17) % Math.PI;
    const x2 = x1 + Math.cos(angle) * len;
    const y2 = y1 + Math.sin(angle) * len;

    aCtx.beginPath();
    aCtx.moveTo(x1, y1);
    aCtx.lineTo(x2, y2);
    aCtx.strokeStyle = isDark ? 'rgba(165, 125, 78, 0.42)' : 'rgba(255, 224, 168, 0.52)';
    aCtx.lineWidth = s % 5 === 0 ? 2.6 : 1.3;
    aCtx.stroke();

    rCtx.beginPath();
    rCtx.moveTo(x1, y1);
    rCtx.lineTo(x2, y2);
    rCtx.strokeStyle = s % 5 === 0 ? 'rgba(22, 22, 22, 0.65)' : 'rgba(145, 145, 145, 0.45)';
    rCtx.lineWidth = 2.0;
    rCtx.stroke();

    bCtx.beginPath();
    bCtx.moveTo(x1, y1);
    bCtx.lineTo(x2, y2);
    bCtx.strokeStyle = 'rgba(12, 12, 12, 0.85)';
    bCtx.lineWidth = s % 5 === 0 ? 3.2 : 1.8;
    bCtx.stroke();
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(2, 2);
  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);

  const normalMap = heightCanvasToNormalTexture(bumpCanvas, 3.8, 2);
  const displacementMap = configureDisplacementTexture(bumpCanvas, 2);

  return { albedoMap, roughnessMap, bumpMap, normalMap, displacementMap };
}

/**
 * Generates authentic cross-hatched Woven Ox-Hide Leather (Pteruges) with 3D displacement weave.
 */
function createWovenLeatherMaps(): ProceduralPBRMaps {
  const isHeadless =
    typeof navigator !== 'undefined' &&
    /HeadlessChrome|Playwright/i.test(navigator.userAgent);
  const size = isHeadless ? 128 : 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  aCtx.fillStyle = '#4e2c18';
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#b4b4b4';
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, size, size);

  const step = 16;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const isOver = ((x / step + y / step) % 2) === 0;
      aCtx.fillStyle = isOver ? '#5e361e' : '#3d2111';
      aCtx.fillRect(x + 1, y + 1, step - 2, step - 2);

      bCtx.fillStyle = isOver ? '#d2d2d2' : '#424242';
      bCtx.fillRect(x + 2, y + 2, step - 4, step - 4);

      rCtx.fillStyle = isOver ? '#929292' : '#d4d4d4';
      rCtx.fillRect(x + 1, y + 1, step - 2, step - 2);
    }
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(3, 3);
  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 3);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  const normalMap = heightCanvasToNormalTexture(bumpCanvas, 3.5, 3);
  const displacementMap = configureDisplacementTexture(bumpCanvas, 3);

  return { albedoMap, roughnessMap, bumpMap, normalMap, displacementMap };
}

/**
 * Generates Roman Empire Interlocking Lorica Segmentata Polished Steel Maps with horizontal
 * plate bands, brass hinge rivets, and subtle campaign wear.
 */
function createRomanLoricaSteelMaps(isDark: boolean): ProceduralPBRMaps {
  const isHeadless =
    typeof navigator !== 'undefined' &&
    /HeadlessChrome|Playwright/i.test(navigator.userAgent);
  const size = isHeadless ? 128 : 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  aCtx.fillStyle = isDark ? '#282c34' : '#d8dde6';
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = isDark ? '#343434' : '#262626';
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Horizontal interlocking steel plate bands (Lorica Segmentata strips)
  const numBands = 8;
  const bandH = size / numBands;
  for (let b = 0; b < numBands; b++) {
    const y0 = b * bandH;
    // Overlapping steel plate bevel gradient in height map
    const plateGrad = bCtx.createLinearGradient(0, y0, 0, y0 + bandH);
    plateGrad.addColorStop(0.0, '#202020'); // Deep overlap shadow seam
    plateGrad.addColorStop(0.12, '#e8e8e8'); // Raised overlapping steel edge
    plateGrad.addColorStop(0.88, '#989898');
    plateGrad.addColorStop(1.0, '#303030');
    bCtx.fillStyle = plateGrad;
    bCtx.fillRect(0, y0, size, bandH);

    // Subtle specular/albedo variation per steel band
    aCtx.fillStyle = b % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    aCtx.fillRect(0, y0, size, bandH);

    // Brass lobate hinges & rivets along each plate
    for (let r = 0; r < 4; r++) {
      const rx = (r + 0.5) * (size / 4);
      const ry = y0 + bandH * 0.28;
      bCtx.fillStyle = '#ffffff';
      bCtx.beginPath();
      bCtx.arc(rx, ry, 5, 0, Math.PI * 2);
      bCtx.fill();

      aCtx.fillStyle = '#e5b84b';
      aCtx.beginPath();
      aCtx.arc(rx, ry, 4.5, 0, Math.PI * 2);
      aCtx.fill();
    }
  }

  // Fine steel brushing & combat scratches
  for (let s = 0; s < 85; s++) {
    const x = (s * 79) % size;
    const y = (s * 113) % size;
    const len = 14 + (s % 30);
    const ang = (s * 0.9) % Math.PI;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    rCtx.strokeStyle = 'rgba(130, 130, 130, 0.35)';
    rCtx.lineWidth = 1.2;
    rCtx.stroke();
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(2, 2);
  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);

  const normalMap = heightCanvasToNormalTexture(bumpCanvas, 3.6, 2);
  const displacementMap = configureDisplacementTexture(bumpCanvas, 2);

  return { albedoMap, roughnessMap, bumpMap, normalMap, displacementMap };
}

/**
 * Generates 5-channel PBR European 4-in-1 Interlocking Chainmail Maps (Albedo, Normal, Roughness, Metalness, AO).
 * Ring cavities have deep ambient occlusion (dark AO, zero metalness) while raised riveted steel rings gleam.
 */
function createCrusaderChainmailMaps(isDark: boolean): ProceduralPBRMaps & { aoMap: THREE.CanvasTexture; metalnessMap: THREE.CanvasTexture } {
  const isHeadless =
    typeof navigator !== 'undefined' &&
    /HeadlessChrome|Playwright/i.test(navigator.userAgent);
  const size = isHeadless ? 64 : 128;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = size;
  aoCanvas.height = size;
  const aoCtx = aoCanvas.getContext('2d')!;

  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = size;
  metalCanvas.height = size;
  const mCtx = metalCanvas.getContext('2d')!;

  // Deep shadow under-padding in ring holes
  aCtx.fillStyle = isDark ? '#0b0e14' : '#242933';
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#c8c8c8'; // Rough inside gaps
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#181818'; // Deep cavity
  bCtx.fillRect(0, 0, size, size);

  aoCtx.fillStyle = '#282828'; // Strong AO occlusion in ring holes
  aoCtx.fillRect(0, 0, size, size);

  mCtx.fillStyle = '#151515'; // Non-metallic backing cloth in holes
  mCtx.fillRect(0, 0, size, size);

  const ringRadius = size / 8;
  const stepX = ringRadius * 1.55;
  const stepY = ringRadius * 0.88;

  for (let row = -1; row <= size / stepY + 1; row++) {
    for (let col = -1; col <= size / stepX + 1; col++) {
      const cx = col * stepX + (row % 2 === 0 ? 0 : stepX * 0.5);
      const cy = row * stepY;

      aCtx.save();
      bCtx.save();
      rCtx.save();
      aoCtx.save();
      mCtx.save();

      const tilt = row % 2 === 0 ? 0.24 : -0.24;
      aCtx.translate(cx, cy);
      aCtx.rotate(tilt);
      bCtx.translate(cx, cy);
      bCtx.rotate(tilt);
      rCtx.translate(cx, cy);
      rCtx.rotate(tilt);
      aoCtx.translate(cx, cy);
      aoCtx.rotate(tilt);
      mCtx.translate(cx, cy);
      mCtx.rotate(tilt);

      const lw = Math.max(2.0, ringRadius * 0.42);

      // Albedo ring
      aCtx.beginPath();
      aCtx.ellipse(0, 0, ringRadius, ringRadius * 0.78, 0, 0, Math.PI * 2);
      aCtx.strokeStyle = isDark ? '#5c667a' : '#d6dde8';
      aCtx.lineWidth = lw;
      aCtx.stroke();

      // Height/bump ring
      bCtx.beginPath();
      bCtx.ellipse(0, 0, ringRadius, ringRadius * 0.78, 0, 0, Math.PI * 2);
      bCtx.strokeStyle = '#f2f2f2';
      bCtx.lineWidth = lw;
      bCtx.stroke();

      // Roughness ring (polished steel links = low roughness)
      rCtx.beginPath();
      rCtx.ellipse(0, 0, ringRadius, ringRadius * 0.78, 0, 0, Math.PI * 2);
      rCtx.strokeStyle = '#343434';
      rCtx.lineWidth = lw;
      rCtx.stroke();

      // AO ring (unoccluded top of steel links)
      aoCtx.beginPath();
      aoCtx.ellipse(0, 0, ringRadius, ringRadius * 0.78, 0, 0, Math.PI * 2);
      aoCtx.strokeStyle = '#ffffff';
      aoCtx.lineWidth = lw;
      aoCtx.stroke();

      // Metalness ring (100% metallic on steel links)
      mCtx.beginPath();
      mCtx.ellipse(0, 0, ringRadius, ringRadius * 0.78, 0, 0, Math.PI * 2);
      mCtx.strokeStyle = '#f8f8f8';
      mCtx.lineWidth = lw;
      mCtx.stroke();

      aCtx.restore();
      bCtx.restore();
      rCtx.restore();
      aoCtx.restore();
      mCtx.restore();
    }
  }

  const repeat = 10;
  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(repeat, repeat);
  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeat, repeat);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat, repeat);

  const aoMap = new THREE.CanvasTexture(aoCanvas);
  aoMap.wrapS = THREE.RepeatWrapping;
  aoMap.wrapT = THREE.RepeatWrapping;
  aoMap.repeat.set(repeat, repeat);

  const metalnessMap = new THREE.CanvasTexture(metalCanvas);
  metalnessMap.wrapS = THREE.RepeatWrapping;
  metalnessMap.wrapT = THREE.RepeatWrapping;
  metalnessMap.repeat.set(repeat, repeat);

  const normalMap = heightCanvasToNormalTexture(bumpCanvas, 4.2, repeat);
  const displacementMap = configureDisplacementTexture(bumpCanvas, repeat);

  return { albedoMap, roughnessMap, bumpMap, normalMap, displacementMap, aoMap, metalnessMap };
}

/**
 * Generates 5-channel PBR Woven Surcoat / Tabard Cloth Maps with authentic Herringbone/Twill
 * micro-weave AND soft vertical drapery fold Ambient Occlusion.
 */
function createWovenClothMaps(isLight: boolean): ProceduralPBRMaps & { aoMap: THREE.CanvasTexture } {
  const isHeadless =
    typeof navigator !== 'undefined' &&
    /HeadlessChrome|Playwright/i.test(navigator.userAgent);
  const size = isHeadless ? 64 : 128;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = size;
  aoCanvas.height = size;
  const aoCtx = aoCanvas.getContext('2d')!;

  aCtx.fillStyle = isLight ? '#f2ece1' : '#1b1d28';
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#c2c2c2';
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  aoCtx.fillStyle = '#e8e8e8';
  aoCtx.fillRect(0, 0, size, size);

  // 1. Vertical draped cloth folds in Height & AO maps
  const foldCount = 4;
  const foldWidth = size / foldCount;
  for (let f = 0; f < foldCount; f++) {
    const x0 = f * foldWidth;
    const foldGrad = bCtx.createLinearGradient(x0, 0, x0 + foldWidth, 0);
    foldGrad.addColorStop(0.0, 'rgba(35, 35, 35, 0.55)');
    foldGrad.addColorStop(0.5, 'rgba(235, 235, 235, 0.55)');
    foldGrad.addColorStop(1.0, 'rgba(35, 35, 35, 0.55)');
    bCtx.fillStyle = foldGrad;
    bCtx.fillRect(x0, 0, foldWidth, size);

    const aoGrad = aoCtx.createLinearGradient(x0, 0, x0 + foldWidth, 0);
    aoGrad.addColorStop(0.0, 'rgba(95, 95, 95, 0.75)');
    aoGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    aoGrad.addColorStop(1.0, 'rgba(95, 95, 95, 0.75)');
    aoCtx.fillStyle = aoGrad;
    aoCtx.fillRect(x0, 0, foldWidth, size);
  }

  // 2. High-frequency woven linen/wool twill thread grid
  const threadStep = 4;
  for (let y = 0; y < size; y += threadStep) {
    for (let x = 0; x < size; x += threadStep) {
      const warpOver = ((x / threadStep + y / threadStep) % 2) === 0;
      bCtx.fillStyle = warpOver ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';
      bCtx.fillRect(x, y, threadStep - 1, threadStep - 1);

      aCtx.fillStyle = warpOver ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
      aCtx.fillRect(x, y, threadStep - 1, threadStep - 1);
    }
  }

  const repeat = 6;
  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(repeat, repeat);
  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeat, repeat);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat, repeat);

  const aoMap = new THREE.CanvasTexture(aoCanvas);
  aoMap.wrapS = THREE.RepeatWrapping;
  aoMap.wrapT = THREE.RepeatWrapping;
  aoMap.repeat.set(repeat, repeat);

  const normalMap = heightCanvasToNormalTexture(bumpCanvas, 3.2, repeat);
  const displacementMap = configureDisplacementTexture(bumpCanvas, repeat);

  return { albedoMap, roughnessMap, bumpMap, normalMap, displacementMap, aoMap };
}

/**
 * Creates the complete Sanctum PBR Material Library with 4K HDRI reflections,
 * 5-Channel PBR Maps (Albedo, Normal, Roughness, Metalness, AO), Displacement Maps,
 * and Subsurface Scattering.
 */
export function createSanctumMaterials(): SanctumMaterialLibrary {
  const isHeadless =
    typeof navigator !== 'undefined' &&
    /HeadlessChrome|Playwright/i.test(navigator.userAgent);

  const lightMarbleMaps = createMarbleAndObsidianMaps(true, 2);
  const darkObsidianMaps = createMarbleAndObsidianMaps(false, 2);
  const boardLightMaps = createMarbleAndObsidianMaps(true, 1);
  const boardDarkMaps = createMarbleAndObsidianMaps(false, 1);

  const spartanLightBronzeMaps = createSpartanBronzeMaps(false);
  const spartanDarkBronzeMaps = createSpartanBronzeMaps(true);
  const wovenLeatherMaps = createWovenLeatherMaps();

  const romanLightSteelMaps = createRomanLoricaSteelMaps(false);
  const romanDarkSteelMaps = createRomanLoricaSteelMaps(true);

  const chainmailLightMaps = createCrusaderChainmailMaps(false);
  const chainmailDarkMaps = createCrusaderChainmailMaps(true);
  const wovenClothLightMaps = createWovenClothMaps(true);
  const wovenClothDarkMaps = createWovenClothMaps(false);

  // ============================================================================
  // 1. GOTHIC / CRUSADER FACTION: Carved Marble with SSS, Obsidian, Chainmail & Woven Cloth
  // ============================================================================
  const marblePolished = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fbf6ee'),
    map: lightMarbleMaps.albedoMap,
    roughness: 0.14,
    roughnessMap: lightMarbleMaps.roughnessMap,
    metalness: 0.02,
    normalMap: lightMarbleMaps.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    aoMap: wovenClothLightMaps.aoMap,
    aoMapIntensity: 0.35,
    displacementMap: isHeadless ? null : lightMarbleMaps.displacementMap,
    displacementScale: 0.006,
    displacementBias: -0.003,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
    transmission: isHeadless ? 0 : 0.36,
    thickness: 2.8,
    attenuationColor: new THREE.Color('#ffd4a6'),
    attenuationDistance: 0.72,
    ior: 1.54,
    reflectivity: 0.9,
    sheen: 0.52,
    sheenRoughness: 0.32,
    sheenColor: new THREE.Color('#fff2de'),
    envMapIntensity: 1.65,
  });
  injectSubsurfaceScatteringShader(marblePolished, 0xffcfa0, 0.46);

  const marbleCarvedMatte = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#efe6d8'),
    map: lightMarbleMaps.albedoMap,
    roughness: 0.32,
    roughnessMap: lightMarbleMaps.roughnessMap,
    metalness: 0.03,
    normalMap: lightMarbleMaps.normalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
    aoMap: wovenClothLightMaps.aoMap,
    aoMapIntensity: 0.45,
    displacementMap: isHeadless ? null : lightMarbleMaps.displacementMap,
    displacementScale: 0.008,
    displacementBias: -0.004,
    clearcoat: 0.38,
    clearcoatRoughness: 0.25,
    transmission: isHeadless ? 0 : 0.26,
    thickness: 2.0,
    attenuationColor: new THREE.Color('#ffcca0'),
    attenuationDistance: 0.85,
    sheen: 0.48,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color('#ffe8c8'),
    envMapIntensity: 1.35,
  });
  injectSubsurfaceScatteringShader(marbleCarvedMatte, 0xffc894, 0.38);

  const obsidianGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#101520'),
    map: darkObsidianMaps.albedoMap,
    roughness: 0.09,
    roughnessMap: darkObsidianMaps.roughnessMap,
    metalness: 0.18,
    normalMap: darkObsidianMaps.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    aoMap: wovenClothDarkMaps.aoMap,
    aoMapIntensity: 0.4,
    displacementMap: isHeadless ? null : darkObsidianMaps.displacementMap,
    displacementScale: 0.005,
    displacementBias: -0.0025,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    clearcoatNormalMap: darkObsidianMaps.normalMap,
    clearcoatNormalScale: new THREE.Vector2(0.32, 0.32),
    reflectivity: 1.0,
    ior: 1.64,
    transmission: isHeadless ? 0 : 0.2,
    thickness: 2.2,
    attenuationColor: new THREE.Color('#283c66'),
    attenuationDistance: 0.68,
    sheen: 0.38,
    sheenRoughness: 0.18,
    sheenColor: new THREE.Color('#6888c8'),
    envMapIntensity: 2.4,
  });

  const obsidianEtchedMatte = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1a2232'),
    map: darkObsidianMaps.albedoMap,
    roughness: 0.28,
    roughnessMap: darkObsidianMaps.roughnessMap,
    metalness: 0.32,
    normalMap: darkObsidianMaps.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    aoMap: wovenClothDarkMaps.aoMap,
    aoMapIntensity: 0.5,
    displacementMap: isHeadless ? null : darkObsidianMaps.displacementMap,
    displacementScale: 0.007,
    displacementBias: -0.0035,
    clearcoat: 0.68,
    clearcoatRoughness: 0.16,
    reflectivity: 0.9,
    sheen: 0.42,
    sheenRoughness: 0.28,
    sheenColor: new THREE.Color('#7a9ad8'),
    envMapIntensity: 1.95,
  });

  const goldFiligree = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e8be62'),
    roughness: 0.16,
    metalness: 0.96,
    bumpMap: lightMarbleMaps.bumpMap,
    bumpScale: 0.004,
    envMapIntensity: 2.3,
  });

  const crimsonTrim = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9c1e1e'),
    roughness: 0.4,
    metalness: 0.15,
    normalMap: wovenClothLightMaps.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    aoMap: wovenClothLightMaps.aoMap,
    aoMapIntensity: 0.5,
  });

  // Crusader Interlocking 4-in-1 Steel Chainmail (5-channel PBR)
  const crusaderChainmailLight = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d8e0ec'),
    map: chainmailLightMaps.albedoMap,
    normalMap: chainmailLightMaps.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.26,
    roughnessMap: chainmailLightMaps.roughnessMap,
    metalness: 0.92,
    metalnessMap: chainmailLightMaps.metalnessMap,
    aoMap: chainmailLightMaps.aoMap,
    aoMapIntensity: 0.85,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 2.1,
  });

  const crusaderChainmailDark = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#4a5568'),
    map: chainmailDarkMaps.albedoMap,
    normalMap: chainmailDarkMaps.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.28,
    roughnessMap: chainmailDarkMaps.roughnessMap,
    metalness: 0.9,
    metalnessMap: chainmailDarkMaps.metalnessMap,
    aoMap: chainmailDarkMaps.aoMap,
    aoMapIntensity: 0.88,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
    envMapIntensity: 2.0,
  });

  // Crusader Woven Heraldic Surcoat Cloth (with Twill Weave Normal + Drapery AO)
  const crusaderWovenSurcoatLight = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f4ede1'),
    map: wovenClothLightMaps.albedoMap,
    normalMap: wovenClothLightMaps.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.76,
    roughnessMap: wovenClothLightMaps.roughnessMap,
    metalness: 0.04,
    aoMap: wovenClothLightMaps.aoMap,
    aoMapIntensity: 0.75,
    sheen: 0.65,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#fff6e5'),
  });

  const crusaderWovenSurcoatDark = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1d2233'),
    map: wovenClothDarkMaps.albedoMap,
    normalMap: wovenClothDarkMaps.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.74,
    roughnessMap: wovenClothDarkMaps.roughnessMap,
    metalness: 0.08,
    aoMap: wovenClothDarkMaps.aoMap,
    aoMapIntensity: 0.78,
    sheen: 0.6,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#64748b'),
  });

  // ============================================================================
  // 2. THE SPARTANS FACTION: Scarred Dented Bronze, Verdigris & Woven Leather Pteruges
  // ============================================================================
  const spartanBronze = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d6984e'),
    map: spartanLightBronzeMaps.albedoMap,
    roughness: 0.24,
    roughnessMap: spartanLightBronzeMaps.roughnessMap,
    metalness: 0.91,
    normalMap: spartanLightBronzeMaps.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    aoMap: chainmailLightMaps.aoMap,
    aoMapIntensity: 0.35,
    displacementMap: isHeadless ? null : spartanLightBronzeMaps.displacementMap,
    displacementScale: 0.008,
    displacementBias: -0.004,
    clearcoat: 0.42,
    clearcoatRoughness: 0.22,
    reflectivity: 0.96,
    envMapIntensity: 2.25,
  });

  const spartanDarkBronze = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#4c3624'),
    map: spartanDarkBronzeMaps.albedoMap,
    roughness: 0.28,
    roughnessMap: spartanDarkBronzeMaps.roughnessMap,
    metalness: 0.88,
    normalMap: spartanDarkBronzeMaps.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    aoMap: chainmailDarkMaps.aoMap,
    aoMapIntensity: 0.4,
    displacementMap: isHeadless ? null : spartanDarkBronzeMaps.displacementMap,
    displacementScale: 0.008,
    displacementBias: -0.004,
    clearcoat: 0.52,
    clearcoatRoughness: 0.2,
    sheen: 0.35,
    sheenColor: new THREE.Color('#4a9c82'),
    envMapIntensity: 2.15,
  });

  const spartanWornLeather = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#5a321b'),
    map: wovenLeatherMaps.albedoMap,
    roughness: 0.68,
    roughnessMap: wovenLeatherMaps.roughnessMap,
    metalness: 0.06,
    normalMap: wovenLeatherMaps.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    aoMap: wovenClothDarkMaps.aoMap,
    aoMapIntensity: 0.6,
    displacementMap: isHeadless ? null : wovenLeatherMaps.displacementMap,
    displacementScale: 0.006,
    displacementBias: -0.003,
    sheen: 0.48,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color('#965b36'),
  });

  const spartanCrimsonPlume = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b81d1d'),
    roughness: 0.62,
    metalness: 0.05,
    normalMap: wovenClothLightMaps.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    aoMap: wovenClothLightMaps.aoMap,
    aoMapIntensity: 0.65,
  });

  const spartanBlackPlume = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1c1917'),
    roughness: 0.62,
    metalness: 0.1,
    normalMap: wovenClothDarkMaps.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    aoMap: wovenClothDarkMaps.aoMap,
    aoMapIntensity: 0.65,
  });

  // ============================================================================
  // 3. THE ROMAN EMPIRE FACTION: Polished Lorica Segmentata Steel, Gold & Crimson
  // ============================================================================
  const romanPolishedSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e4e9f2'),
    map: romanLightSteelMaps.albedoMap,
    roughness: 0.16,
    roughnessMap: romanLightSteelMaps.roughnessMap,
    metalness: 0.94,
    normalMap: romanLightSteelMaps.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    aoMap: wovenClothLightMaps.aoMap,
    aoMapIntensity: 0.45,
    displacementMap: isHeadless ? null : romanLightSteelMaps.displacementMap,
    displacementScale: 0.007,
    displacementBias: -0.0035,
    clearcoat: 0.65,
    clearcoatRoughness: 0.1,
    reflectivity: 0.98,
    envMapIntensity: 2.35,
  });

  const romanDarkSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2d3340'),
    map: romanDarkSteelMaps.albedoMap,
    roughness: 0.2,
    roughnessMap: romanDarkSteelMaps.roughnessMap,
    metalness: 0.92,
    normalMap: romanDarkSteelMaps.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    aoMap: wovenClothDarkMaps.aoMap,
    aoMapIntensity: 0.5,
    displacementMap: isHeadless ? null : romanDarkSteelMaps.displacementMap,
    displacementScale: 0.007,
    displacementBias: -0.0035,
    clearcoat: 0.72,
    clearcoatRoughness: 0.12,
    reflectivity: 0.96,
    envMapIntensity: 2.25,
  });

  const romanImperialMarble = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fffcf7'),
    map: lightMarbleMaps.albedoMap,
    roughness: 0.12,
    roughnessMap: lightMarbleMaps.roughnessMap,
    metalness: 0.04,
    normalMap: lightMarbleMaps.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    aoMap: wovenClothLightMaps.aoMap,
    aoMapIntensity: 0.45,
    clearcoat: 0.92,
    clearcoatRoughness: 0.06,
    transmission: isHeadless ? 0 : 0.24,
    thickness: 1.9,
    attenuationColor: new THREE.Color('#ffe8c8'),
    attenuationDistance: 1.1,
    reflectivity: 0.96,
    envMapIntensity: 1.75,
  });

  const romanDarkBasalt = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1c1e26'),
    map: darkObsidianMaps.albedoMap,
    roughness: 0.18,
    roughnessMap: darkObsidianMaps.roughnessMap,
    metalness: 0.28,
    normalMap: darkObsidianMaps.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    aoMap: wovenClothDarkMaps.aoMap,
    aoMapIntensity: 0.5,
    clearcoat: 0.88,
    clearcoatRoughness: 0.09,
    reflectivity: 0.95,
    envMapIntensity: 2.0,
  });

  const romanImperialGold = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffcf52'),
    roughness: 0.13,
    metalness: 0.98,
    normalMap: spartanLightBronzeMaps.normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    envMapIntensity: 2.45,
  });

  const romanCrimsonTunic = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#be1818'),
    roughness: 0.55,
    metalness: 0.06,
    normalMap: wovenClothLightMaps.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    aoMap: wovenClothLightMaps.aoMap,
    aoMapIntensity: 0.72,
  });

  const romanPurpleTunic = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4e165c'),
    roughness: 0.55,
    metalness: 0.08,
    normalMap: wovenClothDarkMaps.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    aoMap: wovenClothDarkMaps.aoMap,
    aoMapIntensity: 0.72,
  });

  // ============================================================================
  // 4. SHARED ANATOMICAL FACE, EYES & FORGED WEAPON STEEL
  // ============================================================================
  const sculptedSkinLight = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#eddcc4'),
    roughness: 0.36,
    metalness: 0.02,
    normalMap: lightMarbleMaps.normalMap,
    normalScale: new THREE.Vector2(0.2, 0.2),
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
    sheen: 0.45,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ffdfb8'),
  });
  injectSubsurfaceScatteringShader(sculptedSkinLight, 0xffaa77, 0.42);

  const sculptedSkinDark = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#483c38'),
    roughness: 0.34,
    metalness: 0.08,
    normalMap: darkObsidianMaps.normalMap,
    normalScale: new THREE.Vector2(0.22, 0.22),
    clearcoat: 0.35,
    clearcoatRoughness: 0.28,
    sheen: 0.4,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#a68b7c'),
  });

  const eyeScleraMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fcfaf5'),
    roughness: 0.1,
    metalness: 0.0,
    emissive: new THREE.Color('#e8e4dc'),
    emissiveIntensity: 0.22,
  });

  const eyeIrisMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e293b'),
    roughness: 0.08,
    metalness: 0.2,
    emissive: new THREE.Color('#38bdf8'),
    emissiveIntensity: 0.28,
  });

  const eyeGlowingSpartanMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fffbeb'),
    roughness: 0.1,
    metalness: 0.1,
    emissive: new THREE.Color('#fde047'),
    emissiveIntensity: 0.68,
  });

  const weaponForgedSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f1f5f9'),
    roughness: 0.11,
    metalness: 0.98,
    normalMap: romanLightSteelMaps.normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
    reflectivity: 1.0,
    envMapIntensity: 2.6,
  });

  // ============================================================================
  // 5. BOARD & CATHEDRAL ENVIRONMENT (Configured for Real-Time SSR / Planar Reflections)
  // ============================================================================
  const boardLightSquare = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f0e7d8'),
    map: boardLightMaps.albedoMap,
    roughness: 0.09,
    roughnessMap: boardLightMaps.roughnessMap,
    metalness: 0.05,
    normalMap: boardLightMaps.normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
    transparent: true,
    opacity: 0.84, // Allows underlying real-time planar SSR reflector to shine through
    envMapIntensity: 1.75,
  });

  const boardDarkSquare = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#10141d'),
    map: boardDarkMaps.albedoMap,
    roughness: 0.06,
    roughnessMap: boardDarkMaps.roughnessMap,
    metalness: 0.2,
    normalMap: boardDarkMaps.normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    transparent: true,
    opacity: 0.76, // Mirror-like obsidian reflection of pieces above
    envMapIntensity: 2.1,
  });

  const boardGrooveAO = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#050608'),
    roughness: 0.92,
    metalness: 0.05,
  });

  const boardFrameStone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1d1b18'),
    roughness: 0.55,
    metalness: 0.22,
    normalMap: darkObsidianMaps.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
  });

  const boardBrassTrim = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c89c48'),
    roughness: 0.22,
    metalness: 0.92,
    normalMap: lightMarbleMaps.normalMap,
    normalScale: new THREE.Vector2(0.2, 0.2),
    envMapIntensity: 1.95,
  });

  const cathedralStone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e1c1a'),
    roughness: 0.84,
    metalness: 0.08,
    normalMap: darkObsidianMaps.normalMap,
    normalScale: new THREE.Vector2(0.65, 0.65),
  });

  const cathedralFloor = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#141312'),
    roughness: 0.45,
    metalness: 0.16,
    normalMap: darkObsidianMaps.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });

  const candleWax = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f4e2c6'),
    roughness: 0.55,
    metalness: 0.0,
    emissive: new THREE.Color('#ff8c24'),
    emissiveIntensity: 0.3,
  });

  const highlightLegal = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#d4af37'),
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
  });

  const highlightCapture = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ef4444'),
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
  });

  const highlightSelected = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#fbbf24'),
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });

  const highlightLastMove = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#60a5fa'),
    transparent: true,
    opacity: 0.36,
    side: THREE.DoubleSide,
  });

  const allMaps = [
    lightMarbleMaps,
    darkObsidianMaps,
    boardLightMaps,
    boardDarkMaps,
    spartanLightBronzeMaps,
    spartanDarkBronzeMaps,
    wovenLeatherMaps,
    romanLightSteelMaps,
    romanDarkSteelMaps,
    chainmailLightMaps,
    chainmailDarkMaps,
    wovenClothLightMaps,
    wovenClothDarkMaps,
  ];

  const allMaterials: THREE.Material[] = [
    marblePolished,
    marbleCarvedMatte,
    obsidianGlass,
    obsidianEtchedMatte,
    goldFiligree,
    crimsonTrim,
    crusaderChainmailLight,
    crusaderChainmailDark,
    crusaderWovenSurcoatLight,
    crusaderWovenSurcoatDark,
    spartanBronze,
    spartanDarkBronze,
    spartanWornLeather,
    spartanCrimsonPlume,
    spartanBlackPlume,
    romanPolishedSteel,
    romanDarkSteel,
    romanImperialMarble,
    romanDarkBasalt,
    romanImperialGold,
    romanCrimsonTunic,
    romanPurpleTunic,
    sculptedSkinLight,
    sculptedSkinDark,
    eyeScleraMat,
    eyeIrisMat,
    eyeGlowingSpartanMat,
    weaponForgedSteel,
    boardLightSquare,
    boardDarkSquare,
    boardGrooveAO,
    boardFrameStone,
    boardBrassTrim,
    cathedralStone,
    cathedralFloor,
    candleWax,
    highlightLegal,
    highlightCapture,
    highlightSelected,
    highlightLastMove,
  ];

  return {
    marblePolished,
    marbleCarvedMatte,
    obsidianGlass,
    obsidianEtchedMatte,
    goldFiligree,
    crimsonTrim,
    crusaderChainmailLight,
    crusaderChainmailDark,
    crusaderWovenSurcoatLight,
    crusaderWovenSurcoatDark,
    spartanBronze,
    spartanDarkBronze,
    spartanWornLeather,
    spartanCrimsonPlume,
    spartanBlackPlume,
    romanPolishedSteel,
    romanDarkSteel,
    romanImperialMarble,
    romanDarkBasalt,
    romanImperialGold,
    romanCrimsonTunic,
    romanPurpleTunic,
    sculptedSkinLight,
    sculptedSkinDark,
    eyeScleraMat,
    eyeIrisMat,
    eyeGlowingSpartanMat,
    weaponForgedSteel,
    boardLightSquare,
    boardDarkSquare,
    boardGrooveAO,
    boardFrameStone,
    boardBrassTrim,
    cathedralStone,
    cathedralFloor,
    candleWax,
    highlightLegal,
    highlightCapture,
    highlightSelected,
    highlightLastMove,
    dispose: () => {
      allMaps.forEach((m) => {
        m.albedoMap.dispose();
        m.roughnessMap.dispose();
        m.bumpMap.dispose();
        m.normalMap.dispose();
        m.displacementMap.dispose();
        const ext = m as { aoMap?: THREE.Texture; metalnessMap?: THREE.Texture };
        ext.aoMap?.dispose();
        ext.metalnessMap?.dispose();
      });
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
