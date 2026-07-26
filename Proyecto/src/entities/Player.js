import Phaser from '../lib/phaser.js';
import { PLAYER, ABILITIES } from '../config/GameConfig.js';
import HealthSystem from '../systems/HealthSystem.js';
import AmmoSystem from '../systems/AmmoSystem.js';
import AbilityCooldown from '../systems/AbilityCooldown.js';
import { playSfx } from '../systems/AudioManager.js';

/** Cuánto se muestra la animación de disparo tras apretar el gatillo. */
const SHOOT_ANIM_MS = 220;

/**
 * Drago, el personaje jugable. Común a los 4 niveles.
 *
 * Las habilidades especiales se activan por nivel al construirlo
 * (`enableDoubleJump` en el 2, `enableDash` en el 3) en lugar de subclasear:
 * son la misma entidad con capacidades distintas según la época.
 */
export default class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {object} options
   * @param {number} options.lives                  Vidas iniciales del nivel.
   * @param {boolean} [options.useInvulnerability]  Periodo de gracia tras daño.
   * @param {boolean} [options.enableDoubleJump]
   * @param {boolean} [options.enableDash]
   * @param {Phaser.Physics.Arcade.Group} options.bullets  Pool de balas del nivel.
   */
  constructor(scene, x, y, options) {
    super(scene, x, y, 'drago_idle');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.bullets = options.bullets;
    this.enableDoubleJump = options.enableDoubleJump ?? false;
    this.enableDash = options.enableDash ?? false;

    this.health = new HealthSystem({
      max: options.lives,
      useInvulnerability: options.useInvulnerability ?? true,
      invulnerabilityMs: PLAYER.invulnerabilityMs,
    });

    this.ammo = new AmmoSystem({
      magazineSize: PLAYER.magazineSize,
      fireRateMs: PLAYER.fireRateMs,
      reloadMs: PLAYER.reloadMs,
    });

    this.doubleJumpCooldown = new AbilityCooldown({
      cooldownMs: ABILITIES.doubleJump.cooldownMs,
    });
    this.dashCooldown = new AbilityCooldown({ cooldownMs: ABILITIES.dash.cooldownMs });

    // --- Estado de movimiento ---
    /** Saltos consumidos desde la última vez que tocó suelo. */
    this.jumpsUsed = 0;
    this.isDashing = false;
    this.facing = 1;
    /** Mientras está congelado ignora el input (banners, pausa, teletransportes). */
    this.frozen = false;

    /**
     * Multiplicador de velocidad horizontal. Lo usa la arena movediza del nivel 2
     * para frenar a Drago a la mitad sin tocar la constante global.
     */
    this.speedMultiplier = 1;

    /**
     * Bloquea desplazamiento y salto pero NO el disparo. Lo usa el estado
     * "atrapado" de la arena movediza. Importante: con esto activo, `handleJump`
     * sale ANTES de leer la tecla de salto, para que la escena pueda contar los
     * pulsos del forcejeo (`JustDown` se consume en la primera lectura).
     */
    this.movementLocked = false;
    this.shootAnimUntil = 0;
    this.blinkTween = null;

    this.configureBody();
    Player.createAnimations(scene);
    this.play('drago-idle');
  }

  configureBody() {
    this.setScale(PLAYER.scale);
    this.setCollideWorldBounds(true);
    this.body.setSize(PLAYER.bodyWidth, PLAYER.bodyHeight);
    this.body.setOffset(PLAYER.bodyOffsetX, PLAYER.bodyOffsetY);
  }

  /**
   * Registra las animaciones de Drago. El AnimationManager es global al juego,
   * así que solo hay que crearlas la primera vez.
   */
  static createAnimations(scene) {
    if (scene.anims.exists('drago-idle')) return;

    scene.anims.create({
      key: 'drago-idle',
      frames: scene.anims.generateFrameNumbers('drago_idle', { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });

    scene.anims.create({
      key: 'drago-walk',
      frames: scene.anims.generateFrameNumbers('drago_walk', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1,
    });

    scene.anims.create({
      key: 'drago-shoot',
      frames: scene.anims.generateFrameNumbers('drago_shoot', { start: 0, end: 5 }),
      frameRate: 14,
      repeat: 0,
    });
  }

  // -------------------------------------------------------------------------
  // Ciclo de vida
  // -------------------------------------------------------------------------

  /**
   * @param {number} time  Reloj de la escena en ms.
   * @param {InputManager} input
   */
  update(time, input) {
    this.ammo.update(time);

    if (this.frozen) {
      this.setVelocityX(0);
      return;
    }

    const onFloor = this.body.onFloor();
    if (onFloor) this.jumpsUsed = 0;

    this.handleDash(time, input);
    this.handleMovement(input);
    this.handleJump(time, input, onFloor);
    this.handleShooting(time, input);
    this.updateAnimation(time);
  }

  handleMovement(input) {
    // Durante el dash la velocidad horizontal la controla el propio dash.
    if (this.isDashing) return;

    if (this.movementLocked) {
      this.setVelocityX(0);
      return;
    }

    const speed = PLAYER.speed * this.speedMultiplier;

    if (input.left) {
      this.setVelocityX(-speed);
      this.facing = -1;
      this.setFlipX(true);
    } else if (input.right) {
      this.setVelocityX(speed);
      this.facing = 1;
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }
  }

  handleJump(time, input, onFloor) {
    // Salimos antes de leer la tecla: si estamos atrapados, el pulso lo tiene
    // que poder consumir la escena para el forcejeo.
    if (this.movementLocked) return;
    if (this.isDashing || !input.pressedJump()) return;

    if (onFloor) {
      this.setVelocityY(PLAYER.jumpVelocity);
      this.jumpsUsed = 1;
      playSfx(this.scene, 'sfx_jump');
      return;
    }

    // Segunda pulsación en el aire: doble salto, si el nivel lo concede y la
    // habilidad no está en cooldown.
    const canDoubleJump =
      this.enableDoubleJump && this.jumpsUsed === 1 && this.doubleJumpCooldown.use(time);

    if (canDoubleJump) {
      this.setVelocityY(ABILITIES.doubleJump.velocity);
      this.jumpsUsed = 2;
      playSfx(this.scene, 'sfx_jump');
      this.scene.tweens.add({
        targets: this,
        angle: { from: 0, to: this.facing * 360 },
        duration: 320,
        onComplete: () => this.setAngle(0),
      });
    }
  }

  handleDash(time, input) {
    if (!this.enableDash || this.isDashing || !input.pressedDash()) return;
    if (!this.dashCooldown.use(time)) return;

    this.isDashing = true;

    // Congelamos la gravedad para que el dash sea perfectamente horizontal.
    this.body.setAllowGravity(false);
    this.setVelocityY(0);
    this.setVelocityX(ABILITIES.dash.speed * this.facing);
    this.setTint(0x00ffff);

    this.scene.time.delayedCall(ABILITIES.dash.durationMs, () => {
      this.isDashing = false;
      this.body.setAllowGravity(true);
      this.clearTint();
    });
  }

  handleShooting(time, input) {
    // Mantener J dispara en automático, limitado por la cadencia del cargador.
    if (!input.shootHeld) return;
    if (!this.ammo.tryFire(time)) return;

    this.fireBullet(input);
    this.shootAnimUntil = time + SHOOT_ANIM_MS;
    playSfx(this.scene, 'sfx_shoot');

    // El cargador se acaba de vaciar: la recarga arranca sola.
    if (this.ammo.isReloading) playSfx(this.scene, 'sfx_reload');
  }

  /** Instancia una bala del pool en la dirección apuntada. */
  fireBullet(input) {
    const bullet = this.bullets.get(this.x, this.y);
    if (!bullet) return; // pool lleno

    // El cañón sale por delante del torso, a la altura del pecho.
    const muzzleOffsetX = 26 * this.facing;
    const muzzleOffsetY = -6;

    if (input.aimUp) {
      bullet.fire(this.x, this.y - 30, 0, -PLAYER.bulletSpeed);
    } else if (input.aimDown && !this.body.onFloor()) {
      bullet.fire(this.x, this.y + 30, 0, PLAYER.bulletSpeed);
    } else {
      bullet.fire(
        this.x + muzzleOffsetX,
        this.y + muzzleOffsetY,
        PLAYER.bulletSpeed * this.facing,
      );
    }
  }

  updateAnimation(time) {
    if (time < this.shootAnimUntil) {
      this.play('drago-shoot', true);
      return;
    }

    const moving = Math.abs(this.body.velocity.x) > 10;
    this.play(moving ? 'drago-walk' : 'drago-idle', true);
  }

  // -------------------------------------------------------------------------
  // Daño y reaparición
  // -------------------------------------------------------------------------

  /**
   * Aplica daño respetando la invulnerabilidad.
   * @returns {'ignored'|'hurt'|'dead'}
   */
  takeDamage(time, amount = 1) {
    // El dash concede invencibilidad mientras dura: es lo que lo convierte en
    // una herramienta para atravesar trampas del nivel 3, no solo para moverse.
    if (this.isDashing && ABILITIES.dash.grantsInvulnerability) return 'ignored';

    const result = this.health.damage(time, amount);

    if (result === 'hurt') this.startBlink();
    return result;
  }

  /** ¿Ignora daño ahora mismo? Lo consultan las mecánicas que no pasan por `takeDamage`. */
  isImmune(time) {
    if (this.isDashing && ABILITIES.dash.grantsInvulnerability) return true;
    return this.health.isInvulnerable(time);
  }

  /** Parpadeo durante el periodo de gracia. */
  startBlink() {
    this.blinkTween?.remove();

    this.blinkTween = this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.25 },
      duration: 120,
      yoyo: true,
      repeat: Math.floor(PLAYER.invulnerabilityMs / 240),
      onComplete: () => {
        this.setAlpha(1);
        this.blinkTween = null;
      },
    });
  }

  /** Recoloca a Drago en un punto y limpia su estado de movimiento. */
  respawn(x, y) {
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    this.setAlpha(1);
    this.setAngle(0);
    this.clearTint();

    this.isDashing = false;
    this.jumpsUsed = 0;
    this.speedMultiplier = 1;
    this.movementLocked = false;
    this.body.setAllowGravity(true);
    this.ammo.reset();
  }

  /** Congela o reactiva el control (banners, pausa, teletransporte). */
  setFrozen(frozen) {
    this.frozen = frozen;
    if (frozen) this.setVelocityX(0);
  }
}
