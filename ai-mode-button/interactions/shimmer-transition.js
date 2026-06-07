const codeByTab = {
  html: `<canvas id="shimmer-canvas"></canvas>

<div class="page">
  <div class="hero">
    <h1>Shimmer Transition</h1>
    <p>WebGL iridescent sweep — no libraries.</p>
  </div>

  <button id="play-btn">Play Transition</button>
</div>

<script type="module" src="src/main.js"><\/script>`,

  mainjs: `import { createShader } from './shader.js'
import { playSweep }    from './sweep.js'
import { PALETTES }     from './palettes.js'

const canvas      = document.getElementById('shimmer-canvas')
const playBtn     = document.getElementById('play-btn')
const dotsWrap    = document.getElementById('palette-dots')
const nameDisplay = document.getElementById('palette-name-display')

const ctrl = createShader(canvas, { palette: 'prism' })

// Compute CSS gradient from palette math — matches the shader exactly
function paletteToGradient(p, steps = 7) {
  const stops = []
  for (let i = 0; i < steps; i++) {
    const t  = i / (steps - 1)
    const r  = p.a[0] + p.b[0] * Math.cos(2 * Math.PI * (p.c[0] * t + p.d[0]))
    const g  = p.a[1] + p.b[1] * Math.cos(2 * Math.PI * (p.c[1] * t + p.d[1]))
    const b  = p.a[2] + p.b[2] * Math.cos(2 * Math.PI * (p.c[2] * t + p.d[2]))
    const ri = Math.round(Math.max(0, Math.min(1, r)) * 255)
    const gi = Math.round(Math.max(0, Math.min(1, g)) * 255)
    const bi = Math.round(Math.max(0, Math.min(1, b)) * 255)
    stops.push(\`rgb(\${ri},\${gi},\${bi})\`)
  }
  return \`linear-gradient(135deg, \${stops.join(', ')})\`
}

const paletteNames  = Object.keys(PALETTES)
let selectedPalette = paletteNames[0]

// Build palette dot buttons — colours computed from actual palette math
paletteNames.forEach(name => {
  const dot = document.createElement('button')
  dot.className = 'palette-dot'
  dot.title = name
  dot.style.background = paletteToGradient(PALETTES[name])
  if (name === selectedPalette) dot.classList.add('palette-dot--active')
  dot.addEventListener('click', () => {
    document.querySelectorAll('.palette-dot')
      .forEach(d => d.classList.remove('palette-dot--active'))
    dot.classList.add('palette-dot--active')
    selectedPalette = name
    if (nameDisplay) nameDisplay.textContent = '✦ ' + name
  })
  dotsWrap?.appendChild(dot)
})

// Preview button plays the selected palette
let activeSweep = null
playBtn?.addEventListener('click', () => {
  if (!ctrl) return
  activeSweep?.cancel()
  ctrl.setPalette(selectedPalette)
  playBtn.classList.add('active')
  activeSweep = playSweep(ctrl, {
    onComplete: () => {
      playBtn.classList.remove('active')
      activeSweep = null
    },
  })
})`,

  shaderjs: `// Fragment shader — runs on the GPU for every pixel

precision mediump float;

uniform vec2  uRes;
uniform float uTime;
uniform float uProgress;
uniform float uAlpha;
uniform float uBandTight;
uniform vec3  uPalA, uPalB, uPalC, uPalD;

#define PI 3.14159265359

// Inigo Quilez cosine palette
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(2.0 * PI * (c * t + d));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;

  // 1. Band position along X
  float pos = -0.2 + uProgress * 1.4;

  // 2. Wavy edge — 3 sine harmonics superimposed
  float wave = sin(uv.y *  6.0 + uTime * 1.30) * 0.020
             + sin(uv.y * 13.0 - uTime * 0.90) * 0.012
             + sin(uv.y * 21.0 + uTime * 1.70) * 0.006;

  // 3. Gaussian band — smooth bell curve falloff
  float d    = (uv.x - pos) - wave;
  float band = exp(-d * d * uBandTight);

  // 4. Surface normal — analytic derivative of the Gaussian
  float slope = -2.0 * d * uBandTight * band;
  vec3  N     = normalize(vec3(-slope * 0.18, 0.0, 1.0));

  // 5. Iridescence — hue driven by normal tilt
  float t = N.x * 0.45 + uv.x * 1.40 + uTime * 0.04;

  // 6. Cosine palette colour
  vec3 col = pal(t, uPalA, uPalB, uPalC, uPalD);

  // 7. Fresnel rim + specular catch-light (Blinn-Phong)
  vec3  V      = vec3(0.0, 0.0, 1.0);
  vec3  L      = normalize(vec3(0.35, 0.55, 0.9));
  float NdotV  = clamp(dot(N, V), 0.0, 1.0);
  float NdotH  = clamp(dot(normalize(L + V), N), 0.0, 1.0);
  float fresnel = pow(1.0 - NdotV, 3.0);
  float spec    = pow(NdotH, 80.0);

  // 8. Composite with fades
  float bodyA = band * uAlpha;
  gl_FragColor = vec4(
    col * bodyA + (col * fresnel * 0.55 + vec3(spec) * 1.1) * bodyA,
    min(bodyA + (fresnel * 0.4 + spec * 0.9) * bodyA, 1.0)
  );
}`,
};

