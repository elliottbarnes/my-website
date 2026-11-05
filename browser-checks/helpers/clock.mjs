// Keep every scheduled callback, while avoiding long native nested-timer
// chains inside Playwright's runFor driver. Unlike fastForward, this never
// coalesces interval/animation callbacks or changes simulated elapsed time.
export async function runCallbacks(page, milliseconds) {
  for (let remaining = milliseconds; remaining > 0;) {
    const step = Math.min(96, remaining);
    await page.clock.runFor(step);
    remaining -= step;
  }
}
