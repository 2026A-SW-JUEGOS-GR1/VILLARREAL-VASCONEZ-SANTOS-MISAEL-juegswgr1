import Phaser from '../lib/phaser.js';
import { LEVEL1 } from '../config/GameConfig.js';

/**
 * Margen sin contacto tras el cual se considera que el jugador se ha bajado.
 * Un par de frames: los flags de colisión pueden fallar puntualmente al andar.
 */
const RELEASE_GRACE_MS = 120;

/**
 * Losa de suelo falso (nivel 1).
 *
 * Es sólida hasta que Drago se apoya en ella. Entonces parpadea durante un
 * segundo y cede, dejándole caer al pozo de pinchos. Si se aparta antes de que
 * pase el segundo, la losa se recompone y vuelve a estar disponible.
 *
 * Se implementa como imagen con cuerpo estático: al ceder basta con desactivar
 * el cuerpo (`body.enable = false`) para que Drago la atraviese.
 */
export default class FakeFloor extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    super(scene, x, y, 'floor_rome_fake');

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // true = cuerpo estático

    /** ¿Está en cuenta atrás para ceder? */
    this.isCrumbling = false;
    /** ¿Ya cedió? */
    this.hasCollapsed = false;
    /** Último instante con contacto del jugador. */
    this.touchedAt = 0;

    this.crumbleTimer = null;
    this.blinkTween = null;
  }

  /**
   * Contacto de Drago. Arranca la cuenta atrás la primera vez y, mientras siga
   * pisando, refresca la marca de tiempo para que no se cancele.
   */
  touch(time) {
    if (this.hasCollapsed) return;

    this.touchedAt = time;
    if (this.isCrumbling) return;

    this.isCrumbling = true;

    // Parpadeo de aviso durante toda la cuenta atrás.
    this.blinkTween = this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.35 },
      duration: 110,
      yoyo: true,
      repeat: -1,
    });

    this.crumbleTimer = this.scene.time.delayedCall(LEVEL1.fakeFloorDelayMs, () =>
      this.collapse(),
    );
  }

  /**
   * Debe llamarse cada frame. Si el jugador dejó de pisarla antes de que venciera
   * el plazo, cancela el derrumbe y la losa se recompone.
   */
  update(time) {
    if (!this.isCrumbling || this.hasCollapsed) return;

    if (time - this.touchedAt > RELEASE_GRACE_MS) {
      this.cancelCrumble();
    }
  }

  cancelCrumble() {
    this.isCrumbling = false;

    this.crumbleTimer?.remove();
    this.crumbleTimer = null;

    this.blinkTween?.remove();
    this.blinkTween = null;

    this.setAlpha(1);
  }

  collapse() {
    this.hasCollapsed = true;
    this.isCrumbling = false;

    this.blinkTween?.remove();
    this.blinkTween = null;

    // Deja de ser sólida y queda como resto translúcido.
    this.body.enable = false;
    this.setAlpha(0.2);
  }

  /** Devuelve la losa a su estado inicial (al reaparecer el jugador). */
  reset() {
    this.cancelCrumble();

    this.hasCollapsed = false;
    this.body.enable = true;
    this.setAlpha(1);
  }
}
