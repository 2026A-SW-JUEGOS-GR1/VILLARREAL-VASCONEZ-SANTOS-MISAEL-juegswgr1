import Phaser from '../lib/phaser.js';
import { ENEMY } from '../config/GameConfig.js';
import { playSfx } from '../systems/AudioManager.js';

/** Estados de la máquina de estados común a todos los enemigos. */
export const ENEMY_STATE = {
  PATROL: 'patrol',
  CHASE: 'chase',
  ATTACK: 'attack',
  /** Sin HP pero aún en el mapa: lo usan las momias mientras esperan revivir. */
  DOWNED: 'downed',
  DEAD: 'dead',
};

/** Duración del destello blanco al recibir un impacto. */
const HIT_FLASH_MS = 90;

/**
 * Base de todos los enemigos del juego.
 *
 * Reglas comunes (sección 4 de la especificación):
 *  - Mueren a los 3 impactos de bala.
 *  - Son inmunes a las trampas del escenario: basta con no registrar ningún
 *    collider entre el grupo de enemigos y el de trampas.
 *  - Al perder el jugador una vida vuelven a su posición y HP iniciales, sin
 *    recrearlos: se desactivan y se reactivan (`reset()`).
 *
 * Llevan barra de vida flotante dibujada con Graphics, así que no depende de
 * ningún asset.
 *
 * Los spritesheets de enemigos del documento de arte miran a la IZQUIERDA (al
 * contrario que Drago), por eso `flipX` se activa al avanzar hacia la derecha.
 */
