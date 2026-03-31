import { Game } from './game.js';

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Start the game
  const game = new Game(canvas);

  // Handle screen orientation
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {
      // Orientation lock not supported or denied
    });
  }

  // Prevent default gestures on the canvas
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

  // Fullscreen on first tap for mobile
  let fullscreenRequested = false;
  canvas.addEventListener('click', () => {
    if (!fullscreenRequested && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
      fullscreenRequested = true;
    }
  }, { once: true });
});
