import Phaser from '../lib/phaser.js';
import { LEVEL4 } from '../config/GameConfig.js';

/**
 * Plataforma de impulso de aire (nivel 4).
 *
 * Es sólida: te puedes quedar de pie encima. Cada 3 segundos suelta una ráfaga
 * que lanza hacia arriba a quien esté sobre ella en ese instante.
 *
 * Lo importante del diseño es el **aviso previo**: durante los 600 ms anteriores
 * las runas brillan y la plataforma vibra, para que el impulso se pueda anticipar
 * en lugar de sorprender. Sin ese aviso, una plataforma que te lanza sin motivo
 * aparente se lee como un fallo, no como una mecánica.
 */
export default class AirPlatform extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    super(scene, x, y, 'air_platform');

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // cuerpo estático

    this.setDisplaySize(128, 48);
    this.refreshBody();

    /** Momento del próximo impulso. */
    this.nextBlastAt = scene.time.now + LEVEL4.airPlatformIntervalMs;
    this.isTelegraphing = false;
  }

  /**
   * @param {number} now Reloj de la escena.
   * @param {Player} player
   * @returns {boolean} true si acaba de lanzar al jugador.
   */
  update(now, player) {
    const telegraphStart = this.nextBlastAt - LEVEL4.airPlatformTelegraphMs;

    // Fase de aviso.
    if (!this.isTelegraphing && now >= telegraphStart) {
      this.isTelegraphing = true;
      this.startTelegraph();
    }

    if (now < this.nextBlastAt) return false;

    // Ráfaga.
    this.nextBlastAt = now + LEVEL4.airPlatformIntervalMs;
    this.isTelegraphing = false;
    this.clearTint();

    if (!this.isCarrying(player)) return false;

    player.setVelocityY(LEVEL4.airPlatformVelocity);
    return true;
  }

  startTelegraph() {
    this.setTint(0x9fe8ff);

    this.scene.tweens.add({
      targets: this,
      scaleY: { from: this.scaleY, to: this.scaleY * 0.82 },
      duration: LEVEL4.airPlatformTelegraphMs / 3,
      yoyo: true,
      repeat: 1,
    });
  }

  /** ¿Hay alguien apoyado encima ahora mismo? */
  isCarrying(gameObject) {
    return gameObject.body.touching.down && this.body.touching.up;
  }
}
