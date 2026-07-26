import Phaser from '../lib/phaser.js';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config/GameConfig.js';
import { getLevel } from '../config/LevelConfig.js';
import { getDialogue } from '../config/DialogueScripts.js';
import { goToTutorial } from '../systems/LevelFlow.js';
import { isPlaceholder } from '../systems/PlaceholderFactory.js';
import { playMusic } from '../systems/AudioManager.js';

/** Velocidad del efecto de máquina de escribir, en ms por carácter. */
const TYPE_SPEED_MS = 22;

/** Alto de la caja de diálogo. */
const BOX_HEIGHT = 150;

/**
 * Diálogo previo al nivel, estilo novela visual.
 *
 * Reutilizable: recibe `levelId` y saca su guion de DialogueScripts.js. El
 * retrato del personaje que habla se ilumina y se coloca a un lado u otro.
 */
export default class DialogueScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DialogueScene' });
  }

  init(data) {
    this.levelId = data.levelId;
    this.level = getLevel(this.levelId);
    this.lines = getDialogue(this.levelId);

    this.index = 0;
    /** true mientras se está revelando el texto carácter a carácter. */
    this.isTyping = false;
    this.typeEvent = null;
  }

  create() {
    // Sin guion no hay nada que mostrar: seguimos al tutorial.
    if (this.lines.length === 0) {
      goToTutorial(this, this.levelId);
      return;
    }

    playMusic(this, 'music_dialogue');
    this.buildBackground();
    this.buildPortraits();
    this.buildTextBox();
    this.bindAdvance();
    this.showLine(0);
  }

  // -------------------------------------------------------------------------
  // Construcción
  // -------------------------------------------------------------------------

  buildBackground() {
    // Telón de fondo: la primera capa de parallax del nivel que tenga arte real.
    // Se comprueba porque no todas las capas existen todavía, y un placeholder
    // bajo el velo oscuro dejaría la escena en negro.
    const backgroundKey = (this.level?.backgrounds ?? []).find(
      (key) => key && !isPlaceholder(this, key),
    );

    if (backgroundKey) {
      this.add
        .image(0, 0, backgroundKey)
        .setOrigin(0, 0)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    }

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72).setOrigin(0, 0);

    this.add
      .text(GAME_WIDTH / 2, 26, `${this.level?.name ?? ''} — ${this.level?.subtitle ?? ''}`, {
        fontFamily: UI.fonts.family,
        fontSize: '15px',
        color: UI.colors.textDim,
      })
      .setOrigin(0.5);
  }

  buildPortraits() {
    const portraitY = (GAME_HEIGHT - BOX_HEIGHT) / 2 + 10;
    const size = 210;

    // Drago a la izquierda, Nadia a la derecha.
    this.portraits = {
      drago: this.add
        .image(150, portraitY, 'drago_portrait')
        .setDisplaySize(size, size)
        .setOrigin(0.5),
      nadia: this.add
        .image(GAME_WIDTH - 150, portraitY, 'nadia_portrait')
        .setDisplaySize(size, size)
        .setOrigin(0.5),
    };
  }

  buildTextBox() {
    const boxY = GAME_HEIGHT - BOX_HEIGHT;

    this.add
      .rectangle(0, boxY, GAME_WIDTH, BOX_HEIGHT, UI.colors.panel, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(2, UI.colors.panelBorder);

    this.speakerText = this.add.text(28, boxY + 16, '', {
      fontFamily: UI.fonts.family,
      fontSize: '17px',
      fontStyle: 'bold',
      color: UI.colors.accent,
    });

    this.bodyText = this.add.text(28, boxY + 46, '', {
      fontFamily: UI.fonts.family,
      fontSize: '16px',
      color: UI.colors.text,
      lineSpacing: 6,
      wordWrap: { width: GAME_WIDTH - 56 },
    });

    this.hintText = this.add
      .text(GAME_WIDTH - 24, GAME_HEIGHT - 22, '', {
        fontFamily: UI.fonts.family,
        fontSize: '12px',
        color: UI.colors.textDim,
      })
      .setOrigin(1, 0.5);
  }

  bindAdvance() {
    ['keydown-SPACE', 'keydown-J', 'keydown-ENTER'].forEach((event) => {
      this.input.keyboard.on(event, () => this.advance());
    });

    this.input.on('pointerdown', () => this.advance());

    // ESC salta todo el diálogo.
    this.input.keyboard.on('keydown-ESC', () => this.finish());
  }

  // -------------------------------------------------------------------------
  // Reproducción del guion
  // -------------------------------------------------------------------------

  showLine(index) {
    const line = this.lines[index];

    this.speakerText.setText(line.speaker === 'nadia' ? 'NADIA' : 'DRAGO');

    // Solo el que habla se ve a plena luz.
    Object.entries(this.portraits).forEach(([name, portrait]) => {
      const speaking = name === line.speaker;
      portrait.setAlpha(speaking ? 1 : 0.35);
      portrait.setTint(speaking ? 0xffffff : 0x666677);
    });

    this.typeLine(line.text);
  }

  /** Revela el texto carácter a carácter. */
  typeLine(text) {
    this.isTyping = true;
    this.bodyText.setText('');
    this.hintText.setText('');

    let revealed = 0;

    this.typeEvent?.remove();
    this.typeEvent = this.time.addEvent({
      delay: TYPE_SPEED_MS,
      repeat: text.length - 1,
      callback: () => {
        revealed += 1;
        this.bodyText.setText(text.slice(0, revealed));

        if (revealed >= text.length) this.finishTyping();
      },
    });
  }

  finishTyping() {
    this.isTyping = false;
    this.typeEvent?.remove();
    this.typeEvent = null;

    const isLast = this.index === this.lines.length - 1;
    this.hintText.setText(isLast ? 'ESPACIO para continuar  ·  ESC para saltar' : 'ESPACIO ▸');
  }

  /**
   * Si el texto sigue escribiéndose, lo completa de golpe; si ya está completo,
   * pasa a la línea siguiente. Es el comportamiento habitual en novela visual.
   */
  advance() {
    if (this.isTyping) {
      this.bodyText.setText(this.lines[this.index].text);
      this.finishTyping();
      return;
    }

    this.index += 1;

    if (this.index >= this.lines.length) {
      this.finish();
      return;
    }

    this.showLine(this.index);
  }

  finish() {
    this.typeEvent?.remove();
    goToTutorial(this, this.levelId);
  }
}
