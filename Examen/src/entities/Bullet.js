import Phaser from '../lib/phaser.js';
import { GAME_WIDTH } from '../config/GameConfig.js';

/** Alcance máximo antes de auto-desactivarse (evita balas eternas fuera de cámara). */
const MAX_RANGE = GAME_WIDTH;

/**
 * Bala del rifle de Drago.
 *
 * Se gestiona con un grupo reciclable: las balas nunca se destruyen, se
 * desactivan y se reutilizan. Con una cadencia de 5 disparos/segundo eso evita
 * crear y liberar objetos constantemente.
 */
export default class Bullet extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    super(scene, x, y, 'bullet');

    this.spawnX = x;
    this.spawnY = y;
  }

  /**
   * Lanza la bala desde una posición con una velocidad dada.
   * `velocityY` distinto de cero es para los disparos hacia arriba/abajo.
   */
  fire(x, y, velocityX, velocityY = 0) {
    this.enableBody(true, x, y, true, true);
    this.body.setAllowGravity(false);
    this.setVelocity(velocityX, velocityY);

    // Orientamos el sprite: la textura apunta a la derecha por defecto.
    if (velocityX === 0 && velocityY !== 0) {
      this.setRotation(velocityY < 0 ? -Math.PI / 2 : Math.PI / 2);
    } else {
      this.setRotation(0);
      this.setFlipX(velocityX < 0);
    }

    this.spawnX = x;
    this.spawnY = y;
  }

  /** Devuelve la bala al pool. */
  deactivate() {
    this.disableBody(true, true);
  }

  /**
   * Llamado por el grupo en cada frame (`runChildUpdate: true`).
   * Retira la bala al agotar su alcance o al salir del mundo.
   */
  update() {
    if (!this.active) return;

    const travelled = Phaser.Math.Distance.Between(this.spawnX, this.spawnY, this.x, this.y);
    const bounds = this.scene.physics.world.bounds;

    const outOfWorld =
      this.x < bounds.x - 64 ||
      this.x > bounds.right + 64 ||
      this.y < bounds.y - 64 ||
      this.y > bounds.bottom + 64;

    if (travelled > MAX_RANGE || outOfWorld) {
      this.deactivate();
    }
  }
}
