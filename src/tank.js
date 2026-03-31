import { TANK_WIDTH, TANK_HEIGHT, TANK_BARREL_LENGTH, STARTING_MEN, MAX_POWER, WEAPONS, DEFENSES, GAME_BOTTOM } from './constants.js';

export class Tank {
  constructor(playerIndex, name, color) {
    this.playerIndex = playerIndex;
    this.name = name;
    this.color = color;
    this.x = 0;
    this.y = 0;
    this.angle = playerIndex === 0 ? 60 : 120; // degrees, 0=right, 180=left
    this.power = 300;
    this.men = STARTING_MEN;
    this.alive = true;
    this.money = 200;
    this.score = 0;
    this.wins = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.deaths = 0;

    // Weapons inventory: { weaponId: count }
    this.weapons = {};
    this.currentWeaponIndex = 2; // Start on Incinerator

    // Defenses: { defenseId: boolean }
    this.defenses = {};

    // Guidance
    this.guidanceH = false;
    this.guidanceV = false;
    this.guidanceTarget = null;

    // Animation state
    this.falling = false;
    this.fallVelocity = 0;
    this.deathTimer = 0;
    this.deathType = null;

    this.initWeapons();
  }

  initWeapons() {
    // Set starting weapons
    for (const w of WEAPONS) {
      this.weapons[w.id] = w.startAmount;
    }
  }

  resetForNewGame() {
    this.men = STARTING_MEN;
    this.alive = true;
    this.falling = false;
    this.fallVelocity = 0;
    this.deathTimer = 0;
    this.deathType = null;
    this.guidanceH = false;
    this.guidanceV = false;
    this.guidanceTarget = null;
    // Refill per-game weapons
    for (const w of WEAPONS) {
      if (w.perGame) {
        this.weapons[w.id] = Math.max(this.weapons[w.id] || 0, w.startAmount);
      }
    }
  }

  get maxPower() {
    return Math.min(MAX_POWER, this.men * 10);
  }

  get currentWeapon() {
    return WEAPONS[this.currentWeaponIndex];
  }

  // Get list of weapons that the player owns (count > 0)
  get availableWeapons() {
    return WEAPONS.map((w, i) => ({ weapon: w, index: i, count: this.weapons[w.id] || 0 }))
      .filter(w => w.count > 0);
  }

  selectNextWeapon() {
    const avail = this.availableWeapons;
    if (avail.length === 0) return;
    const currentAvailIdx = avail.findIndex(w => w.index === this.currentWeaponIndex);
    const nextIdx = (currentAvailIdx + 1) % avail.length;
    this.currentWeaponIndex = avail[nextIdx].index;
  }

  selectPrevWeapon() {
    const avail = this.availableWeapons;
    if (avail.length === 0) return;
    const currentAvailIdx = avail.findIndex(w => w.index === this.currentWeaponIndex);
    const prevIdx = (currentAvailIdx - 1 + avail.length) % avail.length;
    this.currentWeaponIndex = avail[prevIdx].index;
  }

  canFire() {
    if (!this.alive) return false;
    const w = this.currentWeapon;
    const count = this.weapons[w.id] || 0;
    if (w.type === 'laser') {
      return count >= 100;
    }
    return count > 0;
  }

  consumeAmmo() {
    const w = this.currentWeapon;
    if (w.type === 'laser') {
      const used = Math.min(this.power, this.weapons[w.id]);
      this.weapons[w.id] -= used;
      return used;
    }
    this.weapons[w.id]--;
    this.shots++;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    // Shield absorption
    if (this.defenses.shield) {
      const shield = DEFENSES.find(d => d.id === 'shield');
      amount = Math.floor(amount * (1 - shield.absorption));
      // Shield may break on big hits
      if (amount > 30) {
        this.defenses.shield = false;
      }
    }
    this.men -= amount;
    if (this.men <= 0) {
      this.men = 0;
      this.alive = false;
      this.deathType = amount >= 80 ? 'nuke' : amount >= 40 ? 'fade' : 'dirt';
      this.deathTimer = 60; // frames
    }
  }

