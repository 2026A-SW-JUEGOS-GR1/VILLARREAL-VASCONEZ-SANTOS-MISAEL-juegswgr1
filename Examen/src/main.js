import Phaser from './lib/phaser.js';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GRAVITY_Y,
  DEBUG_PHYSICS,
  UI,
} from './config/GameConfig.js';

import BootScene from './scenes/BootScene.js';
import PreloadScene from './scenes/PreloadScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import DialogueScene from './scenes/DialogueScene.js';
import TutorialScene from './scenes/TutorialScene.js';
import HUDScene from './scenes/HUDScene.js';
import BannerScene from './scenes/BannerScene.js';
import SandboxScene from './scenes/SandboxScene.js';
import Level1Scene from './scenes/Level1Scene.js';
import Level2Scene from './scenes/Level2Scene.js';
import Level3Scene from './scenes/Level3Scene.js';
import Level4Scene from './scenes/Level4Scene.js';

/**
 * Configuración de Phaser.Game.
 *
 * Las escenas se registran en el orden en que se declaran; la primera del array
 * (BootScene) arranca automáticamente. Los niveles y las escenas de diálogo,
 * tutorial y HUD se añaden a este array en los pasos siguientes del plan.
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game',

  // Resolución interna fija que se escala a la ventana.
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: UI.colors.background,

  // Los assets son pixel art 16-bit: sin interpolación al escalar.
  pixelArt: true,

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GRAVITY_Y },
      // Nunca activado por defecto: se enciende con ?debug=1 en la URL.
      debug: DEBUG_PHYSICS,
    },
  },

  /**
   * La primera escena del array arranca sola. HUDScene y BannerScene no se
   * inician nunca por su cuenta: se lanzan en paralelo sobre el nivel.
   * SandboxScene es solo para desarrollo (`?scene=SandboxScene`).
   */
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    LevelSelectScene,
    DialogueScene,
    TutorialScene,
    Level1Scene,
    Level2Scene,
    Level3Scene,
    Level4Scene,
    SandboxScene,
    HUDScene,
    BannerScene,
  ],
};

const game = new Phaser.Game(config);

// Si llegamos aquí, Phaser arrancó: quitamos el mensaje de arranque del HTML.
document.getElementById('boot-message')?.remove();

export default game;
