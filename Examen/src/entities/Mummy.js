import EnemyBase, { ENEMY_STATE } from './EnemyBase.js';
import { ENEMY } from '../config/GameConfig.js';

/**
 * Momia reanimada (nivel 2).
 *
 * Lo que la distingue: **no se queda muerta**. Al agotar su HP cae al suelo,
 * pasa 3 segundos inerte y se reactiva con la vida completa, así que la fase de
 * supervivencia no se puede "limpiar" a tiros — solo ganar tiempo.
 *
 * El ciclo es `patrol/chase/attack → downed → patrol`, apoyado en el estado
 * DOWNED de EnemyBase (que ya hace que deje de actuar y de recibir daño sin
 * necesidad de desactivar el cuerpo, para que no atraviese el suelo).
 */
export default class Mummy extends EnemyBase {
  constructor(scene, x, y, patrolRange = 200) {
    super(scene, x, y, {
      spriteKey: 'mummy',
      stats: ENEMY.mummy,
      patrolRange,
      // 24 + 98 = 122, donde acaban sus pies en las hojas entregadas.
      bodyHeight: 98,
    });

    this.reviveTimer = null;
  }

  /** En lugar de morir, cae. */
  die() {
    this.enemyState = ENEMY_STATE.DOWNED;
    this.hp = 0;
    this.healthBar.clear();
    this.setVelocityX(0);

    // Aspecto de momia derrumbada: tumbada, apagada y semitransparente. Cae
    // hacia delante, en el sentido en que iba andando (los ángulos de Phaser
    // crecen en sentido horario).
    this.setAlpha(0.45);
    this.setTint(0x6b7a5a);
    this.setAngle(this.direction > 0 ? 75 : -75);

    this.reviveTimer = this.scene.time.delayedCall(this.stats.downedMs, () => this.revive());
  }

  /** Vuelve a levantarse con la vida completa. */
  revive() {
    // Si el nivel la desterró mientras estaba caída, no reaparece.
    if (!this.active || this.enemyState !== ENEMY_STATE.DOWNED) return;

    this.hp = this.maxHp;
    this.enemyState = ENEMY_STATE.PATROL;
    this.setAlpha(1);
    this.clearTint();
    this.setAngle(0);
    this.play('mummy-idle');

    // Destello al levantarse, para que el jugador lo note aunque esté lejos.
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.4, to: 1 },
      duration: 140,
      yoyo: true,
      repeat: 2,
    });
  }

  /**
   * La saca del mapa definitivamente. La usa el nivel al liberarse el artefacto:
   * roto el sello, la maldición se apaga y las momias no vuelven a levantarse.
   */
  banish() {
    this.reviveTimer?.remove();
    this.reviveTimer = null;
    this.enemyState = ENEMY_STATE.DEAD;
    this.healthBar.clear();

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 450,
      onComplete: () => this.disableBody(true, true),
    });
  }

  /** Reaparece en un punto concreto (oleadas). */
  spawnAt(x, y) {
    this.reviveTimer?.remove();
    this.reviveTimer = null;

    this.spawnX = x;
    this.spawnY = y;
    this.hp = this.maxHp;
    this.enemyState = ENEMY_STATE.PATROL;
    this.direction = -1;

    this.enableBody(true, x, y, true, true);
    this.setAlpha(1);
    this.clearTint();
    this.setAngle(0);
    this.setVelocity(0, 0);
    this.play('mummy-idle');
  }

  reset() {
    super.reset();
    this.reviveTimer?.remove();
    this.reviveTimer = null;
    this.setAngle(0);
  }
}