  takeFallDamage(fallDistance) {
    if (this.defenses.fall_protect) return;
    const damage = Math.floor(fallDistance * 0.3);
    if (damage > 0) {
      this.takeDamage(damage);
    }
  }

  // Place tank on terrain
  placeOnTerrain(x, terrain) {
    this.x = x;
    this.y = terrain.getSurfaceY(x);
    this.alive = true;
  }

  // Update falling
  updateFalling(terrain) {
    if (!this.alive) return false;
    const surfaceY = terrain.getSurfaceY(this.x);
    if (this.y < surfaceY - 1) {
      this.falling = true;
      this.fallVelocity += 0.3;
      this.y += this.fallVelocity;
      if (this.y >= surfaceY) {
        const fallDist = this.fallVelocity * 5;
        this.y = surfaceY;
        this.takeFallDamage(fallDist);
        this.falling = false;
        this.fallVelocity = 0;
      }
      return true;
    }
    this.y = surfaceY; // snap to surface
    this.falling = false;
    return false;
  }

  // Get barrel tip position
  getBarrelTip() {
    const rad = (this.angle * Math.PI) / 180;
    return {
      x: this.x + Math.cos(rad) * TANK_BARREL_LENGTH,
      y: this.y - TANK_HEIGHT / 2 - Math.sin(rad) * TANK_BARREL_LENGTH,
    };
  }

  draw(ctx, isActive) {
    if (!this.alive && this.deathTimer <= 0) return;

    const alpha = this.deathTimer > 0 && this.deathType === 'fade'
      ? this.deathTimer / 60 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Tank body
    ctx.fillStyle = this.color;
    ctx.fillRect(
      this.x - TANK_WIDTH / 2,
      this.y - TANK_HEIGHT,
      TANK_WIDTH,
      TANK_HEIGHT
    );

    // Treads
    ctx.fillStyle = '#333';
    ctx.fillRect(
      this.x - TANK_WIDTH / 2 - 1,
      this.y - 3,
      TANK_WIDTH + 2,
      3
    );

    // Turret dome
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y - TANK_HEIGHT, TANK_WIDTH / 4, Math.PI, 0);
    ctx.fill();

    // Barrel
    const rad = (this.angle * Math.PI) / 180;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - TANK_HEIGHT);
    ctx.lineTo(
      this.x + Math.cos(rad) * TANK_BARREL_LENGTH,
      this.y - TANK_HEIGHT - Math.sin(rad) * TANK_BARREL_LENGTH
    );
    ctx.stroke();

    // Active indicator (arrow above tank)
    if (isActive && this.alive) {
      ctx.fillStyle = '#FFFFFF';
      const arrowY = this.y - TANK_HEIGHT - TANK_BARREL_LENGTH - 15;
      ctx.beginPath();
      ctx.moveTo(this.x, arrowY + 10);
      ctx.lineTo(this.x - 5, arrowY);
      ctx.lineTo(this.x + 5, arrowY);
      ctx.fill();
    }

    // Health bar
    if (this.alive) {
      const barWidth = TANK_WIDTH + 4;
      const barHeight = 3;
      const barY = this.y - TANK_HEIGHT - TANK_BARREL_LENGTH - 5;
      ctx.fillStyle = '#333';
      ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);
      const healthPct = this.men / STARTING_MEN;
      ctx.fillStyle = healthPct > 0.5 ? '#44FF44' : healthPct > 0.25 ? '#FFAA00' : '#FF4444';
      ctx.fillRect(this.x - barWidth / 2, barY, barWidth * healthPct, barHeight);
    }

    ctx.restore();

    // Death animation
    if (this.deathTimer > 0 && !this.alive) {
      if (this.deathType === 'nuke') {
        const radius = (60 - this.deathTimer) * 1.5;
        ctx.fillStyle = `rgba(255, 255, 0, ${this.deathTimer / 60 * 0.5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y - TANK_HEIGHT / 2, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
