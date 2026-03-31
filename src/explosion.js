import { COLORS } from './constants.js';

export class Explosion {
  constructor(x, y, radius, type = 'explosive') {
    this.x = x;
    this.y = y;
    this.maxRadius = radius;
    this.radius = 0;
    this.type = type;
    this.phase = 'growing'; // growing, shrinking, done
    this.progress = 0;
    this.particles = [];
    this.done = false;

    // Generate particles for extra flair
    const particleCount = Math.floor(radius * 1.5);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * (radius * 0.05);
      this.particles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2,
        life: 30 + Math.random() * 30,
        maxLife: 30 + Math.random() * 30,
        size: 1 + Math.random() * 2,
      });
    }
  }

  update() {
    if (this.done) return;

    this.progress += 0.04;

    if (this.phase === 'growing') {
      this.radius = this.maxRadius * Math.min(1, this.progress * 2);
      if (this.progress >= 0.5) {
        this.phase = 'shrinking';
      }
    } else if (this.phase === 'shrinking') {
      // Shrink from inside out (v3.0 behavior)
      this.radius = this.maxRadius * (1 - (this.progress - 0.5) * 2);
      if (this.progress >= 1) {
        this.phase = 'done';
        this.done = true;
      }
    }

    // Update particles
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  draw(ctx) {
    if (this.done) return;

    if (this.type === 'dirt') {
      this.drawDirt(ctx);
      return;
    }

    // Main explosion circle
    if (this.radius > 0) {
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.radius
      );

      if (this.phase === 'growing') {
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.3, '#FFFF00');
        gradient.addColorStop(0.6, '#FF8800');
        gradient.addColorStop(0.8, '#FF4400');
        gradient.addColorStop(1, 'rgba(200, 0, 0, 0)');
      } else {
        // Hollow ring (inside-out vanish)
        const inner = 1 - (this.radius / this.maxRadius);
        gradient.addColorStop(0, 'rgba(255, 100, 0, 0)');
        gradient.addColorStop(Math.max(0, inner - 0.1), 'rgba(255, 100, 0, 0)');
        gradient.addColorStop(inner, '#FF4400');
        gradient.addColorStop(Math.min(1, inner + 0.3), '#FF8800');
        gradient.addColorStop(1, 'rgba(200, 0, 0, 0)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.maxRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      const colorIdx = Math.floor((1 - alpha) * (COLORS.explosion.length - 1));
      ctx.fillStyle = COLORS.explosion[colorIdx] || '#FF4400';
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawDirt(ctx) {
    // Brown dirt explosion
    if (this.radius > 0) {
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.radius
      );
      gradient.addColorStop(0, '#A67C1A');
      gradient.addColorStop(0.7, '#8B6914');
      gradient.addColorStop(1, 'rgba(139, 105, 20, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = '#8B6914';
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

export class CRIEffect {
  constructor(x, y, removals) {
    this.x = x;
    this.y = y;
    this.removals = removals; // [{x, y}, ...]
    this.progress = 0;
    this.done = false;
  }

  update() {
    this.progress += 0.02;
    if (this.progress >= 1) {
      this.done = true;
    }
  }

  draw(ctx) {
    const count = Math.floor(this.removals.length * this.progress);
    ctx.fillStyle = '#00FFAA';
    for (let i = 0; i < count; i++) {
      const r = this.removals[i];
      const alpha = 1 - (this.progress - (i / this.removals.length));
      if (alpha > 0) {
        ctx.globalAlpha = Math.min(1, alpha * 2);
        ctx.fillRect(r.x - 1, r.y - 1, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
}
