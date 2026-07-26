import Phaser from '../lib/phaser.js';
import EnemyBase, { ENEMY_STATE } from './EnemyBase.js';
import { ENEMY, LEVEL3 } from '../config/GameConfig.js';

/**
 * Ninja controlado mentalmente (nivel 3).
 *
 * Tiene dos registros de ataque, y por eso sobreescribe `update()` en lugar de
 * heredar el de EnemyBase:
 *
 *  - **De lejos**: se acerca y lanza shuriken, que provocan sangrado (no quitan
 *    vida directamente).
 *  - **De cerca** (< 60 px): desenvaina el wakizashi. Ese golpe cuenta como
 *    "ataque cuerpo a cuerpo de enemigo", con su propia regla: si Drago está
 *    sangrando, lo deja en 1 vida.
 *
 * La escena decide qué hace cada impacto; el ninja solo avisa
 * (`onNinjaMelee` / el propio proyectil).
 */
export default class Ninja extends EnemyBase {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {object} options
   * @param {Phaser.Physics.Arcade.Group} options.shurikens Pool de proyectiles.
   * @param {number} [options.patrolRange]
   */
  constructor(scene, x, y, options) {
    super(scene, x, y, {
      spriteKey: 'ninja',
      stats: ENEMY.ninja,
      patrolRange: options.patrolRange ?? 120,
      // 24 + 101 = 125: los pies de ninja acaban en y=125.
      bodyHeight: 101,
    });

    this.shurikens = options.shurikens;
    this.nextThrowAt = 0;
  }

  update(time, player) {
    if (!this.canAct()) return;

    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distance <= this.stats.meleeRange) {
      this.doWakizashi(time, player);
    } else if (distance <= this.stats.detectionRange) {
      this.doRangedChase(time, player);
    } else {
      this.doPatrol();
    }

    this.drawHealthBar();
  }

  /** Se acerca lanzando shuriken. */
  doRangedChase(time, player) {
    this.enemyState = ENEMY_STATE.CHASE;
    this.direction = player.x < this.x ? -1 : 1;

    this.setVelocityX(this.stats.chaseSpeed * this.direction);
    this.faceDirection();
    this.play('ninja-walk', true);

    if (time < this.nextThrowAt) return;

    // Solo lanza si el jugador está más o menos a su altura: un shuriken
    // horizontal contra alguien tres plataformas más arriba no tendría sentido.
    if (Math.abs(player.y - this.y) > 72) return;

    this.nextThrowAt = time + this.stats.throwCooldownMs;
    this.play('ninja-attack', true);

    const shuriken = this.shurikens.get(this.x, this.y);
    if (!shuriken) return;

    shuriken.throwAt(
      this.x + 32 * this.direction,
      this.y - 8,
      this.direction,
      this.stats.shurikenSpeed,
    );
  }

  /** Ataque cuerpo a cuerpo con wakizashi. */
  doWakizashi(time, player) {
    this.enemyState = ENEMY_STATE.ATTACK;
    this.direction = player.x < this.x ? -1 : 1;

    this.setVelocityX(0);
    this.faceDirection();

    if (time < this.nextAttackAt) return;

    this.nextAttackAt = time + LEVEL3.wakizashiCooldownMs;
    this.play('ninja-attack', true);
    this.scene.onNinjaMelee();
  }

  reset() {
    super.reset();
    this.nextThrowAt = 0;
  }
}
