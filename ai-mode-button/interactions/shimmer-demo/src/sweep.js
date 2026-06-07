/**
 * playSweep(ctrl, opts) — animation orchestrator
 *
 * Phase 1 (sweepMs):  progress 0 → 1  via easeOutQuart
 *                     fires opts.onMidpoint() when progress crosses opts.midpoint
 * Phase 2 (outroMs):  alpha 1 → 0     via easeInOutCubic
 *
 * Returns { done: Promise<void>, cancel() }
 */

// ---------------------------------------------------------------------------
// Easings (standard math — not from glimm source)
// ---------------------------------------------------------------------------
const easeOutQuart   = p => 1 - Math.pow(1 - p, 4)
const easeInOutCubic = p => p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2

// ---------------------------------------------------------------------------
// Ramp helper — animate a single value from `from` → `to` over durationMs
// ---------------------------------------------------------------------------
function ramp(durationMs, from, to, ease, setter, isCancelled) {
  return new Promise(resolve => {
    const t0 = performance.now()
    const tick = () => {
      if (isCancelled()) { resolve(); return }
      const raw    = Math.min(1, (performance.now() - t0) / durationMs)
      setter(from + (to - from) * ease(raw))
      if (raw < 1) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function playSweep(ctrl, opts = {}) {
  const sweepMs  = opts.sweepMs  ?? 1100
  const outroMs  = opts.outroMs  ?? 700
  const midpoint = opts.midpoint ?? 0.5

  let cancelled = false
  let resolveDone
  const done = new Promise(r => { resolveDone = r })

  ;(async () => {
    // Bring in the band immediately
    ctrl.setAlpha(1)
    ctrl.setProgress(0)

    // ---- Phase 1: sweep the band across ----
    let midpointFired = false
    const t0 = performance.now()

    await new Promise(resolve => {
      const tick = () => {
        if (cancelled) { resolve(); return }
        const raw      = Math.min(1, (performance.now() - t0) / sweepMs)
        const progress = easeOutQuart(raw)
        ctrl.setProgress(progress)

        // Fire midpoint callback once, exactly when the band crosses 50%
        if (!midpointFired && progress >= midpoint) {
          midpointFired = true
          Promise.resolve(opts.onMidpoint?.())
        }

        if (raw < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })

    if (cancelled) { resolveDone(); return }

    // Safety: fire midpoint if progress jumped past it without triggering
    if (!midpointFired) await Promise.resolve(opts.onMidpoint?.())

    // ---- Phase 2: fade the band out ----
    await ramp(outroMs, 1, 0, easeInOutCubic, a => ctrl.setAlpha(a), () => cancelled)

    if (cancelled) { resolveDone(); return }

    ctrl.setProgress(0)
    opts.onComplete?.()
    resolveDone()
  })()

  return {
    done,
    cancel: () => {
      cancelled = true
      resolveDone()
    },
  }
}
