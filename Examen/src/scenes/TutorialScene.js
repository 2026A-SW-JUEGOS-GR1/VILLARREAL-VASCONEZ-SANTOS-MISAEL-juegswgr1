import Phaser from '../lib/phaser.js';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config/GameConfig.js';
import { getLevel } from '../config/LevelConfig.js';
import { getTutorial } from '../config/TutorialScripts.js';
import { goToLevel } from '../systems/LevelFlow.js';
import { isPlaceholder } from '../systems/PlaceholderFactory.js';
import { playMusic } from '../systems/AudioManager.js';

/**
 * Paneles de tutorial específicos de cada nivel.
 *
 * Reutilizable: recibe `levelId` y saca sus paneles de TutorialScripts.js. Cada
 * panel muestra título, explicación y las teclas implicadas como "chips".
 */
export default class TutorialScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TutorialScene' });
  }

  init(data) {
    this.levelId = data.levelId;
    this.level = getLevel(this.levelId);
    this.panels = getTutorial(this.levelId);
    this.index = 0;

    /** Objetos del panel actual, para destruirlos al pasar al siguiente. */
    this.panelObjects = [];
  }

  create() {
    if (this.panels.length === 0) {
      goToLevel(this, this.levelId);
      return;
    }

    playMusic(this, 'music_tutorial');
    this.buildFrame();
    this.bindAdvance();
    this.showPanel(0);
  }

  // -------------------------------------------------------------------------
  // Marco fijo (no cambia entre paneles)
  // -------------------------------------------------------------------------

  buildFrame() {
    // Primera capa con arte real: ver la nota en DialogueScene.
    const backgroundKey = (this.level?.backgrounds ?? []).find(
      (key) => key && !isPlaceholder(this, key),
    );

    if (backgroundKey) {
      this.add
        .image(0, 0, backgroundKey)
        .setOrigin(0, 0)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    }

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0, 0);

    this.add
      .text(GAME_WIDTH / 2, 34, (this.level?.name ?? '').toUpperCase(), {
        fontFamily: UI.fonts.family,
        fontSize: '15px',
        color: UI.colors.textDim,
      })
      .setOrigin(0.5);

    // Panel central donde se dibuja cada paso.
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 700, 320, UI.colors.panel, 0.95)
      .setStrokeStyle(2, UI.colors.panelBorder);

    this.progressText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 52, '', {
        fontFamily: UI.fonts.family,
        fontSize: '13px',
        color: UI.colors.textDim,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 28, 'ESPACIO para continuar  ·  ESC para saltar', {
        fontFamily: UI.fonts.family,
        fontSize: '12px',
        color: UI.colors.textDim,
      })
      .setOrigin(0.5);
  }

  bindAdvance() {
    ['keydown-SPACE', 'keydown-J', 'keydown-ENTER'].forEach((event) => {
      this.input.keyboard.on(event, () => this.advance());
    });

    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard.on('keydown-ESC', () => this.finish());
  }

  // -------------------------------------------------------------------------
  // Contenido de cada panel
  // -------------------------------------------------------------------------

  showPanel(index) {
    this.clearPanel();

    const panel = this.panels[index];
    const centerX = GAME_WIDTH / 2;
    const panelTop = GAME_HEIGHT / 2 - 160;

    this.panelObjects.push(
      this.add
        .text(centerX, panelTop + 40, panel.title, {
          fontFamily: UI.fonts.family,
          fontSize: '24px',
          fontStyle: 'bold',
          color: UI.colors.accent,
        })
        .setOrigin(0.5),
    );

    this.panelObjects.push(
      this.add
        .text(centerX, panelTop + 130, panel.lines.join('\n'), {
          fontFamily: UI.fonts.family,
          fontSize: '15px',
          color: UI.colors.text,
          align: 'center',
          lineSpacing: 9,
          wordWrap: { width: 620 },
        })
        .setOrigin(0.5),
    );

    if (panel.keys?.length) {
      this.buildKeyChips(panel.keys, centerX, panelTop + 250);
    }

    this.progressText.setText(`Paso ${index + 1} de ${this.panels.length}`);

    // Pequeño fundido de entrada para que se note el cambio de panel.
    this.panelObjects.forEach((object) => {
      object.setAlpha(0);
      this.tweens.add({ targets: object, alpha: 1, duration: 180 });
    });
  }

  /** Dibuja las teclas del panel como recuadros centrados. */
  buildKeyChips(keys, centerX, y) {
    const chipHeight = 30;
    const gap = 10;

    // Anchura proporcional al texto (fuente monoespaciada) con un mínimo.
    const widths = keys.map((key) => Math.max(38, key.length * 11 + 18));
    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + gap * (keys.length - 1);

    let x = centerX - totalWidth / 2;

    keys.forEach((key, i) => {
      const width = widths[i];

      const chip = this.add
        .rectangle(x, y, width, chipHeight, 0x000000, 0.55)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, UI.colors.panelBorder);

      const label = this.add
        .text(x + width / 2, y, key, {
          fontFamily: UI.fonts.family,
          fontSize: '13px',
          fontStyle: 'bold',
          color: UI.colors.info,
        })
        .setOrigin(0.5);

      this.panelObjects.push(chip, label);
      x += width + gap;
    });
  }

  clearPanel() {
    this.panelObjects.forEach((object) => object.destroy());
    this.panelObjects = [];
  }

  // -------------------------------------------------------------------------
  // Navegación
  // -------------------------------------------------------------------------

  advance() {
    this.index += 1;

    if (this.index >= this.panels.length) {
      this.finish();
      return;
    }

    this.showPanel(this.index);
  }

  finish() {
    goToLevel(this, this.levelId);
  }
}
