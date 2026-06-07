import { resolvePalette } from './palettes.js'

// ---------------------------------------------------------------------------
// Vertex shader — fullscreen quad (two triangles)
// ---------------------------------------------------------------------------
const VS = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`

// ---------------------------------------------------------------------------
// Fragment shader — all the magic lives here
// ---------------------------------------------------------------------------
const FS = `
precision mediump float;

uniform vec2  uRes;       // canvas size in physical pixels
uniform float uTime;      // elapsed seconds
uniform float uProgress;  // band travel 0→1
uniform float uAlpha;     // overall opacity (used for outro fade)
uniform float uBandTight; // Gaussian tightness — higher = narrower band
uniform float uPosStart;  // band start position (-0.2 = just off left edge)
uniform float uPosEnd;    // band end   position ( 1.2 = just off right edge)
uniform float uHueShift;  // per-instance random hue offset
uniform vec3  uPalA;      // cosine palette coefficients
uniform vec3  uPalB;
uniform vec3  uPalC;
uniform vec3  uPalD;

#define PI 3.14159265359

// Inigo Quilez cosine palette — public domain
// See: https://iquilezles.org/articles/palettes/
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(2.0 * PI * (c * t + d));
}

void main() {
  // Normalised UV — (0,0) bottom-left, (1,1) top-right
  vec2 uv = gl_FragCoord.xy / uRes;

  // ------------------------------------------------------------------
  // 1. Band position along the X axis
  // ------------------------------------------------------------------
  float pos = uPosStart + uProgress * (uPosEnd - uPosStart);

  // ------------------------------------------------------------------
  // 2. Organic wavy edge — three sine harmonics superimposed.
  //    Different frequencies + time speeds make the edge feel alive
  //    rather than mechanically periodic.
  // ------------------------------------------------------------------
  float wave = sin(uv.y *  6.0 + uTime * 1.30) * 0.020
             + sin(uv.y * 13.0 - uTime * 0.90) * 0.012
             + sin(uv.y * 21.0 + uTime * 1.70) * 0.006;

  // ------------------------------------------------------------------
  // 3. Gaussian band — signed distance from centre → smooth bell curve.
  //    exp(-d² * k) gives a band centred at pos=0 that peaks at 1.0
  //    and falls off symmetrically.
  // ------------------------------------------------------------------
  float d    = (uv.x - pos) - wave;
  float band = exp(-d * d * uBandTight);

  // ------------------------------------------------------------------
  // 4. Synthesized surface normal — analytic derivative of the Gaussian.
  //    dband/dx = -2d·k·band  (chain rule on exp(-d²·k))
  //    Treating the band value as a height map, this gives us a normal
  //    that points "outward" on the leading face and "inward" on the
  //    trailing face — just like a physical hill.
  //    The 0.18 gain controls perceived steepness (higher = more tilt).
  // ------------------------------------------------------------------
  float slope = -2.0 * d * uBandTight * band;
  vec3  N     = normalize(vec3(-slope * 0.18, 0.0, 1.0));

  // ------------------------------------------------------------------
  // 5. Iridescence — hue parameter driven by normal tilt.
  //    As the crest rises (band approaching), N.x rotates → t changes
  //    → cosine palette shifts hue → reads as foil/holographic shimmer.
  //    The spatial + time terms add a slow rainbow drift across the band.
  // ------------------------------------------------------------------
  float t = N.x * 0.45 + N.y * 0.30   // normal-driven iridescence
          + uv.x * 1.40 + uv.y * 0.35  // spatial hue sweep
          + uHueShift                   // random per-play offset
          + uTime * 0.04;               // slow time drift

  // ------------------------------------------------------------------
  // 6. Cosine palette colour — Inigo Quilez formula
  // ------------------------------------------------------------------
  vec3 col = pal(t, uPalA, uPalB, uPalC, uPalD);

  // ------------------------------------------------------------------
  // 7. Blinn-Phong lighting — gives the band a physical "foil" quality.
  //    Fixed light + camera looking straight down +Z.
  //    Fresnel: bright rim at grazing angles (band edges).
  //    Specular: tight catch-light on the crest.
  //    Both are emissive (additive), not occluding.
  // ------------------------------------------------------------------
  vec3  V      = vec3(0.0, 0.0, 1.0);
  vec3  L      = normalize(vec3(0.35, 0.55, 0.9));
  vec3  H      = normalize(L + V);
  float NdotV  = clamp(dot(N, V), 0.0, 1.0);
  float NdotH  = clamp(dot(N, H), 0.0, 1.0);
  float fresnel = pow(1.0 - NdotV, 3.0);
  float spec    = pow(NdotH, 80.0);

  // ------------------------------------------------------------------
  // 8. Trailing wake — a dim glow that lingers just behind the crest.
  //    Prevents the band from having a hard cutoff on its trailing edge.
  // ------------------------------------------------------------------
  float trail    = pow(clamp(0.5 - d * 1.3, 0.0, 1.0), 2.5) * 0.30;
  float intensity = max(band * 0.95, trail);

  // ------------------------------------------------------------------
  // 9. Entry / exit fade — band ramps from 20% → 100% → 20% opacity
  //    as progress goes 0→0.5→1.  Prevents a hard pop-in at the edges.
  // ------------------------------------------------------------------
  float entryFade = mix(0.2, 1.0, 4.0 * uProgress * (1.0 - uProgress));

  // ------------------------------------------------------------------
  // 10. Viewport edge taper — 1.5% soft fade at top/bottom edges so
  //     the band dissolves cleanly rather than clipping at the border.
  // ------------------------------------------------------------------
  float vfade = smoothstep(0.0, 0.015, uv.y) * smoothstep(1.0, 0.985, uv.y);

  // ------------------------------------------------------------------
  // 11. Premultiplied alpha composite.
  //     Body: palette colour weighted by intensity + fades.
  //     Highlights: additive emissive — they ADD brightness, not opacity.
  //     blendFunc(ONE, ONE_MINUS_SRC_ALPHA) on the JS side handles this.
  // ------------------------------------------------------------------
  float highMask = band * vfade * uAlpha * entryFade;
  float bodyA    = intensity * vfade * uAlpha * entryFade;
  vec3  bodyPM   = col * bodyA;
  vec3  highEmit = (col * fresnel * 0.55 + vec3(spec) * 1.1) * highMask;
  float highA    = (fresnel * 0.4 + spec * 0.9) * highMask;

  gl_FragColor = vec4(bodyPM + highEmit, min(bodyA + highA, 1.0));
}
`

// ---------------------------------------------------------------------------
// createShader(canvas, opts) → controller
// ---------------------------------------------------------------------------
export function createShader(canvas, opts = {}) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  })
  if (!gl) {
    console.warn('[shimmer] WebGL unavailable')
    return null
  }

  // --- compile helpers ---
  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('[shimmer] shader compile error:', gl.getShaderInfoLog(s))
    return s
  }

  const vs = compile(gl.VERTEX_SHADER, VS)
  const fs = compile(gl.FRAGMENT_SHADER, FS)
  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  gl.useProgram(prog)

  // --- fullscreen quad geometry ---
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
  const aLoc = gl.getAttribLocation(prog, 'a')
  gl.enableVertexAttribArray(aLoc)
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0)

  // --- uniform locations ---
  const u = n => gl.getUniformLocation(prog, n)
  const uRes       = u('uRes')
  const uTime      = u('uTime')
  const uProgress  = u('uProgress')
  const uAlpha     = u('uAlpha')
  const uBandTight = u('uBandTight')
  const uPosStart  = u('uPosStart')
  const uPosEnd    = u('uPosEnd')
  const uHueShift  = u('uHueShift')
  const uPalA      = u('uPalA')
  const uPalB      = u('uPalB')
  const uPalC      = u('uPalC')
  const uPalD      = u('uPalD')

  // --- blending: premultiplied alpha ---
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  // --- mutable state ---
  const pal = resolvePalette(opts.palette)
  const state = {
    progress:  0,
    alpha:     0,
    palette:   pal,
    bandTight: opts.bandTight ?? 14,
  }
  // Random hue offset so every sweep looks slightly different
  const hueShift = Math.random() * 0.4

  // --- DPR-aware resize ---
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const r   = canvas.getBoundingClientRect()
    const w   = Math.max(1, Math.round(r.width  * dpr))
    const h   = Math.max(1, Math.round(r.height * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // --- render loop ---
  const start = performance.now()
  let raf = 0

  const tick = () => {
    const t = (performance.now() - start) / 1000

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.uniform2f(uRes,      canvas.width, canvas.height)
    gl.uniform1f(uTime,     t)
    gl.uniform1f(uProgress, state.progress)
    gl.uniform1f(uAlpha,    state.alpha)
    gl.uniform1f(uBandTight,state.bandTight)
    gl.uniform1f(uPosStart, -0.2)
    gl.uniform1f(uPosEnd,    1.2)
    gl.uniform1f(uHueShift, hueShift)
    gl.uniform3f(uPalA, state.palette.a[0], state.palette.a[1], state.palette.a[2])
    gl.uniform3f(uPalB, state.palette.b[0], state.palette.b[1], state.palette.b[2])
    gl.uniform3f(uPalC, state.palette.c[0], state.palette.c[1], state.palette.c[2])
    gl.uniform3f(uPalD, state.palette.d[0], state.palette.d[1], state.palette.d[2])

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  // --- public API ---
  return {
    setProgress: p => { state.progress = p },
    setAlpha:    a => { state.alpha    = a },
    setPalette:  p => { state.palette  = resolvePalette(p) },
    getProgress: ()  => state.progress,
    getAlpha:    ()  => state.alpha,
    destroy: () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    },
  }
}
