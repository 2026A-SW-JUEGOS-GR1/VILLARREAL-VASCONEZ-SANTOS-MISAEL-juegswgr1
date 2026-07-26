import Phaser from '../lib/phaser.js';

/**
 * Centraliza el mapa de teclas del juego.
 *
 * Todo el código de juego pregunta por *acciones* (`input.left`, `input.pressedJump()`)
 * y nunca por teclas concretas. Así el esquema de control vive en un solo sitio
 * y se puede reasignar sin tocar entidades ni escenas.
 *
 * Esquema (sección 2 de la especificación), con las flechas como alternativa
 * para quien prefiera jugar con ellas:
 *
 *   A / D  o  ← / →   mover
 *   W / S  o  ↑ / ↓   apuntar arriba / abajo
 *   ESPACIO           saltar (doble pulsación en el aire = doble salto)
 *   J                 disparar
 *   E                 interactuar
 *   SHIFT             dash
 *   ESC               pausa
 */
export default class InputManager {
  constructor(scene) {
    this.scene = scene;

    // enableCapture evita que ESPACIO y las flechas hagan scroll en la página.
    this.keys = scene.input.keyboard.addKeys(
      {
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
        shoot: Phaser.Input.Keyboard.KeyCodes.J,
        interact: Phaser.Input.Keyboard.KeyCodes.E,
        dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
        pause: Phaser.Input.Keyboard.KeyCodes.ESC,
      },
      true,
    );

    this.cursors = scene.input.keyboard.createCursorKeys();
  }

  // --- Estados continuos -----------------------------------------------------

  get left() {
    return this.keys.left.isDown || this.cursors.left.isDown;
  }

  get right() {
    return this.keys.right.isDown || this.cursors.right.isDown;
  }

  get aimUp() {
    return this.keys.up.isDown || this.cursors.up.isDown;
  }

  get aimDown() {
    return this.keys.down.isDown || this.cursors.down.isDown;
  }

  get shootHeld() {
    return this.keys.shoot.isDown;
  }

  // --- Pulsaciones (solo el frame en que se presiona) ------------------------

  pressedJump() {
    return Phaser.Input.Keyboard.JustDown(this.keys.jump);
  }

  pressedShoot() {
    return Phaser.Input.Keyboard.JustDown(this.keys.shoot);
  }

  pressedInteract() {
    return Phaser.Input.Keyboard.JustDown(this.keys.interact);
  }

  pressedDash() {
    return Phaser.Input.Keyboard.JustDown(this.keys.dash);
  }

  pressedPause() {
    return Phaser.Input.Keyboard.JustDown(this.keys.pause);
  }
}
