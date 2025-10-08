import { Rect, V2, WeaponId } from '../types';
import { InputManager } from '../input/InputManager';
import { Weapon } from '../weapons/Weapon';
import { Projectile } from './Projectile';

const GRAVITY = 0.0024;
const GROUND_FRICTION = 0.82;
const MOVE_SPEED = 0.24;
const JUMP_SPEED = -0.75;
const DASH_SPEED = 0.9;

export class Player {
  rect: Rect = { x: 300, y: 240, w: 24, h: 40 };
  vel: V2 = { x: 0, y: 0 };
  face: 1 | -1 = 1;
  hp = 100;
  hpMax = 100;
  invMs = 0;
  dashIFramesMs = 200;
  private dashTimer = 0;
  private onGround = false;
  private jumpBuffer = 0;
  private coyoteTimer = 0;
  private energy = 32;
  private energyMax = 32;
  private inventory = new Map<WeaponId, Weapon>();
  private currentWeaponId: WeaponId = 'Buster';
  private projectiles: Projectile[] = [];

  constructor(private input: InputManager, baseWeapon: Weapon) {
    this.inventory.set(baseWeapon.id, baseWeapon);
  }

  addWeapon(weapon: Weapon) {
    this.inventory.set(weapon.id, weapon);
  }

  switchWeapon(id: WeaponId) {
    const next = this.inventory.get(id);
    if (next) {
      this.currentWeaponId = id;
    }
  }

  cycleWeapon(dir: 1 | -1) {
    const ids = Array.from(this.inventory.keys());
    const currentIndex = ids.indexOf(this.currentWeaponId);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + ids.length + dir) % ids.length;
    this.switchWeapon(ids[nextIndex]);
  }

  update(dt: number) {
    this.invMs = Math.max(0, this.invMs - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);

    const move = (this.input.isDown('MoveRight') ? 1 : 0) - (this.input.isDown('MoveLeft') ? 1 : 0);
    this.face = move !== 0 ? (move > 0 ? 1 : -1) : this.face;
    this.vel.x += move * MOVE_SPEED;

    if (this.input.pressedAction('Jump')) {
      this.jumpBuffer = 120;
    }

    if (this.jumpBuffer > 0 && (this.onGround || this.coyoteTimer > 0)) {
      this.vel.y = JUMP_SPEED;
      this.onGround = false;
      this.jumpBuffer = 0;
    }

    if (this.input.pressedAction('Dash') && this.dashTimer <= 0) {
      this.dashTimer = 320;
      this.invMs = this.dashIFramesMs;
      this.vel.x = this.face * DASH_SPEED;
    }

    this.vel.y += GRAVITY * dt;
    this.vel.x *= GROUND_FRICTION;

    this.rect.x += this.vel.x * dt;
    this.rect.y += this.vel.y * dt;

    if (this.rect.y + this.rect.h >= 320) {
      this.rect.y = 320 - this.rect.h;
      this.vel.y = 0;
      this.onGround = true;
      this.coyoteTimer = 120;
    } else {
      this.onGround = false;
    }

    this.energy = Math.min(this.energyMax, this.energy + dt * 0.02);

    this.handleAttacks();

    for (const projectile of this.projectiles) {
      projectile.update(dt);
    }
    this.projectiles = this.projectiles.filter((p) => p.lifeMs > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = '#58d1ff';
    ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    ctx.restore();
    for (const projectile of this.projectiles) {
      projectile.draw(ctx);
    }
  }

  hurt(dmg: number) {
    if (this.invMs > 0) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.invMs = 400;
  }

  getProjectiles() {
    return this.projectiles;
  }

  getEnergy() {
    return { value: this.energy, max: this.energyMax };
  }

  getCurrentWeapon() {
    return this.inventory.get(this.currentWeaponId) ?? null;
  }

  private handleAttacks() {
    const weapon = this.inventory.get(this.currentWeaponId);
    if (!weapon) return;
    const state = { energy: this.energy, face: this.face, position: { x: this.rect.x, y: this.rect.y } };
    if (this.input.pressedAction('Blaster') && weapon.canFire(state)) {
      const shots = weapon.fire(state, { x: this.face, y: 0 });
      if (Array.isArray(shots)) {
        this.projectiles.push(...shots);
      }
      this.energy = Math.max(0, this.energy - weapon.energyCost);
    }
  }
}

export function setCurrentWeapon(player: Player, id: WeaponId) {
  player.switchWeapon(id);
}

export function nextWeapon(player: Player, dir: 1 | -1) {
  player.cycleWeapon(dir);
}
