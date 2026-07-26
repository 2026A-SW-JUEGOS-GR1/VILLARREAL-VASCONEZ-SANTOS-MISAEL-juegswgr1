import Phaser from '../lib/phaser.js';
import EnemyBase, { ENEMY_STATE } from './EnemyBase.js';
import { ENEMY, LEVEL4 } from '../config/GameConfig.js';

/** Estados propios del verdugo, además de los de EnemyBase. */
const TELEGRAPH = 'telegraph';
const CHARGING = 'charging';
const STUNNED = 'stunned';

/**
 * Verdugo (nivel 4).
 *
 * No persigue: **embiste**. Al detectar a Drago se queda medio segundo
 * preparándose (con el hacha brillando en rojo, el aviso que le da al jugador la
 * oportunidad de apartarse) y luego carga en línea recta a 300 px/s.
 *
 * Si choca contra una pared queda aturdido un segundo, indefenso: es la ventana
 * para descargarle los tres disparos. Y para que esa ventana exista siempre
 * —aunque la embestida no encuentre ninguna pared— la carga tiene además un tope
 * de duración tras el cual se detiene igualmente.
 */
export default class Executioner extends EnemyBase {
  constructor(scene, x, y, patrolRange = 160) {
    super(scene, x, y, {
      spriteKey: 'executioner',
      stats: ENEMY.executioner,
      patrolRange,
      // Es corpulento: cuerpo más ancho y algo más de escala que el resto.
      scale: 0.8,
      bodyWidth: 64,
      // Sus pies llegan a y=127, casi al borde del frame.
      bodyHeight: 103,
    });

    this.phaseEndsAt = 0;
    /** Dirección fijada al empezar la embestida: no corrige a medio camino. */
    this.chargeDirection = 0;
  }

  update(time, player) {
    if (!this.canAct()) return;

    switch (this.enemyState) {
      case TELEGRAPH:
        this.updateTelegraph(time);
        break;
      case CHARGING:
        this.updateCharge(time);
        break;
      case STUNNED:
        this.updateStun(time);
        break;
      default:
        this.updateIdle(time, player);
    }

    this.drawHealthBar();
  }

  /** Patrulla hasta ver a Drago. */
  updateIdle(time, player) {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    // Solo embiste a quien esté más o menos a su altura: no carga contra alguien
    // que está dos plataformas por encima.
    const sameLevel = Math.abs(player.y - this.y) < 80;

    if (distance <= this.stats.detectionRange && sameLevel) {
      this.startTelegraph(time, player);
      return;
    }

    this.doPatrol();
  }

  startTelegraph(time, player) {
    this.enemyState = TELEGRAPH;
    this.phaseEndsAt = time + this.stats.telegraphMs;
    this.chargeDirection = player.x < this.x ? -1 : 1;
    this.direction = this.chargeDirection;

    this.setVelocityX(0);
    this.faceDirection();
    this.play(`${this.spriteKey}-walk`, true);

    // Aviso: se tiñe de rojo y vibra un poco antes de salir disparado.
    this.setTint(0xff5544);
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.12,
      duration: this.stats.telegraphMs / 2,
      yoyo: true,
    });
  }

  updateTelegraph(time) {
    if (time < this.phaseEndsAt) return;

    this.enemyState = CHARGING;
    this.phaseEndsAt = time + LEVEL4.chargeMaxMs;

    this.clearTint();
    this.setVelocityX(this.stats.chargeSpeed * this.chargeDirection);
    this.play(`${this.spriteKey}-attack`, true);
  }

  updateCharge(time) {
    // Mantiene la velocidad: la embestida no se frena ni corrige.
    this.setVelocityX(this.stats.chargeSpeed * this.chargeDirection);

    const hitWall =
      (this.chargeDirection < 0 && this.body.blocked.left) ||
      (this.chargeDirection > 0 && this.body.blocked.right);

    if (hitWall || time >= this.phaseEndsAt) {
      this.startStun(time);
    }
  }

  startStun(time) {
    this.enemyState = STUNNED;
    this.phaseEndsAt = time + this.stats.stunMs;

    this.setVelocityX(0);
    this.play(`${this.spriteKey}-idle`, true);

    // Aturdido: parpadea en gris para que se vea que es el momento de disparar.
    this.setTint(0x8899aa);
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.55 },
      duration: 140,
      yoyo: true,
      repeat: Math.floor(this.stats.stunMs / 280),
    });
  }

  updateStun(time) {
    if (time < this.phaseEndsAt) return;

    this.enemyState = ENEMY_STATE.PATROL;
    this.clearTint();
    this.setAlpha(1);
  }

  /** ¿Está embistiendo? La escena lo usa para saber si el contacto hace daño. */
  isCharging() {
    return this.enemyState === CHARGING;
  }

  reset() {
    super.reset();
    this.phaseEndsAt = 0;
    this.chargeDirection = 0;
    this.setAlpha(1);
    this.setScale(0.8);
  }
}
