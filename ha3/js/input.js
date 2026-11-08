import { CONFIG } from './config.js';
import { state } from './state.js';

// Maus, Tastatur und Sichtbarkeit. Die Callbacks kommen aus engine.js,
// damit dieses Modul keinen Zyklus mit dem Render-Loop erzeugt.
export function setupInput({
  requestReset,
  clock,
  subtitleElement,
  debugElement,
  hudElement,
}) {
  window.addEventListener('pointermove', (event) => {
    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = (event.clientY / window.innerHeight) * 2 - 1;
    state.windTarget.set(
      nx * CONFIG.wind.strength,
      0,
      ny * CONFIG.wind.strength * 0.55,
    );
  });

  window.addEventListener('pointerleave', () => {
    state.windTarget.set(0, 0, 0);
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'r') {
      requestReset();
    } else if (key === 'p') {
      state.paused = !state.paused;
      if (subtitleElement) {
        subtitleElement.textContent = state.paused
          ? 'Pause — die Kerze wartet.'
          : 'Eine Kerze, die aus einem Wort besteht.';
      }
      clock.getDelta();
    } else if (key === 'd') {
      debugElement.classList.toggle('visible');
    } else if (key === 'h') {
      hudElement.classList.toggle('hidden');
    }
  });

  window.addEventListener('visibilitychange', () => {
    if (!document.hidden) clock.getDelta();
  });
}
