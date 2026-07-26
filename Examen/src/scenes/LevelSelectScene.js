import Phaser from '../lib/phaser.js';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config/GameConfig.js';
import { LEVELS } from '../config/LevelConfig.js';
import SaveManager from '../systems/SaveManager.js';
import { startLevelFlow } from '../systems/LevelFlow.js';
import { playMusic } from '../systems/AudioManager.js';

/** Geometría de las fichas de nivel. */
const CARD = { width: 210, height: 320, gap: 18, top: 150 };

/**
 * Selector de escenario. Muestra una ficha por nivel con su objetivo, vidas y
 * mecánicas, y marca los que ya se han superado.
 *
 * Al confirmar, arranca el flujo del nivel: DialogueScene → TutorialScene →
 * banner GAME START → LevelXScene. Mientras esas escenas no existan todavía
 * (se implementan en los pasos 2 y 3 del plan), avisa en pantalla en lugar de
 * fallar.
 */
export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  init(data) {
    this.selectedIndex = 0;
    this.cards = [];
    this.toast = null;
    /** Mensaje que puede traer quien nos devuelve aquí (nivel no implementado). */
    this.notice = data?.notice ?? null;
  }

  create() {
    playMusic(this, 'music_level_select');
    this.buildBackground();
    this.buildHeader();
    this.buildCards();
    this.bindKeyboard();
    this.select(0);

    if (this.notice) this.showToast(this.notice);
  }

  // -------------------------------------------------------------------------
  // Construcción
  // -------------------------------------------------------------------------

  buildBackground() {
    this.add
      .image(0, 0, 'level_select_background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.62)
      .setOrigin(0, 0);
  }

  buildHeader() {
    this.add
      .text(GAME_WIDTH / 2, 52, 'SELECCIONA UN ESCENARIO', {
        fontFamily: UI.fonts.family,
        fontSize: '28px',
        fontStyle: 'bold',
        color: UI.colors.accent,
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        86,
        'A/D o flechas para elegir  ·  ESPACIO para entrar  ·  ESC para volver',
        {
          fontFamily: UI.fonts.family,
          fontSize: '12px',
          color: UI.colors.textDim,
        },
      )
      .setOrigin(0.5);
  }

  buildCards() {
    const totalWidth = LEVELS.length * CARD.width + (LEVELS.length - 1) * CARD.gap;
    const startX = (GAME_WIDTH - totalWidth) / 2 + CARD.width / 2;
    const centerY = CARD.top + CARD.height / 2;

    this.cards = LEVELS.map((level, index) => {
      const x = startX + index * (CARD.width + CARD.gap);
      return this.buildCard(level, index, x, centerY);
    });
  }

  /** Construye una ficha de nivel como contenedor con posiciones locales. */
  buildCard(level, index, x, y) {
    const container = this.add.container(x, y);
    const halfHeight = CARD.height / 2;
    const completed = SaveManager.isCompleted(level.id);

    const background = this.add
      .rectangle(0, 0, CARD.width, CARD.height, UI.colors.panel, 0.92)
      .setStrokeStyle(2, UI.colors.panelBorder)
      .setInteractive({ useHandCursor: true });

    background.on('pointerover', () => this.select(index));
    background.on('pointerdown', () => this.activate(index));

    // Franja superior con el color de la época.
    const accentBar = this.add
      .rectangle(0, -halfHeight + 3, CARD.width - 4, 6, level.accent)
      .setOrigin(0.5);

    const number = this.add
      .text(0, -halfHeight + 34, String(level.id), {
        fontFamily: UI.fonts.family,
        fontSize: '30px',
        fontStyle: 'bold',
        color: UI.colors.text,
      })
      .setOrigin(0.5);

    const name = this.add
      .text(0, -halfHeight + 72, level.name, {
        fontFamily: UI.fonts.family,
        fontSize: '15px',
        fontStyle: 'bold',
        color: UI.colors.text,
        align: 'center',
        wordWrap: { width: CARD.width - 24 },
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(0, -halfHeight + 94, level.subtitle, {
        fontFamily: UI.fonts.family,
        fontSize: '10px',
        fontStyle: 'italic',
        color: UI.colors.textDim,
        align: 'center',
        wordWrap: { width: CARD.width - 24 },
      })
      .setOrigin(0.5);

    // Vidas: un corazón por vida (el HUD del paso 2 usará icon_life.png).
    const lives = this.add
      .text(0, -halfHeight + 122, '♥'.repeat(level.lives), {
        fontFamily: UI.fonts.family,
        fontSize: '15px',
        color: UI.colors.danger,
      })
      .setOrigin(0.5);

    const objective = this.add
      .text(0, -halfHeight + 168, level.objective, {
        fontFamily: UI.fonts.family,
        fontSize: '11px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 3,
        wordWrap: { width: CARD.width - 28 },
      })
      .setOrigin(0.5);

    const mechanicsLabel = this.add
      .text(0, halfHeight - 96, 'MECÁNICAS', {
        fontFamily: UI.fonts.family,
        fontSize: '9px',
        fontStyle: 'bold',
        color: UI.colors.info,
      })
      .setOrigin(0.5);

    const mechanics = this.add
      .text(0, halfHeight - 62, level.mechanics.join('\n'), {
        fontFamily: UI.fonts.family,
        fontSize: '10px',
        color: UI.colors.textDim,
        align: 'center',
        lineSpacing: 3,
        wordWrap: { width: CARD.width - 28 },
      })
      .setOrigin(0.5);

    const status = this.add
      .text(0, halfHeight - 18, completed ? '✔ SUPERADO' : 'PENDIENTE', {
        fontFamily: UI.fonts.family,
        fontSize: '11px',
        fontStyle: 'bold',
        color: completed ? UI.colors.success : UI.colors.textDim,
      })
      .setOrigin(0.5);

    container.add([
      background,
      accentBar,
      number,
      name,
      subtitle,
      lives,
      objective,
      mechanicsLabel,
      mechanics,
      status,
    ]);

    return { level, container, background };
  }

  // -------------------------------------------------------------------------
  // Navegación
  // -------------------------------------------------------------------------

  bindKeyboard() {
    const keyboard = this.input.keyboard;

    keyboard.on('keydown-A', () => this.move(-1));
    keyboard.on('keydown-LEFT', () => this.move(-1));
    keyboard.on('keydown-D', () => this.move(1));
    keyboard.on('keydown-RIGHT', () => this.move(1));

    ['keydown-SPACE', 'keydown-ENTER', 'keydown-J'].forEach((event) => {
      keyboard.on(event, () => this.activate(this.selectedIndex));
    });

    // Atajo directo: teclas 1..4.
    LEVELS.forEach((_, index) => {
      keyboard.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR'][index]}`, () => {
        this.select(index);
        this.activate(index);
      });
    });

    keyboard.on('keydown-ESC', () => this.scene.start('MainMenuScene'));
  }

  move(delta) {
    const count = this.cards.length;
    this.select((this.selectedIndex + delta + count) % count);
  }

  select(index) {
    this.selectedIndex = index;

    this.cards.forEach((card, i) => {
      const selected = i === index;
      card.background.setStrokeStyle(
        selected ? 3 : 2,
        selected ? card.level.accent : UI.colors.panelBorder,
      );
      card.background.setFillStyle(UI.colors.panel, selected ? 1 : 0.92);
      card.container.setScale(selected ? 1.03 : 1);
    });
  }

  activate(index) {
    // El encadenado de escenas (diálogo → tutorial → nivel) y sus saltos cuando
    // alguna todavía no existe viven en LevelFlow.
    startLevelFlow(this, this.cards[index].level.id);
  }

  /** Aviso temporal en la parte baja de la pantalla. */
  showToast(message) {
    if (this.toast) this.toast.destroy();

    this.toast = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, message, {
        fontFamily: UI.fonts.family,
        fontSize: '13px',
        color: UI.colors.accent,
        align: 'center',
        backgroundColor: '#000000cc',
        padding: { x: 14, y: 8 },
        lineSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.tweens.add({
      targets: this.toast,
      alpha: { from: 1, to: 0 },
      delay: 1800,
      duration: 600,
      onComplete: () => {
        this.toast?.destroy();
        this.toast = null;
      },
    });
  }
}