const codeByTabExtra = {
  sweepjs: `// sweep.js — animation orchestrator
const easeOutQuart   = p => 1 - Math.pow(1 - p, 4)
const easeInOutCubic = p => p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2,3)/2

export function playSweep(ctrl, opts = {}) {
  const sweepMs = opts.sweepMs ?? 1100
  const outroMs = opts.outroMs ?? 700
  let cancelled = false

  ;(async () => {
    ctrl.setAlpha(1); ctrl.setProgress(0)
    let midFired = false
    const t0 = performance.now()
    await new Promise(resolve => {
      const tick = () => {
        if (cancelled) { resolve(); return }
        const raw = Math.min(1, (performance.now() - t0) / sweepMs)
        const progress = easeOutQuart(raw)
        ctrl.setProgress(progress)
        if (!midFired && progress >= (opts.midpoint ?? 0.5)) {
          midFired = true; opts.onMidpoint?.()
        }
        if (raw < 1) requestAnimationFrame(tick); else resolve()
      }
      requestAnimationFrame(tick)
    })
    const t1 = performance.now()
    await new Promise(resolve => {
      const tick = () => {
        if (cancelled) { resolve(); return }
        const raw = Math.min(1, (performance.now() - t1) / outroMs)
        ctrl.setAlpha(1 - easeInOutCubic(raw))
        if (raw < 1) requestAnimationFrame(tick); else resolve()
      }
      requestAnimationFrame(tick)
    })
    opts.onComplete?.()
  })()
  return { cancel: () => { cancelled = true } }
}`,

  palettesjs: `// palettes.js — 14 cosine palette presets
// Formula by Inigo Quilez: color(t) = a + b * cos(2π(c*t+d))
// Original 6 from glimm npm package · New 8 derived from Figma swatches

export const PALETTES = {
  // ── Original 6 ──────────────────────────────────────────────────────────
  prism:   { a:[0.46,0.88,0.33], b:[0.60,0.58,0.74], c:[0.5,0.5,0.5], d:[0.54,0.22,0.84] },
  berry:   { a:[0.92,0.36,0.56], b:[0.10,0.14,0.37], c:[0.5,0.5,0.5], d:[0.84,0.11,0.50] },
  lagoon:  { a:[0.58,0.64,0.52], b:[0.64,0.30,0.50], c:[0.5,0.5,0.5], d:[0.37,0.66,0.89] },
  citrus:  { a:[0.55,0.61,0.61], b:[0.54,0.41,0.63], c:[0.5,0.5,0.5], d:[0.66,0.92,0.23] },
  azure:   { a:[0.13,0.61,1.00], b:[0.15,0.14,0.00], c:[0.5,0.5,0.5], d:[0.29,0.98,0.74] },
  ember:   { a:[0.83,0.61,0.60], b:[0.20,0.41,0.62], c:[0.5,0.5,0.5], d:[0.73,0.05,0.36] },

  // ── From Figma swatches ──────────────────────────────────────────────────
  crimson: { a:[0.50,0.05,0.05], b:[0.40,0.05,0.05], c:[0.5,0.5,0.5], d:[0.00,0.50,0.50] },
  galaxy:  { a:[0.50,0.10,0.50], b:[0.45,0.10,0.45], c:[0.5,0.5,0.5], d:[0.20,0.50,0.80] },
  steel:   { a:[0.60,0.64,0.70], b:[0.32,0.33,0.27], c:[0.5,0.5,0.5], d:[0.00,0.00,0.00] },
  fuchsia: { a:[0.58,0.05,0.48], b:[0.35,0.05,0.35], c:[0.5,0.5,0.5], d:[0.00,0.50,0.50] },
  teal:    { a:[0.22,0.42,0.38], b:[0.15,0.35,0.30], c:[0.5,0.5,0.5], d:[0.50,0.00,0.20] },
  cosmic:  { a:[0.47,0.29,0.50], b:[0.47,0.27,0.41], c:[0.5,0.5,0.5], d:[0.50,0.00,0.30] },
  sunrise: { a:[0.57,0.55,0.23], b:[0.41,0.30,0.22], c:[0.5,0.5,0.5], d:[0.00,0.00,0.50] },
  inferno: { a:[0.50,0.41,0.31], b:[0.49,0.38,0.18], c:[0.5,0.5,0.5], d:[0.00,0.00,0.00] },
}

export function resolvePalette(p) {
  if (!p) return PALETTES.prism
  if (typeof p === 'string') return PALETTES[p] ?? PALETTES.prism
  return p
}`,
};

let activeTab    = 'html';
let activeTopTab = 'explanation';

function switchTopTab(tab) {
  activeTopTab = tab;
  document.querySelectorAll('.top-tab').forEach(btn => {
    btn.classList.toggle('top-tab--active', btn.dataset.topTab === tab);
  });
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.toggle('view-panel--active', panel.dataset.viewPanel === tab);
  });
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.code-tab').forEach(btn => {
    btn.classList.toggle('code-tab--active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.code-block').forEach(block => {
    block.classList.toggle('code-block--active', block.id === `block-${tab}`);
  });
}

function copyCode() {
  const text = codeByTab[activeTab] ?? codeByTabExtra[activeTab] ?? '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.classList.add('copy-btn--copied');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M2 7L5 10L11 3" stroke="currentColor" stroke-width="1.4"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Copied!`;
    setTimeout(() => {
      btn.classList.remove('copy-btn--copied');
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="4.5" y="4.5" width="7" height="7" rx="1.5"
            stroke="currentColor" stroke-width="1.2"/>
          <path d="M3 8.5H2C1.45 8.5 1 8.05 1 7.5V2C1 1.45 1.45 1 2 1H7.5
            C8.05 1 8.5 1.45 8.5 2V3" stroke="currentColor" stroke-width="1.2"
            stroke-linecap="round"/>
        </svg>
        Copy`;
    }, 2000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  switchTopTab(activeTopTab);
});
