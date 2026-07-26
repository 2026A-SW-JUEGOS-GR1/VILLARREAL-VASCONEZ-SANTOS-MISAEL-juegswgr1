import Phaser from '../lib/phaser.js';
import { initAudio, applyMute } from '../systems/AudioManager.js';

/**
 * Primera escena del juego.
 *
 * Deliberadamente **no carga nada**. Recupera los ajustes de audio y cede el
 * paso a PreloadScene, y punto.
 *
 * Esto no es casual: una versión anterior cargaba aquí la música de la pantalla
 * de carga, para que pudiera sonar mientras se cargaba el resto. Pero si ese
 * archivo no termina de decodificarse —un navegador sin salida de audio, un MP3
 * corrupto—, `create()` nunca se ejecuta y **el juego entero se queda en negro
 * sin llegar a arrancar**. Ahora la música de carga se pide en PreloadScene como
 * cualquier otro asset y suena en cuanto llega, sin bloquear nada.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    initAudio();
    applyMute(this);

    // El juego es pixel art: desactivamos el suavizado en el contexto 2D por si
    // el renderer cae a Canvas (con WebGL lo cubre `pixelArt: true` del config).
    if (this.game.canvas) {
      this.game.canvas.style.imageRendering = 'pixelated';
    }

    this.scene.start('PreloadScene');
  }
}
