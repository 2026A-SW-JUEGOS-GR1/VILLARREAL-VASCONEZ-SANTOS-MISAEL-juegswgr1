import Phaser from '../lib/phaser.js';
import { LEVEL2 } from '../config/GameConfig.js';

/** Tiempo máximo que una roca sigue en el mapa antes de retirarse. */
const LIFETIME_MS = 9000;

/**
 * Roca rodante (nivel 2).
 *
 * Aparece en lo alto de una colina y baja rodando hacia el valle. No hay
 * pendientes reales en Arcade Physics, así que la sensación de "rodar cuesta
 * abajo" se consigue con las colinas construidas en escalones: la roca los va
 * bajando a botes con un rebote bajo, y el giro constante del sprite completa el
 * efecto.
 *
 * Un solo toque cuesta la única vida del nivel, así que su hitbox es un círculo
 * algo más pequeño que el sprite: mejor perdonar un roce que castigar un píxel.
 */
export default class Boulder extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'boulder');

    this.expiresAt = 0;
  }

  /** Registra la animación de giro (una sola vez por partida). */
  static createAnimations(scene) {
    if (scene.anims.exists('boulder-roll')) return;

    scene.anims.create({
      key: 'boulder-roll',
      frames: scene.anims.generateFrameNumbers('boulder', { start: 0, end: 5 }),
      frameRate: 12,
      repeat: -1,
    });
  }

  /**
   * Lanza la roca cuesta abajo.
   * @param {number} x
   * @param {number} y
   * @param {number} direction -1 hacia la izquierda, 1 hacia la derecha.
   * @param {number} now Reloj de la escena.
   */
  roll(x, y, direction, now) {
    this.enableBody(true, x, y, true, true);

    this.setDisplaySize(64, 64);
    this.setCircle(26, 6, 6);
    this.setBounce(0.35);
    this.setVelocity(LEVEL2.boulderSpeed * direction, 0);
    this.setAngularVelocity(320 * direction);

    this.expiresAt = now + LIFETIME_MS;
    this.play('boulder-roll');
  }

  deactivate() {
    this.setAngularVelocity(0);
    this.disableBody(true, true);
  }

  /**
   * Llamado por el grupo cada frame (`runChildUpdate: true`). Retira la roca al
   * agotar su tiempo o al salirse del mundo, para que el pool no se llene.
   */
  update() {
    if (!this.active) return;

    const bounds = this.scene.physics.world.bounds;
    const outOfWorld =
      this.x < bounds.x - 96 || this.x > bounds.right + 96 || this.y > bounds.bottom + 96;

    if (outOfWorld || this.scene.time.now >= this.expiresAt) {
      this.deactivate();
    }
  }
}
