import Phaser from '../lib/phaser.js';
import { LEVEL4 } from '../config/GameConfig.js';

/**
 * Medidas tomadas del propio arte (`assets/hazards/pendulum_axe.png`, 80x160),
 * midiendo el alpha fila por fila: la cadena ocupa de y=0 a y=116 con unos 12 px
 * de ancho, y el filo va de y=117 a y=154 ensanchándose hasta 77 px.
 */
const ART = {
  height: 160,
  /** Centro vertical del filo dentro de la imagen. */
  bladeCenterY: 136,
  /** Radio del filo. Se usa el semialto (19) con un poco de margen. */
  bladeRadius: 22,
};

/** Escala con la que se dibuja el hacha. Ajustar esto reescala todo a la vez. */
const SCALE = 0.95;

/** Distancia del pivote al centro del filo, ya escalada. */
const BLADE_DISTANCE = ART.bladeCenterY * SCALE;
/** Radio del hitbox, ya escalado. */
const HITBOX_RADIUS = Math.round(ART.bladeRadius * SCALE);

/**
 * Hacha péndulo (nivel 4).
 *
 * Separa lo que se ve de lo que golpea, y eso es toda la idea:
 *
 *  - **Visual**: la imagen completa (cadena + hacha) con el origen en su extremo
 *    superior, de modo que un tween de ángulo la hace oscilar como un péndulo
 *    colgado del techo.
 *  - **Hitbox**: un cuerpo circular invisible que solo cubre el filo, cuya
 *    posición se recalcula cada frame por trigonometría desde el pivote.
 *
 * Hace falta separarlos porque los cuerpos de Arcade Physics NO rotan: si se
 * usara el cuerpo de la imagen, la caja seguiría siendo un rectángulo vertical
 * enorme y la cadena mataría igual que el filo. La especificación pide
 * explícitamente que golpee el hacha y no la cadena.
 *
 * El hitbox es un `Zone` de exactamente 2·radio de lado, y no un sprite, por un
 * motivo concreto: `body.setCircle(r)` sin offsets deja el círculo pegado a la
 * esquina superior izquierda del cuerpo. Sobre un sprite de 80x160 eso desplazaba
 * la zona de daño 54 px hacia arriba —al centro de la cadena, no al filo—, que es
 * justo lo que hacía que las hachas parecieran no funcionar. Con un Zone del
 * tamaño exacto del círculo, el offset por defecto ya lo deja centrado.
 */
export default class PendulumAxe {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} pivotX
   * @param {number} pivotY Altura del techo del que cuelga.
   * @param {number} [phase] Desfase 0-1 para que no oscilen todas al unísono.
   */
  constructor(scene, pivotX, pivotY, phase = 0) {
    this.scene = scene;
    this.pivotX = pivotX;
    this.pivotY = pivotY;

    // Origen arriba y al centro: el tween de ángulo lo hace pivotar desde ahí.
    this.visual = scene.add
      .image(pivotX, pivotY, 'pendulum_axe')
      .setOrigin(0.5, 0)
      .setScale(SCALE);

    this.hitbox = scene.add.zone(
      pivotX,
      pivotY + BLADE_DISTANCE,
      HITBOX_RADIUS * 2,
      HITBOX_RADIUS * 2,
    );
    scene.physics.add.existing(this.hitbox);
    this.hitbox.body.setAllowGravity(false);
    this.hitbox.body.setCircle(HITBOX_RADIUS);
    this.hitbox.body.setImmovable(true);

    this.createSwing(phase);
  }

  createSwing(phase) {
    const { angle, durationMs } = LEVEL4.pendulum;

    this.visual.setAngle(-angle);

    this.swingTween = this.scene.tweens.add({
      targets: this.visual,
      angle,
      duration: durationMs,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      // Arranca desfasado para desincronizar unas hachas de otras.
      delay: phase * durationMs,
    });
  }

  /**
   * Recoloca el hitbox bajo el extremo del hacha. Hay que llamarlo cada frame,
   * después de que los tweens hayan corrido.
   */
  update() {
    const radians = Phaser.Math.DegToRad(this.visual.angle);

    /*
     * El filo está en (0, BLADE_DISTANCE) respecto al pivote, o sea justo debajo.
     * Al rotarlo un ángulo `a`, Phaser lo lleva a (−d·sin a, d·cos a): con las Y
     * hacia abajo de la pantalla, un ángulo positivo (sentido horario) mueve el
     * punto hacia la IZQUIERDA.
     *
     * De ahí el signo negativo en la X, que es fácil de perder. Sin él el hitbox
     * quedaba reflejado: hacía daño en el lado opuesto al que se veía el hacha.
     * Se comprueba contrastando esta cuenta con `visual.getWorldTransformMatrix()`.
     */
    this.hitbox.body.reset(
      this.pivotX - Math.sin(radians) * BLADE_DISTANCE,
      this.pivotY + Math.cos(radians) * BLADE_DISTANCE,
    );
  }

  destroy() {
    this.swingTween?.remove();
    this.visual.destroy();
    this.hitbox.destroy();
  }
}
