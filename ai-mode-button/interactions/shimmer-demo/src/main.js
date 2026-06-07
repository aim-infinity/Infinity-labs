import { createShader } from './shader.js'
import { playSweep }    from './sweep.js'
import { PALETTES }     from './palettes.js'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const canvas      = document.getElementById('shimmer-canvas')
const playBtn     = document.getElementById('play-btn')
const dotsWrap    = document.getElementById('palette-dots')
const nameDisplay = document.getElementById('palette-name-display')

const ctrl = createShader(canvas, { palette: 'prism' })

if (!ctrl) {
  if (playBtn) { playBtn.textContent = 'WebGL not available'; playBtn.disabled = true }
}

// ---------------------------------------------------------------------------
// Compute a CSS gradient from cosine palette params — matches the shader exactly
// ---------------------------------------------------------------------------
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
    stops.push(`rgb(${ri},${gi},${bi})`)
  }
  return `linear-gradient(135deg, ${stops.join(', ')})`
}

// ---------------------------------------------------------------------------
// Build palette dot buttons — colours derived from the actual palette math
// ---------------------------------------------------------------------------
const paletteNames  = Object.keys(PALETTES)
let selectedPalette = paletteNames[0]

paletteNames.forEach(name => {
  const palette = PALETTES[name]
  const dot = document.createElement('button')
  dot.className     = 'palette-dot'
  dot.dataset.palette = name
  dot.title         = name
  dot.style.background = paletteToGradient(palette)

  if (name === selectedPalette) dot.classList.add('palette-dot--active')

  dot.addEventListener('click', () => {
    document.querySelectorAll('.palette-dot').forEach(d => d.classList.remove('palette-dot--active'))
    dot.classList.add('palette-dot--active')
    selectedPalette = name
    if (nameDisplay) nameDisplay.textContent = '✦ ' + name
  })

  dotsWrap?.appendChild(dot)
})

// ---------------------------------------------------------------------------
// Preview button — plays the currently selected palette
// ---------------------------------------------------------------------------
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
})