export default class EnemyBase extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {object} options
   * @param {string} options.spriteKey    Prefijo de assets: 'roman', 'mummy'...
   * @param {object} options.stats        Bloque de ENEMY (velocidades, rangos).
   * @param {number} [options.patrolRange] Radio de patrulla en px.
   * @param {number} [options.scale]
   * @param {number} [options.bodyWidth]
   * @param {number} [options.bodyHeight]
   */
  constructor(scene, x, y, options) {
    super(scene, x, y, `${options.spriteKey}_idle`);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.spriteKey = options.spriteKey;
    this.stats = options.stats;
    this.patrolRange = options.patrolRange ?? 140;

    /** Posición inicial, para patrullar alrededor y para `reset()`. */
    this.spawnX = x;
    this.spawnY = y;

    this.maxHp = ENEMY.maxHp;
    this.hp = this.maxHp;
    this.enemyState = ENEMY_STATE.PATROL;
    this.direction = -1;
    this.nextAttackAt = 0;

    this.setScale(options.scale ?? 0.7);
    this.setCollideWorldBounds(true);
    this.body.setSize(options.bodyWidth ?? 52, options.bodyHeight ?? 104);
    this.body.setOffset(38, 24);

    EnemyBase.createAnimations(scene, this.spriteKey);
    this.play(`${this.spriteKey}-idle`);

    this.createHealthBar();
  }

  /** Registra idle/walk/attack para un prefijo de enemigo (una sola vez). */
  static createAnimations(scene, spriteKey) {
    if (scene.anims.exists(`${spriteKey}-idle`)) return;

    const definitions = [
      { state: 'idle', frameRate: 6, repeat: -1 },
      { state: 'walk', frameRate: 10, repeat: -1 },
      { state: 'attack', frameRate: 14, repeat: 0 },
    ];

    definitions.forEach(({ state, frameRate, repeat }) => {
      scene.anims.create({
        key: `${spriteKey}-${state}`,
        frames: scene.anims.generateFrameNumbers(`${spriteKey}_${state}`, { start: 0, end: 5 }),
        frameRate,
        repeat,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Barra de vida
  // -------------------------------------------------------------------------

  createHealthBar() {
    this.healthBar = this.scene.add.graphics();
    this.healthBar.setDepth(this.depth + 1);
  }

  drawHealthBar() {
    const { width, height, offsetY } = ENEMY.healthBar;
    this.healthBar.clear();

    if (!this.active) return;

    const x = this.x - width / 2;
    const y = this.y + offsetY - this.displayHeight / 2;
    const ratio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);

    // Marco y fondo.
    this.healthBar.fillStyle(0x000000, 0.65);
    this.healthBar.fillRect(x - 1, y - 1, width + 2, height + 2);

    // Relleno: verde → naranja → rojo según lo tocado que esté.
    const color = ratio > 0.66 ? 0x46d160 : ratio > 0.33 ? 0xffa726 : 0xe5484d;
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(x, y, width * ratio, height);
  }

  // -------------------------------------------------------------------------
  // Daño y ciclo de vida
  // -------------------------------------------------------------------------

  /**
   * ¿Puede actuar y recibir daño? Falso si está desactivado, muerto o caído
   * esperando revivir.
   */
  canAct() {
    return (
      this.active &&
      this.enemyState !== ENEMY_STATE.DEAD &&
      this.enemyState !== ENEMY_STATE.DOWNED
    );
  }

  /** Impacto de bala. Devuelve true si el enemigo ha muerto con este golpe. */
  takeBulletHit(amount = 1) {
    if (!this.canAct()) return false;

    this.hp -= amount;

    // Destello para que el impacto se lea aunque no haya animación de daño.
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => this.clearTint());

    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.enemyState = ENEMY_STATE.DEAD;
    this.hp = 0;
    this.healthBar.clear();
    playSfx(this.scene, 'sfx_enemy_death');

    // No se destruye: se desactiva para poder devolverlo con `reset()`.
    this.disableBody(true, true);
  }

  /** Vuelve a su posición y HP iniciales (el jugador perdió una vida). */
  reset() {
    this.hp = this.maxHp;
    this.enemyState = ENEMY_STATE.PATROL;
    this.direction = -1;
    this.nextAttackAt = 0;

    this.enableBody(true, this.spawnX, this.spawnY, true, true);
    this.clearTint();
    this.setVelocity(0, 0);
    this.play(`${this.spriteKey}-idle`);
  }

  /** Limpia la barra al destruir el enemigo. */
  destroy(fromScene) {
    this.healthBar?.destroy();
    super.destroy(fromScene);
  }

  // -------------------------------------------------------------------------
  // Comportamiento
  // -------------------------------------------------------------------------

  /**
   * @param {number} time    Reloj de la escena.
   * @param {Player} player
   */
  update(time, player) {
    if (!this.canAct()) return;

    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distance <= this.stats.attackRange) {
      this.doAttack(time, player);
    } else if (distance <= this.stats.detectionRange) {
      this.doChase(player);
    } else {
      this.doPatrol();
    }

    this.drawHealthBar();
  }

  /** Ida y vuelta alrededor del punto de aparición. */
  doPatrol() {
    this.enemyState = ENEMY_STATE.PATROL;

    if (this.x <= this.spawnX - this.patrolRange) this.direction = 1;
    else if (this.x >= this.spawnX + this.patrolRange) this.direction = -1;

    this.setVelocityX(this.stats.patrolSpeed * this.direction);
    this.faceDirection();
    this.play(`${this.spriteKey}-walk`, true);
  }

  /** Corre hacia el jugador. */
  doChase(player) {
    this.enemyState = ENEMY_STATE.CHASE;
    this.direction = player.x < this.x ? -1 : 1;

    this.setVelocityX(this.stats.chaseSpeed * this.direction);
    this.faceDirection();
    this.play(`${this.spriteKey}-walk`, true);
  }

  /**
   * Ataque cuerpo a cuerpo. La comprobación de distancia hace de hitbox, y la
   * invulnerabilidad del jugador impide que un mismo enemigo vacíe la barra de
   * vidas en unos pocos frames.
   */
  doAttack(time, player) {
    this.enemyState = ENEMY_STATE.ATTACK;
    this.direction = player.x < this.x ? -1 : 1;

    this.setVelocityX(0);
    this.faceDirection();

    if (time < this.nextAttackAt) return;

    this.nextAttackAt = time + this.stats.attackCooldownMs;
    this.play(`${this.spriteKey}-attack`, true);
    this.scene.loseLife();
  }

  /**
   * Orienta el sprite según hacia dónde avanza.
   *
   * Los sprites entregados miran a la **derecha** (igual que Drago), aunque el
   * documento de arte pedía que mirasen a la izquierda. Se comprobó abriendo las
   * hojas: el ninja corre hacia la derecha y el legionario lleva el escudo a su
   * derecha. Por eso se voltea al ir hacia la izquierda, no al contrario.
   */
  faceDirection() {
    this.setFlipX(this.direction < 0);
  }
}
