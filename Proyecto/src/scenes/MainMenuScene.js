import Phaser from '../lib/phaser.js';
import { GAME_WIDTH, GAME_HEIGHT, UI, DEBUG_PHYSICS } from '../config/GameConfig.js';
import { isPlaceholder, placeholderCount } from '../systems/PlaceholderFactory.js';
import SaveManager from '../systems/SaveManager.js';
import { playMusic, toggleMute, isMuted } from '../systems/AudioManager.js';

/**
 * Menú principal. Navegable con teclado (W/S o flechas + ESPACIO) y con ratón.
 */
export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  init() {
    this.selectedIndex = 0;
    /** Cuando hay un panel superpuesto, el menú no responde a la navegación. */
    this.overlayOpen = false;
    this.overlay = null;
  }

  create() {
    playMusic(this, 'music_menu');
    this.buildBackground();
    this.buildTitle();
    this.buildMenu();
    this.buildFooter();
    this.bindKeyboard();
  }

  // -------------------------------------------------------------------------
  // Construcción de la pantalla
  // -------------------------------------------------------------------------

  buildBackground() {
    this.add
      .image(0, 0, 'menu_background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    // Velo oscuro para que el texto se lea sobre cualquier fondo.
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setOrigin(0, 0);
  }

  buildTitle() {
    const centerX = GAME_WIDTH / 2;

    // Mientras logo.png no exista, el placeholder sería un rectángulo con la
    // palabra "LOGO": queda mejor rotular el título como texto.
    if (isPlaceholder(this, 'logo')) {
      this.add
        .text(centerX, 96, 'KILLING TIME', {
          fontFamily: UI.fonts.family,
          fontSize: '58px',
          fontStyle: 'bold',
          color: UI.colors.accent,
        })
        .setOrigin(0.5);

      this.add
        .text(centerX, 142, 'La línea del tiempo está rota', {
          fontFamily: UI.fonts.family,
          fontSize: '16px',
          color: UI.colors.textDim,
        })
        .setOrigin(0.5);
    } else {
      // Se escala por ancho y se deja que el alto salga de la proporción real de
      // la imagen: fijar ambos lados la aplastaría, porque el logo entregado no
      // tiene la proporción 2:1 que pedía el documento de arte.
      const logo = this.add.image(centerX, 128, 'logo');
      logo.setScale(460 / logo.width);
    }
  }

  buildMenu() {
    const items = [
      { label: 'JUGAR', action: () => this.scene.start('LevelSelectScene') },
      { label: 'CONTROLES', action: () => this.openControls() },
      { label: soundLabel(), action: () => this.toggleSound() },
      { label: 'BORRAR PROGRESO', action: () => this.confirmResetProgress() },
    ];

    const startY = 250;
    const spacing = 52;

    this.menuItems = items.map((item, index) => {
      const text = this.add
        .text(GAME_WIDTH / 2, startY + index * spacing, item.label, {
          fontFamily: UI.fonts.family,
          fontSize: '28px',
          fontStyle: 'bold',
          color: UI.colors.textDim,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      text.on('pointerover', () => {
        if (!this.overlayOpen) this.select(index);
      });
      text.on('pointerdown', () => {
        if (!this.overlayOpen) this.activate(index);
      });

      return { ...item, text };
    });

    this.select(0);
  }

  /** Alterna el silencio y actualiza la etiqueta del menú. */
  toggleSound() {
    toggleMute(this);
    this.menuItems[this.selectedIndex].text.setText(soundLabel());
  }

  buildFooter() {
    this.footerText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 54, '', {
        fontFamily: UI.fonts.family,
        fontSize: '12px',
        color: UI.colors.textDim,
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5);

    this.refreshFooter();
  }

  /** Reescribe el pie de pantalla (el progreso puede cambiar en caliente). */
  refreshFooter() {
    const lines = [
      'W/S o flechas para moverte  ·  ESPACIO para elegir',
      `Niveles superados: ${SaveManager.completedCount()}/4`,
    ];

    const pending = placeholderCount(this);
    if (pending > 0) {
      lines.push(`${pending} assets aún son placeholder (ver consola)`);
    }
    if (DEBUG_PHYSICS) {
      lines.push('DEBUG DE FÍSICAS ACTIVO (?debug=1)');
    }

    this.footerText.setText(lines.join('\n'));
  }

  // -------------------------------------------------------------------------
  // Navegación
  // -------------------------------------------------------------------------

  bindKeyboard() {
    const keyboard = this.input.keyboard;

    keyboard.on('keydown-W', () => this.move(-1));
    keyboard.on('keydown-UP', () => this.move(-1));
    keyboard.on('keydown-S', () => this.move(1));
    keyboard.on('keydown-DOWN', () => this.move(1));

    // Confirmar: ESPACIO (salto), J (disparo) y ENTER, para que funcione con
    // cualquiera de las teclas que el jugador ya tiene bajo los dedos.
    ['keydown-SPACE', 'keydown-ENTER', 'keydown-J'].forEach((event) => {
      keyboard.on(event, () => this.activate(this.selectedIndex));
    });

    keyboard.on('keydown-ESC', () => this.closeOverlay());
  }

  move(delta) {
    if (this.overlayOpen) return;

    const count = this.menuItems.length;
    // El módulo con `+ count` mantiene el índice positivo al subir desde 0.
    this.select((this.selectedIndex + delta + count) % count);
  }

  select(index) {
    this.selectedIndex = index;

    this.menuItems.forEach((item, i) => {
      const selected = i === index;
      item.text.setColor(selected ? UI.colors.accent : UI.colors.textDim);
      item.text.setScale(selected ? 1.08 : 1);
    });
  }

  activate(index) {
    if (this.overlayOpen) {
      this.closeOverlay();
      return;
    }
    this.menuItems[index].action();
  }

  // -------------------------------------------------------------------------
  // Paneles superpuestos
  // -------------------------------------------------------------------------

  /** Crea el contenedor base de un panel modal y devuelve el contenedor. */
  createOverlay(title, body) {
    this.overlayOpen = true;

    const panelWidth = 560;
    const panelHeight = 340;
    const container = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const backdrop = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setInteractive();
    backdrop.on('pointerdown', () => this.closeOverlay());

    const panel = this.add
      .rectangle(0, 0, panelWidth, panelHeight, UI.colors.panel, 0.97)
      .setStrokeStyle(2, UI.colors.panelBorder);

    const titleText = this.add
      .text(0, -panelHeight / 2 + 28, title, {
        fontFamily: UI.fonts.family,
        fontSize: '22px',
        fontStyle: 'bold',
        color: UI.colors.accent,
      })
      .setOrigin(0.5);

    const bodyText = this.add
      .text(0, 6, body, {
        fontFamily: UI.fonts.family,
        fontSize: '15px',
        color: UI.colors.text,
        align: 'left',
        lineSpacing: 7,
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(0, panelHeight / 2 - 24, 'ESC o clic para cerrar', {
        fontFamily: UI.fonts.family,
        fontSize: '12px',
        color: UI.colors.textDim,
      })
      .setOrigin(0.5);

    // El contenedor está en el centro de la pantalla y el backdrop tiene origen
    // 0.5, así que en local (0,0) cubre exactamente todo el viewport.
    container.add([backdrop, panel, titleText, bodyText, hint]);
    container.setDepth(100);

    this.overlay = container;
    return container;
  }

  openControls() {
    const rows = [
      ['Mover',                 'A / D'],
      ['Apuntar arriba/abajo',  'W / S'],
      ['Saltar',                'ESPACIO'],
      ['Disparar',              'J'],
      ['Interactuar',           'E'],
      ['Doble salto (nivel 2)', 'ESPACIO x2 en el aire'],
      ['Dash (nivel 3)',        'SHIFT'],
      ['Pausa',                 'ESC'],
    ];

    // Alineamos las dos columnas con relleno de espacios (fuente monoespaciada).
    const labelWidth = Math.max(...rows.map(([label]) => label.length));
    const body = rows
      .map(([label, key]) => `${label.padEnd(labelWidth + 2, ' ')}${key}`)
      .join('\n');

    this.createOverlay('CONTROLES', body);
  }

  confirmResetProgress() {
    SaveManager.reset();
    this.refreshFooter();
    this.createOverlay(
      'PROGRESO BORRADO',
      'Se ha eliminado el registro de niveles superados.\n\n' +
        'El selector volverá a mostrar los 4 escenarios\ncomo pendientes.',
    );
  }

  closeOverlay() {
    if (!this.overlayOpen) return;

    this.overlay.destroy();
    this.overlay = null;
    this.overlayOpen = false;
  }
}

/** Etiqueta del menú según el estado de silencio. */
function soundLabel() {
  return isMuted() ? 'SONIDO: OFF' : 'SONIDO: ON';
}
