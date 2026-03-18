(() => {
  const OVERLAY_ID = 'unlockTransitionOverlay';
  const DEFAULT_DURATION_MS = 4000;
  const EXIT_DURATION_MS = 320;

  function ensureOverlay(){
    let overlay = document.getElementById(OVERLAY_ID);
    if(overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'unlock-transition';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="unlock-transition__wash unlock-transition__wash--from"></div>
      <div class="unlock-transition__wash unlock-transition__wash--to"></div>
      <div class="unlock-transition__noise"></div>
      <div class="unlock-transition__panel" role="status" aria-live="polite" aria-atomic="true">
        <div class="unlock-transition__eyebrow">Next Step Unlocked</div>
        <div class="unlock-transition__title"></div>
        <div class="unlock-transition__context"></div>
        <div class="unlock-transition__rail"><span></span></div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function wait(ms){
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  let activeRun = Promise.resolve();

  window.playUnlockTransition = function playUnlockTransition(options = {}){
    activeRun = activeRun.then(async () => {
      const overlay = ensureOverlay();
      const title = overlay.querySelector('.unlock-transition__title');
      const context = overlay.querySelector('.unlock-transition__context');
      const fromRgb = String(options.currentRgb || '122,103,201').trim();
      const toRgb = String(options.nextRgb || fromRgb).trim();
      const durationMs = Math.max(0, Number(options.durationMs) || DEFAULT_DURATION_MS);

      overlay.style.setProperty('--unlock-from-rgb', fromRgb);
      overlay.style.setProperty('--unlock-to-rgb', toRgb);
      overlay.style.setProperty('--unlock-duration', `${durationMs}ms`);
      title.textContent = String(options.message || 'Unlocked').trim();
      context.textContent = String(options.context || '').trim();

      overlay.classList.remove('is-exiting');
      overlay.classList.add('is-active');
      overlay.setAttribute('aria-hidden', 'false');

      await new Promise((resolve) => window.requestAnimationFrame(() => {
        overlay.classList.add('is-running');
        resolve();
      }));

      await wait(durationMs);

      overlay.classList.add('is-exiting');
      overlay.classList.remove('is-running');

      window.setTimeout(() => {
        overlay.classList.remove('is-active', 'is-exiting');
        overlay.setAttribute('aria-hidden', 'true');
      }, EXIT_DURATION_MS);
    });

    return activeRun;
  };
})();