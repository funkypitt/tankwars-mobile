import {
  WIDTH, HEIGHT, HUD_HEIGHT, CONTROLS_HEIGHT, GAME_TOP, GAME_BOTTOM,
  GRAVITY, WIND_FACTOR, MAX_POWER, WEAPONS, DEFENSES,
  COLORS, WALL_TYPES, WALL_NAMES, WIND_LEVELS, WIND_LEVEL_NAMES,
  STATES, STARTING_MEN,
} from './constants.js';
import { Terrain } from './terrain.js';
import { Tank } from './tank.js';
import { Projectile, LaserBeam } from './projectile.js';
import { Explosion, CRIEffect } from './explosion.js';
import * as sfx from './audio.js';
import { FirebaseMultiplayer } from './firebase.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;

    this.state = STATES.TITLE;
    this.terrain = null;
    this.tanks = [];
    this.projectiles = [];
    this.explosions = [];
    this.criEffects = [];
    this.laserBeam = null;

    this.currentPlayerIndex = 0;
    this.wind = 0;
    this.roundNumber = 0;
    this.totalRounds = 10;
    this.crumblePercent = 50;
    this.wallType = WALL_TYPES.RANDOM;
    this.currentWallType = WALL_TYPES.NONE; // actual wall for current round
    this.windLevel = WIND_LEVELS.NORMAL;
    this.soundEnabled = true;

    // Animation timers
    this.stateTimer = 0;
    this.messageText = '';
    this.messageTimer = 0;

    // Shop state
    this.shopCart = {};
    this.shopSelectedIndex = 0;
    this.shopScrollOffset = 0;

    // Firing state
    this.aimTrajectory = [];

    // Title animation
    this.titleTimer = 0;

    // Touch state
    this.touchState = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      startAngle: 0,
      startPower: 0,
    };

    // Online mode
    this.isOnline = false;
    this.firebase = new FirebaseMultiplayer(this);
    this.roomCode = null;
    this.playerId = null;
    this.waitingForOpponent = false;
    this.onlineInputMode = null; // 'create', 'join', 'auto'
    this.roomCodeInput = '';

    this.setupInput();
    this.lastTime = performance.now();
    this.loop();
  }

  // ========== INPUT ==========

  setupInput() {
    // Unified pointer events
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    // Keyboard (for desktop testing)
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  canvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (WIDTH / rect.width),
      y: (e.clientY - rect.top) * (HEIGHT / rect.height),
    };
  }

  onPointerDown(e) {
    e.preventDefault();
    sfx.initAudio();
    const pos = this.canvasCoords(e);

    if (this.state === STATES.TITLE) {
      this.startMenu();
      return;
    }

    if (this.state === STATES.MENU) {
      this.handleMenuClick(pos);
      return;
    }

    if (this.state === 'online_join') {
      this.handleJoinScreenClick(pos);
      return;
    }

    if (this.state === 'online_waiting') {
      // Tap to cancel
      if (pos.y > HEIGHT - 80) {
        this.firebase.cleanup();
        this.state = STATES.MENU;
        sfx.sfxClick();
      }
      return;
    }

    if (this.state === STATES.SHOP) {
      this.handleShopClick(pos);
      return;
    }

    if (this.state === STATES.ROUND_END || this.state === STATES.GAME_OVER) {
      this.handleEndScreenClick(pos);
      return;
    }

    if (this.state === STATES.AIMING) {
      this.handleAimingClick(pos);
    }
  }

  onPointerMove(e) {
    e.preventDefault();
    const pos = this.canvasCoords(e);

    if (this.state === STATES.AIMING && this.touchState.active) {
      this.handleAimingDrag(pos);
    }
  }

  onPointerUp(e) {
    e.preventDefault();
    this.touchState.active = false;
  }

  onKeyDown(e) {
    if (this.state === STATES.TITLE) {
      this.startMenu();
      return;
    }

    if (this.state === 'online_join') {
      if (e.key === 'Backspace') {
        this.roomCodeInput = this.roomCodeInput.slice(0, -1);
      } else if (e.key === 'Enter' && this.roomCodeInput.length === 4) {
        this.joinRoomByCode();
      } else if (e.key.length === 1 && this.roomCodeInput.length < 4) {
        this.roomCodeInput += e.key.toUpperCase();
      }
      return;
    }

    if (this.state === STATES.AIMING) {
      const tank = this.currentTank;
      if (!tank) return;
      switch (e.key) {
        case 'ArrowLeft': tank.angle = Math.min(180, tank.angle + 2); break;
        case 'ArrowRight': tank.angle = Math.max(0, tank.angle - 2); break;
        case 'ArrowUp': tank.power = Math.min(tank.maxPower, tank.power + 10); break;
        case 'ArrowDown': tank.power = Math.max(0, tank.power - 10); break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) tank.selectPrevWeapon();
          else tank.selectNextWeapon();
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          this.fire();
          break;
      }
    }

    if (this.state === STATES.ROUND_END || this.state === STATES.GAME_OVER) {
      if (e.key === ' ' || e.key === 'Enter') {
        this.handleEndScreenClick({ x: WIDTH / 2, y: HEIGHT / 2 });
      }
    }
  }

  // ========== MENU ==========

  startMenu() {
    this.state = STATES.MENU;
    sfx.sfxClick();
  }

  handleMenuClick(pos) {
    const centerX = WIDTH / 2;

    // Start Local Game button
    if (pos.y > 320 && pos.y < 370 && pos.x > centerX - 150 && pos.x < centerX + 150) {
      sfx.sfxClick();
      this.isOnline = false;
      this.startNewGame();
      return;
    }

    // Online: Auto Match
    if (pos.y > 385 && pos.y < 425 && pos.x > centerX - 150 && pos.x < centerX + 150) {
      sfx.sfxClick();
      this.connectOnline('auto');
      return;
    }

    // Online: Create Room
    if (pos.y > 435 && pos.y < 470 && pos.x > centerX - 150 && pos.x < centerX) {
      sfx.sfxClick();
      this.connectOnline('create');
      return;
    }

    // Online: Join Room
    if (pos.y > 435 && pos.y < 470 && pos.x >= centerX && pos.x < centerX + 150) {
      sfx.sfxClick();
      this.connectOnline('join');
      return;
    }

    // Settings rows (rounds, crumble, walls, wind)
    const settingsStartY = 150;
    const rowHeight = 35;

    // Rounds
    if (pos.y > settingsStartY && pos.y < settingsStartY + rowHeight) {
      if (pos.x > centerX) this.totalRounds = Math.min(99, this.totalRounds + 1);
      else if (pos.x > centerX - 100) this.totalRounds = Math.max(1, this.totalRounds - 1);
      sfx.sfxClick();
    }
    // Crumble
    if (pos.y > settingsStartY + rowHeight && pos.y < settingsStartY + rowHeight * 2) {
      if (pos.x > centerX) this.crumblePercent = Math.min(100, this.crumblePercent + 10);
      else if (pos.x > centerX - 100) this.crumblePercent = Math.max(0, this.crumblePercent - 10);
      sfx.sfxClick();
    }
    // Walls
    if (pos.y > settingsStartY + rowHeight * 2 && pos.y < settingsStartY + rowHeight * 3) {
      if (pos.x > centerX) this.wallType = (this.wallType + 1) % 6;
      else if (pos.x > centerX - 100) this.wallType = (this.wallType + 5) % 6;
      sfx.sfxClick();
    }
    // Wind
    if (pos.y > settingsStartY + rowHeight * 3 && pos.y < settingsStartY + rowHeight * 4) {
      if (pos.x > centerX) this.windLevel = (this.windLevel + 1) % 6;
      else if (pos.x > centerX - 100) this.windLevel = (this.windLevel + 5) % 6;
      sfx.sfxClick();
    }
  }

  // ========== GAME START ==========

  startNewGame() {
    this.tanks = [
      new Tank(0, 'Player 1', COLORS.player1),
      new Tank(1, 'Player 2', COLORS.player2),
    ];
    this.roundNumber = 0;
    this.startNextRound();
  }

  startNextRound() {
    this.roundNumber++;
    this.terrain = new Terrain();
    this.projectiles = [];
    this.explosions = [];
    this.criEffects = [];
    this.laserBeam = null;

    // Generate wind
    this.wind = this.generateWind();

    // Resolve wall type for this round
    this.currentWallType = this.wallType === WALL_TYPES.RANDOM
      ? Math.floor(Math.random() * 5) : this.wallType;

    // Place tanks
    const margin = 100;
    const spacing = (WIDTH - margin * 2) / (this.tanks.length + 1);
    for (let i = 0; i < this.tanks.length; i++) {
      const x = margin + spacing * (i + 1) + (Math.random() - 0.5) * spacing * 0.4;
      this.tanks[i].resetForNewGame();
      this.tanks[i].placeOnTerrain(x, this.terrain);
    }

    // Random first player
    this.currentPlayerIndex = Math.random() < 0.5 ? 0 : 1;
    this.state = STATES.AIMING;
    this.showMessage(`Round ${this.roundNumber}`, 90);

    if (this.isOnline && this.currentPlayerIndex !== this.playerId) {
      this.waitingForOpponent = true;
    }
  }

  generateWind() {
    let level = this.windLevel;
    if (level === WIND_LEVELS.RANDOM) {
      level = Math.floor(Math.random() * 5);
    }
    const ranges = [0, 20, 60, 200, 600];
    const maxWind = ranges[level] || 0;
    return (Math.random() - 0.5) * 2 * maxWind;
  }

  get currentTank() {
    return this.tanks[this.currentPlayerIndex];
  }

  // ========== AIMING & CONTROLS ==========

  handleAimingClick(pos) {
    const tank = this.currentTank;
    if (!tank || !tank.alive) return;

    if (this.isOnline && this.waitingForOpponent) return;

    // Control bar area (bottom of screen)
    const controlsY = HEIGHT - CONTROLS_HEIGHT;

    if (pos.y >= controlsY) {
      // Fire button (center bottom)
      if (pos.x > WIDTH / 2 - 60 && pos.x < WIDTH / 2 + 60 && pos.y > controlsY + 50) {
        this.fire();
        return;
      }

      // Weapon prev/next (left side of controls)
      if (pos.x < WIDTH / 2 - 60) {
        if (pos.x < WIDTH / 4) {
          tank.selectPrevWeapon();
        } else {
          tank.selectNextWeapon();
        }
        sfx.sfxClick();
        return;
      }

      // Angle fine tune (right side controls)
      if (pos.x > WIDTH / 2 + 60) {
        // Left half = decrease angle, right half = increase
        if (pos.x < WIDTH * 0.75) {
          tank.angle = Math.max(0, tank.angle - 5);
        } else {
          tank.angle = Math.min(180, tank.angle + 5);
        }
        sfx.sfxClick();
        return;
      }
      return;
    }

    // Touch on game area - start drag to aim
    this.touchState = {
      active: true,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      startAngle: tank.angle,
      startPower: tank.power,
    };
  }

  handleAimingDrag(pos) {
    const tank = this.currentTank;
    if (!tank) return;

    this.touchState.currentX = pos.x;
    this.touchState.currentY = pos.y;

    const dx = pos.x - this.touchState.startX;
    const dy = pos.y - this.touchState.startY;

    // Horizontal drag controls angle
    tank.angle = Math.max(0, Math.min(180, this.touchState.startAngle - dx * 0.3));

    // Vertical drag controls power (up = more power)
    tank.power = Math.max(0, Math.min(tank.maxPower, this.touchState.startPower - dy * 2));
  }

  // ========== FIRING ==========

  fire() {
    const tank = this.currentTank;
    if (!tank || !tank.canFire()) return;

    const weapon = tank.currentWeapon;
    tank.consumeAmmo();

    if (weapon.type === 'laser') {
      this.fireLaser(tank, weapon);
    } else {
      this.fireProjectile(tank, weapon);
    }

    this.state = STATES.FLYING;
    sfx.sfxFire();

    // Send move to server if online
    if (this.isOnline) {
      this.sendMove({
        angle: tank.angle,
        power: tank.power,
        weaponIndex: tank.currentWeaponIndex,
      });
    }
  }

  fireProjectile(tank, weapon) {
    const tip = tank.getBarrelTip();
    const rad = (tank.angle * Math.PI) / 180;
    const speed = tank.power * 0.015;
    const vx = Math.cos(rad) * speed;
    const vy = -Math.sin(rad) * speed;
    this.projectiles.push(new Projectile(tip.x, tip.y, vx, vy, weapon, tank));
  }

  fireLaser(tank, weapon) {
    const tip = tank.getBarrelTip();
    const energy = Math.min(tank.power, (tank.weapons[weapon.id] || 0) + tank.power);
    this.laserBeam = new LaserBeam(tip.x, tip.y, tank.angle, energy, weapon, tank);
    this.laserBeam.calculate(this.terrain, this.tanks, this.currentWallType);
    this.stateTimer = 0;
    sfx.sfxLaser();
  }

  // ========== WEAPON EFFECTS ==========

  applyExplosion(x, y, weapon) {
    const radius = weapon.blastRadius;
    const damage = weapon.damage;

    // Create visual explosion
    this.explosions.push(new Explosion(x, y, radius, weapon.type === 'dirt' ? 'dirt' : 'explosive'));

    // Terrain effect
    if (weapon.type === 'dirt' || weapon.type === 'xdirt') {
      this.terrain.addDirt(x, y, radius);
      if (weapon.type === 'xdirt') {
        // Also some explosion
        this.terrain.createCrater(x, y, radius * 0.4);
      }
    } else if (weapon.type === 'sonic') {
      this.terrain.sonicBlast(x, y, radius);
      sfx.sfxSonic();
    } else if (weapon.type === 'cri') {
      const removals = this.terrain.chainReaction(x, y, weapon.criStrength, weapon.criDispersive);
      this.criEffects.push(new CRIEffect(x, y, removals));
    } else {
      this.terrain.createCrater(x, y, radius);
    }

    // Damage tanks
    for (const tank of this.tanks) {
      if (!tank.alive) continue;
      const dx = tank.x - x;
      const dy = (tank.y - 6) - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        // Quadratic falloff: damage stays high near center, drops near edge
        const falloff = Math.pow(1 - (dist / radius), 0.5);
        const dmg = Math.floor(damage * falloff);
        if (dmg > 0) {
          tank.takeDamage(dmg);
          if (!tank.alive) {
            sfx.sfxDeath();
            // Award kill to current player
            const shooter = this.currentTank;
            if (shooter && shooter !== tank) {
              shooter.kills++;
              shooter.hits++;
              shooter.money += 50 + Math.floor(damage * 0.5);
              shooter.score += 100;
            }
          }
        }
      }
    }

    // Sound effect
    if (radius > 60) sfx.sfxExplosionNuke();
    else if (radius > 30) sfx.sfxExplosionBig();
    else sfx.sfxExplosionSmall();
  }

  // ========== GAME LOOP ==========

  loop() {
    const now = performance.now();
    const dt = Math.min(50, now - this.lastTime);
    this.lastTime = now;

    this.update(dt);
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    this.titleTimer++;
    if (this.messageTimer > 0) this.messageTimer--;

    switch (this.state) {
      case STATES.TITLE:
        break;

      case STATES.AIMING:
        break;

      case STATES.FLYING:
        this.updateFlying();
        break;

      case STATES.EXPLODING:
        this.updateExploding();
        break;

      case STATES.CRUMBLING:
        this.updateCrumbling();
        break;

      case STATES.FALLING:
        this.updateFalling();
        break;

      case STATES.DEATH:
        this.updateDeath();
        break;

      case STATES.TURN_END:
        this.stateTimer++;
        if (this.stateTimer > 30) {
          this.nextTurn();
        }
        break;

      case STATES.ROUND_END:
        break;

      case STATES.SHOP:
        break;

      case STATES.GAME_OVER:
        break;
    }

    // Always update explosions
    for (const exp of this.explosions) exp.update();
    this.explosions = this.explosions.filter(e => !e.done);
    for (const cri of this.criEffects) cri.update();
    this.criEffects = this.criEffects.filter(c => !c.done);

    // Update death timers
    for (const tank of this.tanks) {
      if (tank.deathTimer > 0) tank.deathTimer--;
    }
  }

  updateTrajectoryPreview() {
    const tank = this.currentTank;
    if (!tank || !tank.alive) return;

    // Compute a dotted trajectory preview
    const tip = tank.getBarrelTip();
    const rad = (tank.angle * Math.PI) / 180;
    const speed = tank.power * 0.015;
    let vx = Math.cos(rad) * speed;
    let vy = -Math.sin(rad) * speed;
    let x = tip.x;
    let y = tip.y;

    this.aimTrajectory = [];
    for (let i = 0; i < 80; i++) {
      vy += GRAVITY;
      vx += this.wind * WIND_FACTOR;
      x += vx;
      y += vy;
      if (i % 3 === 0) {
        this.aimTrajectory.push({ x, y });
      }
      if (y > GAME_BOTTOM || x < -50 || x > WIDTH + 50) break;
      if (this.terrain && this.terrain.isGround(x, y)) break;
    }
  }

  updateFlying() {
    // Laser beam
    if (this.laserBeam) {
      this.stateTimer += 2;
      const progress = this.stateTimer / 60;
      if (progress >= 1) {
        // Laser done - apply hit
        const hit = this.laserBeam.hitResult;
        if (hit && (hit.type === 'hit_terrain' || hit.type === 'hit_tank')) {
          this.applyExplosion(hit.x, hit.y, this.laserBeam.weapon);
        }
        this.laserBeam = null;
        this.state = STATES.EXPLODING;
        this.stateTimer = 0;
      }
      return;
    }

    // Normal projectiles
    for (const proj of this.projectiles) {
      if (!proj.active) continue;

      const result = proj.update(this.wind, this.currentWallType, this.terrain, this.tanks);
      if (result) {
        if (result.type === 'hit_terrain' || result.type === 'hit_tank') {
          this.applyExplosion(result.x, result.y, proj.weapon);
        }
        if (result.type === 'mirv_split') {
          // Spawn 5 Mark II sub-projectiles
          const mk2 = WEAPONS.find(w => w.id === 'mark2');
          for (let i = 0; i < 5; i++) {
            const spread = (i - 2) * 1.5;
            const sub = new Projectile(
              result.x, result.y,
              result.vx + spread, result.vy - Math.abs(spread) * 0.3,
              mk2, proj.owner
            );
            sub.isSub = true;
            this.projectiles.push(sub);
          }
        }
      }
    }

    // Check if all projectiles are done
    const activeProjectiles = this.projectiles.filter(p => p.active);
    if (activeProjectiles.length === 0) {
      this.state = STATES.EXPLODING;
      this.stateTimer = 0;
    }
  }

  updateExploding() {
    this.stateTimer++;
    // Wait for explosions to finish
    if (this.explosions.length === 0 && this.criEffects.length === 0 && this.stateTimer > 10) {
      // Apply crumbling
      if (this.crumblePercent > 0) {
        this.state = STATES.CRUMBLING;
        this.stateTimer = 0;
      } else {
        this.state = STATES.FALLING;
        this.stateTimer = 0;
      }
    }
  }

  updateCrumbling() {
    this.stateTimer++;
    const changed = this.terrain.crumble(this.crumblePercent);
    if (!changed || this.stateTimer > 30) {
      this.state = STATES.FALLING;
      this.stateTimer = 0;
    }
  }

  updateFalling() {
    let anyFalling = false;
    for (const tank of this.tanks) {
      if (tank.updateFalling(this.terrain)) {
        anyFalling = true;
      }
    }

    this.stateTimer++;
    if (!anyFalling && this.stateTimer > 10) {
      // Check for deaths
      const deadThisTurn = this.tanks.filter(t => !t.alive && t.deathTimer > 0);
      if (deadThisTurn.length > 0) {
        this.state = STATES.DEATH;
        this.stateTimer = 0;
      } else {
        this.state = STATES.TURN_END;
        this.stateTimer = 0;
      }
    }
  }

  updateDeath() {
    const dying = this.tanks.filter(t => !t.alive && t.deathTimer > 0);
    if (dying.length === 0) {
      this.state = STATES.TURN_END;
      this.stateTimer = 0;
    }
  }

  nextTurn() {
    this.projectiles = [];

    // Check for round end
    const alive = this.tanks.filter(t => t.alive);
    if (alive.length <= 1) {
      if (alive.length === 1) {
        alive[0].wins++;
        alive[0].score += 200;
        alive[0].money += 100;
        this.showMessage(`${alive[0].name} wins the round!`, 120);
        sfx.sfxWin();
      } else {
        this.showMessage('Draw!', 120);
      }

      if (this.roundNumber >= this.totalRounds) {
        this.state = STATES.GAME_OVER;
      } else {
        this.state = STATES.ROUND_END;
      }
      this.stateTimer = 0;
      return;
    }

    // Next player
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.tanks.length;
    } while (!this.tanks[this.currentPlayerIndex].alive);

    this.state = STATES.AIMING;

    if (this.isOnline && this.currentPlayerIndex !== this.playerId) {
      this.waitingForOpponent = true;
    } else {
      this.waitingForOpponent = false;
    }
  }

  showMessage(text, frames) {
    this.messageText = text;
    this.messageTimer = frames;
  }

  // ========== SHOP ==========

  handleEndScreenClick(pos) {
    if (this.state === STATES.ROUND_END) {
      // Go to shop
      this.state = STATES.SHOP;
      this.shopCart = {};
      this.shopSelectedIndex = 0;
      this.shopScrollOffset = 0;
      sfx.sfxClick();
    } else if (this.state === STATES.GAME_OVER) {
      this.state = STATES.MENU;
      sfx.sfxClick();
    }
  }

  handleShopClick(pos) {
    const shopItems = [...WEAPONS.filter(w => w.cost > 0), ...DEFENSES];
    const rowHeight = 36;
    const listTop = 80;
    const listBottom = HEIGHT - 120;
    const maxVisible = Math.floor((listBottom - listTop) / rowHeight);

    // "Done" button
    if (pos.y > HEIGHT - 80 && pos.y < HEIGHT - 40 && pos.x > WIDTH / 2 - 80 && pos.x < WIDTH / 2 + 80) {
      this.applyShopPurchases();
      sfx.sfxClick();
      return;
    }

    // Player tabs
    if (pos.y > 30 && pos.y < 65) {
      if (pos.x < WIDTH / 2) {
        this.shopSelectedPlayerIndex = 0;
      } else {
        this.shopSelectedPlayerIndex = 1;
      }
      this.shopCart = {};
      sfx.sfxClick();
      return;
    }

    // Item list
    for (let i = 0; i < maxVisible; i++) {
      const itemIdx = i + this.shopScrollOffset;
      if (itemIdx >= shopItems.length) break;

      const rowY = listTop + i * rowHeight;
      if (pos.y >= rowY && pos.y < rowY + rowHeight) {
        const item = shopItems[itemIdx];
        const key = item.id;
        const tank = this.tanks[this.shopSelectedPlayerIndex ?? this.currentShopPlayer];

        if (pos.x > WIDTH - 120) {
          // + button
          if (!this.shopCart[key]) this.shopCart[key] = 0;
          const totalCost = this.getShopCartTotal(tank);
          if (totalCost + item.cost <= tank.money) {
            this.shopCart[key]++;
            sfx.sfxBuy();
          }
        } else if (pos.x > WIDTH - 180) {
          // - button
          if (this.shopCart[key] && this.shopCart[key] > 0) {
            this.shopCart[key]--;
            sfx.sfxClick();
          }
        }
        return;
      }
    }

    // Scroll
    if (pos.y >= listTop && pos.y < listBottom) {
      if (pos.x < 40) {
        this.shopScrollOffset = Math.max(0, this.shopScrollOffset - 1);
      } else if (pos.x > WIDTH - 40) {
        this.shopScrollOffset = Math.min(shopItems.length - maxVisible, this.shopScrollOffset + 1);
      }
    }
  }

  getShopCartTotal(tank) {
    const shopItems = [...WEAPONS.filter(w => w.cost > 0), ...DEFENSES];
    let total = 0;
    for (const [id, count] of Object.entries(this.shopCart)) {
      const item = shopItems.find(s => s.id === id);
      if (item) total += item.cost * count;
    }
    return total;
  }

  applyShopPurchases() {
    // Apply purchases for current shop player
    const playerIdx = this.shopSelectedPlayerIndex ?? 0;
    const tank = this.tanks[playerIdx];
    const shopItems = [...WEAPONS.filter(w => w.cost > 0), ...DEFENSES];

    for (const [id, count] of Object.entries(this.shopCart)) {
      if (count <= 0) continue;
      const item = shopItems.find(s => s.id === id);
      if (!item) continue;
      const totalCost = item.cost * count;
      if (totalCost > tank.money) continue;

      tank.money -= totalCost;

      // Is it a weapon or defense?
      if (WEAPONS.find(w => w.id === id)) {
        const weaponDef = WEAPONS.find(w => w.id === id);
        if (weaponDef.type === 'laser') {
          tank.weapons[id] = (tank.weapons[id] || 0) + (weaponDef.energyPerPurchase * count);
        } else {
          tank.weapons[id] = (tank.weapons[id] || 0) + count;
        }
      } else {
        tank.defenses[id] = true;
      }
    }

    // Move to next player or start round
    if (playerIdx === 0) {
      this.shopSelectedPlayerIndex = 1;
      this.shopCart = {};
    } else {
      this.startNextRound();
    }
  }

  get currentShopPlayer() {
    return this.shopSelectedPlayerIndex ?? 0;
  }

  // ========== ONLINE ==========

  connectOnline(mode) {
    this.onlineInputMode = mode || 'auto';

    if (mode === 'join') {
      // Show room code input screen
      this.state = 'online_join';
      this.roomCodeInput = '';
      return;
    }

    if (mode === 'create') {
      this.showMessage('Creating room...', 300);
      this.firebase.createRoom().then((code) => {
        this.roomCode = code;
        this.showMessage(`Room: ${code} — Waiting for opponent...`, 1200);
        this.state = 'online_waiting';
      }).catch(() => {
        this.showMessage('Failed to create room', 120);
        this.state = STATES.MENU;
      });
      return;
    }

    // Auto-match
    this.showMessage('Finding opponent...', 300);
    this.firebase.autoMatch().then((code) => {
      this.roomCode = code;
      if (this.firebase.playerId === 0) {
        this.showMessage(`Room: ${code} — Waiting...`, 1200);
        this.state = 'online_waiting';
      }
    }).catch(() => {
      this.showMessage('Connection failed', 120);
      this.state = STATES.MENU;
    });
  }

  async joinRoomByCode() {
    if (this.roomCodeInput.length < 4) return;
    this.showMessage('Joining room...', 300);
    try {
      await this.firebase.joinRoom(this.roomCodeInput);
      this.roomCode = this.roomCodeInput;
    } catch (err) {
      this.showMessage(err.message || 'Failed to join', 120);
      this.state = STATES.MENU;
    }
  }

  sendMove(move) {
    if (this.isOnline && this.firebase) {
      this.firebase.sendMove(move);
    }
  }

  receiveMove(msg) {
    const tank = this.currentTank;
    if (!tank) return;

    tank.angle = msg.angle;
    tank.power = msg.power;
    tank.currentWeaponIndex = msg.weaponIndex;
    this.waitingForOpponent = false;

    setTimeout(() => this.fire(), 500);
  }

  // ========== DRAWING ==========

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    switch (this.state) {
      case STATES.TITLE:
        this.drawTitle(ctx);
        break;
      case STATES.MENU:
        this.drawMenu(ctx);
        break;
      case 'online_join':
        this.drawJoinScreen(ctx);
        break;
      case 'online_waiting':
        this.drawWaitingScreen(ctx);
        break;
      case STATES.SHOP:
        this.drawShop(ctx);
        break;
      case STATES.GAME_OVER:
        this.drawGameOver(ctx);
        break;
      default:
        this.drawGame(ctx);
        break;
    }

    // Message overlay
    if (this.messageTimer > 0) {
      this.drawMessage(ctx);
    }
  }

  drawTitle(ctx) {
    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Animated stars
    for (let i = 0; i < 100; i++) {
      const seed = i * 7919;
      const x = ((seed * 13) % WIDTH);
      const y = ((seed * 17) % HEIGHT);
      const blink = Math.sin(this.titleTimer * 0.02 + i) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${blink * 0.8})`;
      ctx.fillRect(x, y, 1 + (i % 2), 1 + (i % 2));
    }

    // Title
    ctx.fillStyle = '#FF4400';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TANK WARS', WIDTH / 2, 180);

    ctx.fillStyle = '#FFAA00';
    ctx.font = '24px monospace';
    ctx.fillText('Mobile Edition', WIDTH / 2, 220);

    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.fillText('Based on Tank Wars 3.2 by Kenneth Morse (1992)', WIDTH / 2, 260);

    // Tap to start
    const alpha = Math.sin(this.titleTimer * 0.05) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = '22px monospace';
    ctx.fillText('Tap to Start', WIDTH / 2, 400);

    // Draw a small tank
    const tankX = WIDTH / 2 + Math.sin(this.titleTimer * 0.02) * 100;
    const tankY = 330;
    ctx.fillStyle = COLORS.player1;
    ctx.fillRect(tankX - 12, tankY - 6, 24, 12);
    ctx.fillStyle = '#333';
    ctx.fillRect(tankX - 13, tankY + 4, 26, 3);
    ctx.strokeStyle = COLORS.player1;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tankX, tankY - 6);
    const barrelAngle = Math.sin(this.titleTimer * 0.03) * 0.5 + 1;
    ctx.lineTo(tankX + Math.cos(barrelAngle) * 16, tankY - 6 - Math.sin(barrelAngle) * 16);
    ctx.stroke();
  }

  drawMenu(ctx) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#FF4400';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TANK WARS', WIDTH / 2, 60);

    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Tap values to change settings', WIDTH / 2, 90);

    // Settings
    const settings = [
      { label: 'Rounds', value: this.totalRounds },
      { label: 'Crumble', value: `${this.crumblePercent}%` },
      { label: 'Walls', value: WALL_NAMES[this.wallType] },
      { label: 'Wind', value: WIND_LEVEL_NAMES[this.windLevel] },
    ];

    const startY = 150;
    const rowH = 35;
    ctx.font = '18px monospace';

    for (let i = 0; i < settings.length; i++) {
      const y = startY + i * rowH;
      const s = settings[i];

      // Row background
      ctx.fillStyle = i % 2 === 0 ? '#111122' : '#0a0a1a';
      ctx.fillRect(WIDTH / 2 - 200, y - 5, 400, rowH);

      // Label
      ctx.textAlign = 'right';
      ctx.fillStyle = '#888';
      ctx.fillText(s.label, WIDTH / 2 - 20, y + 18);

      // Arrows
      ctx.fillStyle = '#FFAA00';
      ctx.textAlign = 'center';
      ctx.fillText('◄', WIDTH / 2 + 10, y + 18);
      ctx.fillText('►', WIDTH / 2 + 130, y + 18);

      // Value
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'center';
      ctx.fillText(s.value, WIDTH / 2 + 70, y + 18);
    }

    // Start Local button
    this.drawButton(ctx, WIDTH / 2, 340, 300, 44, 'Local 2-Player', '#44AA44');

    // Online: Auto Match
    this.drawButton(ctx, WIDTH / 2, 405, 300, 36, 'Online — Auto Match', '#4488FF');

    // Create / Join buttons
    ctx.fillStyle = '#4488FF';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Create Room', WIDTH / 2 - 75, 455);
    ctx.fillText('Join Room', WIDTH / 2 + 75, 455);
    ctx.strokeStyle = '#4488FF44';
    ctx.strokeRect(WIDTH / 2 - 150, 436, 150, 34);
    ctx.strokeRect(WIDTH / 2, 436, 150, 34);
  }

  drawButton(ctx, cx, cy, w, h, text, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    // Button background
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.fillStyle = `${color}22`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // Text
    ctx.fillStyle = color;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);
    ctx.textBaseline = 'alphabetic';
  }

  drawGame(ctx) {
    // Sky
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Game area background
    ctx.fillStyle = '#0a0a2e';
    ctx.fillRect(0, GAME_TOP, WIDTH, GAME_BOTTOM - GAME_TOP);

    // Terrain
    if (this.terrain) this.terrain.draw(ctx);

    // CRI effects
    for (const cri of this.criEffects) cri.draw(ctx);

    // Tanks
    for (let i = 0; i < this.tanks.length; i++) {
      this.tanks[i].draw(ctx, i === this.currentPlayerIndex && this.state === STATES.AIMING);
    }


    // Projectiles
    for (const proj of this.projectiles) proj.draw(ctx);

    // Laser beam
    if (this.laserBeam) {
      const progress = this.stateTimer / 60;
      this.laserBeam.draw(ctx, Math.min(1, progress));
    }

    // Explosions
    for (const exp of this.explosions) exp.draw(ctx);

    // HUD
    this.drawHUD(ctx);

    // Controls
    if (this.state === STATES.AIMING) {
      this.drawControls(ctx);
    }

    // Waiting overlay
    if (this.waitingForOpponent) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, HEIGHT / 2 - 30, WIDTH, 60);
      ctx.fillStyle = '#FFF';
      ctx.font = '22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for opponent...', WIDTH / 2, HEIGHT / 2 + 8);
    }

    // Wall type indicator
    if (this.currentWallType !== WALL_TYPES.NONE) {
      ctx.save();
      ctx.translate(12, GAME_TOP + 20);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(WALL_NAMES[this.currentWallType], 0, 0);
      ctx.restore();
    }
  }

  drawHUD(ctx) {
    // HUD background
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, 0, WIDTH, HUD_HEIGHT);
    ctx.strokeStyle = COLORS.hudBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, WIDTH, HUD_HEIGHT);

    const tank = this.currentTank;
    if (!tank) return;

    // Player indicators
    for (let i = 0; i < this.tanks.length; i++) {
      const t = this.tanks[i];
      const bx = i === 0 ? 15 : WIDTH - 220;

      // Name and color
      ctx.fillStyle = t.color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(t.name, bx, 18);

      // Health
      ctx.fillStyle = '#888';
      ctx.font = '12px monospace';
      ctx.fillText(`HP:${t.men}`, bx, 33);

      // Money
      ctx.fillText(`$${t.money}`, bx + 75, 33);

      // Wins
      ctx.fillText(`W:${t.wins}`, bx + 150, 33);

      // Active highlight
      if (i === this.currentPlayerIndex && this.state === STATES.AIMING) {
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 5, 3, 210, HUD_HEIGHT - 6);
      }
    }

    // Center: wind indicator
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.wind;
    ctx.font = '12px monospace';
    const windDir = this.wind > 0 ? '→' : this.wind < 0 ? '←' : '·';
    ctx.fillText(`Wind: ${windDir} ${Math.abs(Math.round(this.wind))}`, WIDTH / 2, 18);

    // Round info
    ctx.fillStyle = '#888';
    ctx.fillText(`Round ${this.roundNumber}/${this.totalRounds}`, WIDTH / 2, 36);
  }

  drawControls(ctx) {
    const tank = this.currentTank;
    if (!tank) return;

    const y = HEIGHT - CONTROLS_HEIGHT;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, y, WIDTH, CONTROLS_HEIGHT);
    ctx.strokeStyle = COLORS.hudBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, y, WIDTH, CONTROLS_HEIGHT);

    // Weapon info (left side)
    const weapon = tank.currentWeapon;
    const ammo = tank.weapons[weapon.id] || 0;
    ctx.fillStyle = weapon.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`◄ ${weapon.name} ►`, 20, y + 22);
    ctx.fillStyle = '#AAA';
    ctx.font = '12px monospace';
    ctx.fillText(`Ammo: ${weapon.type === 'laser' ? ammo + ' energy' : ammo}`, 20, y + 40);

    // Angle & Power (center)
    ctx.fillStyle = '#FFF';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Angle: ${Math.round(tank.angle)}°`, WIDTH / 2, y + 22);
    ctx.fillText(`Power: ${Math.round(tank.power)}`, WIDTH / 2, y + 42);

    // Power bar
    const barX = WIDTH / 2 - 80;
    const barW = 160;
    const barH = 8;
    const barY2 = y + 48;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY2, barW, barH);
    const pct = tank.power / tank.maxPower;
    ctx.fillStyle = pct > 0.8 ? '#FF4444' : pct > 0.5 ? '#FFAA00' : '#44FF44';
    ctx.fillRect(barX, barY2, barW * pct, barH);

    // Fine tune buttons (right side)
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('◄ Angle ►', WIDTH - 20, y + 22);

    // Fire button
    const fireX = WIDTH / 2;
    const fireY = y + 76;
    ctx.fillStyle = '#CC3300';
    ctx.beginPath();
    ctx.arc(fireX, fireY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF6600';
    ctx.beginPath();
    ctx.arc(fireX, fireY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIRE', fireX, fireY);
    ctx.textBaseline = 'alphabetic';

    // Drag hint
    if (!this.touchState.active) {
      ctx.fillStyle = '#555';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Drag on battlefield to aim • Tap weapon name to cycle', WIDTH / 2, y + 96);
    }
  }

  drawShop(ctx) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#FFAA00';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WEAPONS SHOP', WIDTH / 2, 35);

    // Player tabs
    for (let i = 0; i < 2; i++) {
      const tank = this.tanks[i];
      const tabX = i === 0 ? WIDTH / 4 : (WIDTH * 3) / 4;
      const isActive = (this.shopSelectedPlayerIndex ?? 0) === i;

      ctx.fillStyle = isActive ? tank.color : '#333';
      ctx.font = `${isActive ? 'bold ' : ''}16px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${tank.name} - $${tank.money}`, tabX, 58);

      if (isActive) {
        ctx.strokeStyle = tank.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tabX - 80, 63);
        ctx.lineTo(tabX + 80, 63);
        ctx.stroke();
      }
    }

    // Item list
    const shopItems = [...WEAPONS.filter(w => w.cost > 0), ...DEFENSES];
    const rowHeight = 36;
    const listTop = 80;
    const listBottom = HEIGHT - 120;
    const maxVisible = Math.floor((listBottom - listTop) / rowHeight);
    const currentTank = this.tanks[this.shopSelectedPlayerIndex ?? 0];

    for (let i = 0; i < maxVisible; i++) {
      const itemIdx = i + this.shopScrollOffset;
      if (itemIdx >= shopItems.length) break;

      const item = shopItems[itemIdx];
      const rowY = listTop + i * rowHeight;
      const cartCount = this.shopCart[item.id] || 0;
      const owned = currentTank.weapons[item.id] || 0;

      // Row bg
      ctx.fillStyle = i % 2 === 0 ? '#111122' : '#0a0a1a';
      ctx.fillRect(20, rowY, WIDTH - 40, rowHeight);

      // Name
      ctx.fillStyle = item.color || '#FFF';
      ctx.font = '13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(item.name, 30, rowY + 22);

      // Price
      ctx.fillStyle = '#FFAA00';
      ctx.textAlign = 'center';
      ctx.fillText(`$${item.cost}`, WIDTH - 280, rowY + 22);

      // Owned
      ctx.fillStyle = '#888';
      ctx.fillText(`Own:${owned}`, WIDTH - 220, rowY + 22);

      // Cart count
      ctx.fillStyle = cartCount > 0 ? '#44FF44' : '#444';
      ctx.fillText(cartCount.toString(), WIDTH - 150, rowY + 22);

      // - button
      this.drawButton(ctx, WIDTH - 120, rowY + rowHeight / 2, 30, 26, '-', '#FF4444');
      // + button
      this.drawButton(ctx, WIDTH - 75, rowY + rowHeight / 2, 30, 26, '+', '#44FF44');
    }

    // Cart total
    const total = this.getShopCartTotal(currentTank);
    ctx.fillStyle = '#FFF';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Cart: $${total} / Available: $${currentTank.money}`, WIDTH / 2, HEIGHT - 100);

    // Done button
    const doneLabel = (this.shopSelectedPlayerIndex ?? 0) === 0 ? 'Buy & Next Player' : 'Buy & Start Round';
    this.drawButton(ctx, WIDTH / 2, HEIGHT - 58, 240, 40, doneLabel, '#44AA44');
  }

  drawGameOver(ctx) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#FFAA00';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', WIDTH / 2, 80);

    // Determine winner
    const sorted = [...this.tanks].sort((a, b) => b.wins - a.wins || b.score - a.score);
    const winner = sorted[0];

    ctx.fillStyle = winner.color;
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`${winner.name} Wins!`, WIDTH / 2, 140);

    // Stats table
    const startY = 190;
    const headers = ['Player', 'Wins', 'Kills', 'Score', 'Accuracy'];
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    const colX = [200, 340, 430, 540, 680];
    for (let h = 0; h < headers.length; h++) {
      ctx.textAlign = 'center';
      ctx.fillText(headers[h], colX[h], startY);
    }

    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      const y = startY + 35 + i * 35;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.name, colX[0], y);

      ctx.fillStyle = '#FFF';
      ctx.font = '16px monospace';
      ctx.fillText(t.wins.toString(), colX[1], y);
      ctx.fillText(t.kills.toString(), colX[2], y);
      ctx.fillText(t.score.toString(), colX[3], y);
      const accuracy = t.shots > 0 ? Math.round((t.hits / t.shots) * 100) : 0;
      ctx.fillText(`${accuracy}%`, colX[4], y);
    }

    // Tap to continue
    const alpha = Math.sin(this.titleTimer * 0.05) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Tap to return to menu', WIDTH / 2, HEIGHT - 60);
  }

  handleJoinScreenClick(pos) {
    const centerX = WIDTH / 2;
    // Numpad-style buttons for room code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const cols = 8;
    const btnW = 50;
    const btnH = 40;
    const startX = centerX - (cols * btnW) / 2;
    const startY = 220;

    for (let i = 0; i < chars.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * btnW;
      const by = startY + row * (btnH + 5);
      if (pos.x >= bx && pos.x < bx + btnW - 4 && pos.y >= by && pos.y < by + btnH) {
        if (this.roomCodeInput.length < 4) {
          this.roomCodeInput += chars[i];
          sfx.sfxClick();
        }
        return;
      }
    }

    // Backspace button
    if (pos.y > 410 && pos.y < 445 && pos.x > centerX - 150 && pos.x < centerX - 20) {
      this.roomCodeInput = this.roomCodeInput.slice(0, -1);
      sfx.sfxClick();
      return;
    }

    // Join button
    if (pos.y > 410 && pos.y < 445 && pos.x > centerX + 20 && pos.x < centerX + 150) {
      if (this.roomCodeInput.length === 4) {
        this.joinRoomByCode();
      }
      return;
    }

    // Back button
    if (pos.y > 470 && pos.y < 510) {
      this.state = STATES.MENU;
      sfx.sfxClick();
    }
  }

  drawJoinScreen(ctx) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#4488FF';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('JOIN ROOM', WIDTH / 2, 50);

    // Room code display
    ctx.fillStyle = '#111';
    ctx.fillRect(WIDTH / 2 - 120, 80, 240, 60);
    ctx.strokeStyle = '#4488FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(WIDTH / 2 - 120, 80, 240, 60);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    const display = this.roomCodeInput.padEnd(4, '_');
    // Add spacing between chars
    const spacing = 50;
    const startX = WIDTH / 2 - spacing * 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < this.roomCodeInput.length ? '#FFF' : '#333';
      ctx.fillText(display[i], startX + i * spacing, 122);
    }

    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('Enter the 4-character room code', WIDTH / 2, 165);

    // On-screen keyboard
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const cols = 8;
    const btnW = 50;
    const btnH = 40;
    const kbStartX = WIDTH / 2 - (cols * btnW) / 2;
    const kbStartY = 220;

    for (let i = 0; i < chars.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = kbStartX + col * btnW;
      const by = kbStartY + row * (btnH + 5);

      ctx.fillStyle = '#222';
      ctx.fillRect(bx, by, btnW - 4, btnH);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, btnW - 4, btnH);

      ctx.fillStyle = '#FFF';
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(chars[i], bx + (btnW - 4) / 2, by + 28);
    }

    // Backspace + Join buttons
    this.drawButton(ctx, WIDTH / 2 - 85, 427, 120, 32, '← Delete', '#FF6644');

    const joinColor = this.roomCodeInput.length === 4 ? '#44AA44' : '#333';
    this.drawButton(ctx, WIDTH / 2 + 85, 427, 120, 32, 'Join', joinColor);

    // Back
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('← Back to menu', WIDTH / 2, 490);
  }

  drawWaitingScreen(ctx) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#4488FF';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WAITING FOR OPPONENT', WIDTH / 2, 150);

    // Room code
    ctx.fillStyle = '#FFAA00';
    ctx.font = 'bold 64px monospace';
    ctx.fillText(this.roomCode || '...', WIDTH / 2, 260);

    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.fillText('Share this room code with your opponent', WIDTH / 2, 310);

    // Animated dots
    const dots = '.'.repeat(1 + (Math.floor(this.titleTimer / 30) % 3));
    ctx.fillStyle = '#FFF';
    ctx.font = '22px monospace';
    ctx.fillText(`Waiting${dots}`, WIDTH / 2, 380);

    // Cancel
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.fillText('Tap here to cancel', WIDTH / 2, HEIGHT - 50);
  }

  drawMessage(ctx) {
    const alpha = Math.min(1, this.messageTimer / 30);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
    ctx.fillRect(0, HEIGHT / 2 - 40, WIDTH, 80);

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.messageText, WIDTH / 2, HEIGHT / 2 + 10);
  }
}
