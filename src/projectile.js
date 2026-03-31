import { GRAVITY, WIND_FACTOR, WIDTH, GAME_TOP, GAME_BOTTOM, WALL_TYPES } from './constants.js';

export class Projectile {
  constructor(x, y, vx, vy, weapon, owner) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.weapon = weapon;
    this.owner = owner;
    this.active = true;
    this.trail = [];
    this.age = 0;
    this.peakReached = false;
    this.prevVy = vy;
    this.isSub = false; // true for MIRV sub-projectiles
  }

  update(wind, wallType, terrain, tanks) {
    if (!this.active) return null;

    this.age++;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 100) this.trail.shift();

    // Apply physics
    this.prevVy = this.vy;
    this.vy += GRAVITY;
    this.vx += wind * WIND_FACTOR;

    this.x += this.vx;
    this.y += this.vy;

    // MIRV split: when projectile reaches peak of arc
    if (this.weapon.type === 'mirv' && !this.isSub && !this.peakReached && this.vy > 0 && this.prevVy <= 0) {
      this.peakReached = true;
      this.active = false;
      return { type: 'mirv_split', x: this.x, y: this.y, vx: this.vx, vy: this.vy };
    }

    // Wall collisions
    const result = this.handleWalls(wallType);
    if (result) return result;

    // Check out of bounds (top is ok for going up, but too far off = done)
    if (this.y > GAME_BOTTOM + 50) {
      this.active = false;
      return { type: 'miss' };
    }

    // Check terrain collision
    if (this.y >= GAME_TOP && terrain.isGround(this.x, this.y)) {
      this.active = false;
      return { type: 'hit_terrain', x: this.x, y: this.y };
    }

    // Check tank collision
    for (const tank of tanks) {
      if (!tank.alive) continue;
      if (tank === this.owner && this.age < 10) continue; // don't self-hit immediately
      const dx = this.x - tank.x;
      const dy = this.y - (tank.y - 6); // center of tank
      if (Math.abs(dx) < 14 && Math.abs(dy) < 10) {
        this.active = false;
        return { type: 'hit_tank', x: this.x, y: this.y, tank };
      }
    }

    // Repulser check
    for (const tank of tanks) {
      if (!tank.alive || tank === this.owner || !tank.defenses.repulser) continue;
      const dx = this.x - tank.x;
      const dy = this.y - (tank.y - 6);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 60 && dist > 10) {
        // Deflect
        const force = 0.5 / (dist * 0.05);
        this.vx += (dx / dist) * force;
        this.vy += (dy / dist) * force;
        // Repulser may break
        if (Math.random() < 0.02) {
          tank.defenses.repulser = false;
        }
      }
    }

    return null;
  }

  handleWalls(wallType) {
    const actualWall = wallType === WALL_TYPES.RANDOM
      ? Math.floor(Math.random() * 5) : wallType;

    switch (actualWall) {
      case WALL_TYPES.NONE:
        // Off left/right: if wind won't bring it back, abort
        if (this.x < -100 || this.x > WIDTH + 100) {
          this.active = false;
          return { type: 'miss' };
        }
        break;

      case WALL_TYPES.STICKY:
        if (this.x < 0 || this.x > WIDTH) {
          this.vx = -this.vx * 0.5;
          this.vy *= 0.5;
          this.x = this.x < 0 ? 1 : WIDTH - 1;
        }
        if (this.y < GAME_TOP) {
          this.vy = -this.vy * 0.5;
          this.vx *= 0.5;
          this.y = GAME_TOP + 1;
        }
        break;

      case WALL_TYPES.ELASTIC:
        if (this.x < 0 || this.x > WIDTH) {
          this.vx = -this.vx;
          this.x = this.x < 0 ? 1 : WIDTH - 1;
        }
        if (this.y < GAME_TOP) {
          this.vy = -this.vy;
          this.y = GAME_TOP + 1;
        }
        break;

      case WALL_TYPES.ACCELERATING:
        if (this.x < 0 || this.x > WIDTH) {
          this.vx = -this.vx * 1.3;
          this.x = this.x < 0 ? 1 : WIDTH - 1;
          // Check for air friction detonation
          if (Math.abs(this.vx) > 30 || Math.abs(this.vy) > 30) {
            this.active = false;
            return { type: 'hit_terrain', x: this.x, y: this.y };
          }
        }
        if (this.y < GAME_TOP) {
          this.vy = -this.vy * 1.3;
          this.y = GAME_TOP + 1;
        }
        break;

      case WALL_TYPES.WARPING:
        if (this.x < 0) this.x = WIDTH - 1;
        else if (this.x > WIDTH) this.x = 1;
        // Top/bottom = non-existent
        if (this.y < GAME_TOP - 200) {
          this.active = false;
          return { type: 'miss' };
        }
        break;
    }

    return null;
  }

  draw(ctx) {
    if (!this.active) return;

    // Trail
    ctx.strokeStyle = `${this.weapon.color}66`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      if (i === 0) ctx.moveTo(t.x, t.y);
      else ctx.lineTo(t.x, t.y);
    }
    ctx.stroke();

    // Projectile
    const size = this.weapon.projectileSize;
    ctx.fillStyle = this.weapon.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.fillStyle = `${this.weapon.color}44`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class LaserBeam {
  constructor(x, y, angle, energy, weapon, owner) {
    this.startX = x;
    this.startY = y;
    this.angle = angle;
    this.energy = energy;
    this.weapon = weapon;
    this.owner = owner;
    this.active = true;
    this.points = [];
    this.hitResult = null;
    this.calculated = false;
  }

  calculate(terrain, tanks, wallType) {
    if (this.calculated) return;
    this.calculated = true;

    const rad = (this.angle * Math.PI) / 180;
    let x = this.startX;
    let y = this.startY;
    let dx = Math.cos(rad) * 3;
    let dy = -Math.sin(rad) * 3;
    let remaining = this.energy;

    this.points = [{ x, y }];

    while (remaining > 0 && this.points.length < 2000) {
      x += dx;
      y += dy;
      remaining -= 1;

      this.points.push({ x, y });

      // Wall bouncing
      if (x < 0 || x > WIDTH) {
        if (wallType >= WALL_TYPES.STICKY && wallType <= WALL_TYPES.ACCELERATING) {
          dx = -dx;
          x = x < 0 ? 1 : WIDTH - 1;
        } else if (wallType === WALL_TYPES.WARPING) {
          x = x < 0 ? WIDTH - 1 : 1;
        } else {
          break;
        }
      }
      if (y < GAME_TOP) {
        if (wallType >= WALL_TYPES.STICKY && wallType <= WALL_TYPES.ACCELERATING) {
          dy = -dy;
          y = GAME_TOP + 1;
        } else {
          break;
        }
      }

      // Terrain hit
      if (terrain.isGround(x, y)) {
        this.hitResult = { type: 'hit_terrain', x, y };
        break;
      }

      // Tank hit
      for (const tank of tanks) {
        if (!tank.alive || tank === this.owner) continue;
        const tdx = x - tank.x;
        const tdy = y - (tank.y - 6);
        if (Math.abs(tdx) < 14 && Math.abs(tdy) < 10) {
          this.hitResult = { type: 'hit_tank', x, y, tank };
          remaining = 0;
          break;
        }
      }
      if (remaining <= 0) break;
    }

    if (!this.hitResult) {
      this.hitResult = { type: 'miss' };
    }
  }

  draw(ctx, progress) {
    // Draw laser as a bright line
    const pointsToShow = Math.floor(this.points.length * progress);
    if (pointsToShow < 2) return;

    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FF00';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < pointsToShow; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bright core
    ctx.strokeStyle = '#AAFFAA';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < pointsToShow; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
  }
}
