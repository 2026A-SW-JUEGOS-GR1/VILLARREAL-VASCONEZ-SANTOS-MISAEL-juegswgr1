import Phaser from '../lib/phaser.js';

/**
 * Plataforma móvil (nivel 1).
 *
 * El movimiento lo lleva un tween sobre el sprite, no la velocidad del cuerpo:
 * el cuerpo es inamovible y con `moves = false`, de modo que Arcade no lo
 * integra por física pero sí recoloca sus límites desde la posición del sprite
 * en cada paso. Es la forma fiable de tener un recorrido exacto de ida y vuelta.
 *
 * A cambio hay que arrastrar al jugador a mano: Arcade no transmite el
 * movimiento de un cuerpo que no se mueve "por física". Para eso la plataforma
 * expone el desplazamiento del último frame (`deltaX` / `deltaY`) y la escena lo
 * suma a la posición de Drago mientras esté encima (ver `carryRiders`).
 */
export default class MovingPlatform extends Phaser.Physics.Arcade.Image {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {object} options
   * @param {'horizontal'|'vertical'} options.axis
   * @param {number} options.distance   Recorrido en px.
   * @param {number} options.durationMs Duración de cada tramo.
   */
  constructor(scene, x, y, options) {
    super(scene, x, y, 'moving_platform_rome');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    // El tween es el dueño del movimiento; que la física no lo toque.
    this.body.moves = false;

    /** Posición en el frame anterior, para calcular el desplazamiento. */
    this.previousX = x;
    this.previousY = y;
    this.deltaX = 0;
    this.deltaY = 0;

    this.createTween(scene, options);
  }

  createTween(scene, { axis, distance, durationMs }) {
    const property = axis === 'vertical' ? 'y' : 'x';
    const from = property === 'y' ? this.y : this.x;

    this.movementTween = scene.tweens.add({
      targets: this,
      [property]: from + (axis === 'vertical' ? -distance : distance),
      duration: durationMs,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Actualiza el desplazamiento del frame. Debe llamarse una vez por frame,
   * después de que los tweens hayan corrido (es decir, desde `update`).
   */
  refreshDelta() {
    this.deltaX = this.x - this.previousX;
    this.deltaY = this.y - this.previousY;

    this.previousX = this.x;
    this.previousY = this.y;
  }

  /** ¿Está este cuerpo apoyado sobre la plataforma ahora mismo? */
  isCarrying(gameObject) {
    return gameObject.body.touching.down && this.body.touching.up;
  }

  destroy(fromScene) {
    this.movementTween?.remove();
    super.destroy(fromScene);
  }
}
