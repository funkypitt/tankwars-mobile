import { WIDTH, GAME_TOP, GAME_BOTTOM, GAME_HEIGHT, TERRAIN_MIN_HEIGHT, TERRAIN_MAX_HEIGHT, TERRAIN_ROUGHNESS, COLORS } from './constants.js';

export class Terrain {
  constructor() {
    this.heightMap = new Float32Array(WIDTH);
    this.pixels = null; // ImageData for pixel-level terrain
    this.generate();
  }

  generate() {
    // Random walk terrain generation (matching original algorithm)
    let h = TERRAIN_MIN_HEIGHT + Math.random() * (TERRAIN_MAX_HEIGHT - TERRAIN_MIN_HEIGHT) * 0.5;
    const midH = (TERRAIN_MIN_HEIGHT + TERRAIN_MAX_HEIGHT) / 2;

    for (let x = 0; x < WIDTH; x++) {
      this.heightMap[x] = h;
      // Random walk with tendency toward middle
      const drift = (midH - h) * 0.005;
      h += (Math.random() - 0.5) * TERRAIN_ROUGHNESS * 2 + drift;
      h = Math.max(TERRAIN_MIN_HEIGHT, Math.min(TERRAIN_MAX_HEIGHT, h));
    }

    // Smooth the terrain a bit
    for (let pass = 0; pass < 3; pass++) {
      const smoothed = new Float32Array(WIDTH);
      for (let x = 0; x < WIDTH; x++) {
        const left = x > 0 ? this.heightMap[x - 1] : this.heightMap[x];
        const right = x < WIDTH - 1 ? this.heightMap[x + 1] : this.heightMap[x];
        smoothed[x] = (left + this.heightMap[x] * 2 + right) / 4;
      }
      this.heightMap = smoothed;
    }
  }

  // Get the Y coordinate of the ground surface at a given X
  getSurfaceY(x) {
    const ix = Math.floor(Math.max(0, Math.min(WIDTH - 1, x)));
    return GAME_BOTTOM - this.heightMap[ix];
  }

  // Check if a point is inside terrain
  isGround(x, y) {
    if (x < 0 || x >= WIDTH) return false;
    const ix = Math.floor(x);
    return y >= GAME_BOTTOM - this.heightMap[ix];
  }

  // Create a crater (destroy terrain in a circle)
  createCrater(cx, cy, radius) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(WIDTH, Math.ceil(cx + radius)); x++) {
      const dx = x - cx;
      const columnRadius = Math.sqrt(radius * radius - dx * dx);
      if (isNaN(columnRadius)) continue;

      const surfaceY = GAME_BOTTOM - this.heightMap[x];

      // Lower the terrain if the crater digs into it
      const craterTop = cy - columnRadius;
      const craterBottom = cy + columnRadius;

      if (craterBottom >= surfaceY) {
        // Crater intersects or is below surface
        if (craterTop < surfaceY) {
          // Crater cuts into the surface - lower it
          const newSurfaceY = craterBottom;
          const newHeight = GAME_BOTTOM - newSurfaceY;
          if (newHeight < this.heightMap[x]) {
            this.heightMap[x] = Math.max(0, newHeight);
          }
        }
      }
    }
  }

  // Add dirt (for dirt ball weapons)
  addDirt(cx, cy, radius) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(WIDTH, Math.ceil(cx + radius)); x++) {
      const dx = x - cx;
      const columnRadius = Math.sqrt(radius * radius - dx * dx);
      if (isNaN(columnRadius)) continue;

      const dirtTop = cy - columnRadius;
      const surfaceY = GAME_BOTTOM - this.heightMap[x];

      if (dirtTop < surfaceY) {
        // Add dirt on top
        const addedHeight = surfaceY - dirtTop;
        this.heightMap[x] += addedHeight * 0.7; // partial fill
      }
    }
  }

  // CRI chain reaction - randomly remove ground pixels
  chainReaction(cx, cy, strength, dispersive) {
    const removals = [];
    const range = dispersive ? strength * 3 : strength * 1.5;
    const density = dispersive ? 0.3 : 0.6;

    for (let i = 0; i < strength * 20; i++) {
      let rx, ry;
      if (dispersive) {
        rx = cx + (Math.random() - 0.5) * range * 2;
        ry = cy + (Math.random() - 0.5) * range;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * range;
        rx = cx + Math.cos(angle) * dist;
        ry = cy + Math.sin(angle) * dist * 0.5;
      }

      const ix = Math.floor(rx);
      if (ix >= 0 && ix < WIDTH && this.isGround(rx, ry)) {
        if (Math.random() < density) {
          // Remove a small bit of terrain
          this.heightMap[ix] = Math.max(0, this.heightMap[ix] - (1 + Math.random() * 3));
          removals.push({ x: rx, y: ry });
        }
      }
    }
    return removals;
  }

  // Crumble - make unsupported terrain fall
  crumble(percentage) {
    if (percentage <= 0) return false;
    let changed = false;
    // Simple crumble: smooth out steep drops
    for (let x = 1; x < WIDTH - 1; x++) {
      const diff = this.heightMap[x] - this.heightMap[x - 1];
      const diff2 = this.heightMap[x] - this.heightMap[x + 1];
      if (Math.abs(diff) > 5 && Math.random() * 100 < percentage) {
        const avg = (this.heightMap[x - 1] + this.heightMap[x] + this.heightMap[x + 1]) / 3;
        this.heightMap[x] = avg;
        changed = true;
      }
    }
    return changed;
  }

  // Sonic blast - aggressive crumble in area
  sonicBlast(cx, cy, radius) {
    const range = radius * 4;
    for (let x = Math.max(1, Math.floor(cx - range)); x < Math.min(WIDTH - 1, Math.ceil(cx + range)); x++) {
      for (let pass = 0; pass < 5; pass++) {
        const avg = (this.heightMap[x - 1] + this.heightMap[x] + this.heightMap[x + 1]) / 3;
        this.heightMap[x] = avg;
      }
    }
  }

  draw(ctx) {
    // Draw terrain with gradient coloring
    for (let x = 0; x < WIDTH; x++) {
      const h = this.heightMap[x];
      const surfaceY = GAME_BOTTOM - h;

      // Surface highlight
      ctx.fillStyle = COLORS.groundLight;
      ctx.fillRect(x, surfaceY, 1, 2);

      // Main terrain body
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(x, surfaceY + 2, 1, h - 4);

      // Deep ground
      ctx.fillStyle = COLORS.groundDark;
      ctx.fillRect(x, GAME_BOTTOM - 2, 1, 2);
    }
  }
}
