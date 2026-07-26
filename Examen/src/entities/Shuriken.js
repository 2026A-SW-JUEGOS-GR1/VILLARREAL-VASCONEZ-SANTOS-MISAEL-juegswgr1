import Phaser from '../lib/phaser.js';

/** Alcance máximo antes de retirarse, para que el pool no se llene. */
const MAX_RANGE = 900;

/**
 * Shuriken enemigo (nivel 3).
 *
 * Lo lanzan tanto las trampas de pared como los ninjas, y ambos causan el mismo
 * efecto: no quitan vida al impactar, provocan sangrado. Vuela en horizontal,
 * sin gravedad.
 */
export default class Shuriken extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'shuriken');

    this.spawnX = x;
  }

  static createAnimations(scene) {
    if (scene.anims.exists('shuriken-spin')) return;

    scene.anims.create({
      key: 'shuriken-spin',
      frames: scene.anims.generateFrameNumbers('shuriken', { start: 0, end: 5 }),
      frameRate: 16,
      repeat: -1,
    });
  }

  /** Lo lanza en horizontal. `direction` es -1 (izquierda) o 1 (derecha). */
  throwAt(x, y, direction, speed) {
    this.enableBody(true, x, y, true, true);

    this.body.setAllowGravity(false);
    this.setVelocity(speed * direction, 0);
    this.setCircle(14, 2, 2);
    // Giro visual además de la animación, para que se lea bien a cualquier escala.
    this.setAngularVelocity(520 * direction);

    this.spawnX = x;
    this.play('shuriken-spin');
  }

  deactivate() {
    this.setAngularVelocity(0);
    this.disableBody(true, true);
  }

  /** Llamado por el grupo cada frame (`runChildUpdate: true`). */
  update() {
    if (!this.active) return;

    const bounds = this.scene.physics.world.bounds;
    const outOfWorld = this.x < bounds.x - 64 || this.x > bounds.right + 64;

    if (outOfWorld || Math.abs(this.x - this.spawnX) > MAX_RANGE) {
      this.deactivate();
    }
  }
}
