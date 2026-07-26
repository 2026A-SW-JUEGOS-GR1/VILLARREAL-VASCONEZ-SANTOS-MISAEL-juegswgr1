import Phaser from '../lib/phaser.js';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config/GameConfig.js';
import { getLevel } from '../config/LevelConfig.js';

/** Medidas comunes de los widgets. */
const LAYOUT = {
  iconSize: 22,
  rowHeight: 30,
  marginX: 14,
  marginY: 14,
  barWidth: 84,
  barHeight: 8,
};

/**
 * Interfaz del juego, como escena paralela al nivel.
 *
 * Corre en paralelo (`scene.launch`) para que la UI no se vea afectada por la
 * cámara del nivel (zoom, scroll, sacudidas) ni por su pausa de físicas.
 *
 * Qué widgets se montan lo decide el array `hud` de cada nivel en
 * LevelConfig.js; los datos los lee cada frame de `levelScene.getHudState()`.
 * Ese contrato de una sola función mantiene el HUD desacoplado de la lógica.
 */
export default class HUDScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HUDScene' });
  }

  init(data) {
    /** Escena de nivel de la que se leen los datos. */
    this.levelScene = data.levelScene;
    // La escena de nivel pasa su ficha directamente; el id es solo un respaldo
    // (así el sandbox de pruebas puede traer una ficha sintética).
    this.level = data.level ?? getLevel(data.levelId);

    this.widgets = {};
    /** Altura ocupada en cada columna, para ir apilando widgets. */
    this.stackY = { left: LAYOUT.marginY, right: LAYOUT.marginY };
  }

  create() {
    const enabled = this.level?.hud ?? [];

    // Cada widget se monta solo si el nivel lo pide, en el orden declarado.
    const builders = {
      ammo: () => this.buildAmmo(),
      lives: () => this.buildLives(),
      objective: () => this.buildObjective(),
      timer: () => this.buildTimer(),
      shield: () => this.buildShield(),
      doubleJump: () => this.buildAbility('doubleJump', 'icon_double_jump', 'DOBLE SALTO'),
      dash: () => this.buildAbility('dash', 'icon_dash', 'DASH'),
      bleeding: () => this.buildBleeding(),
      bandages: () => this.buildBandages(),
      compass: () => this.buildCompass(),
    };

    enabled.forEach((name) => builders[name]?.());
  }

  update() {
    // El nivel puede haberse cerrado antes que el HUD.
    if (!this.levelScene?.scene?.isActive()) return;

    const state = this.levelScene.getHudState?.();
    if (!state) return;

    this.updateAmmo(state);
    this.updateLives(state);
    this.updateObjective(state);
    this.updateTimer(state);
    this.updateShield(state);
    this.updateAbility('doubleJump', state);
    this.updateAbility('dash', state);
    this.updateBleeding(state);
    this.updateBandages(state);
    this.updateCompass(state);
  }

  // -------------------------------------------------------------------------
  // Utilidades de maquetación
  // -------------------------------------------------------------------------

  /**
   * Reserva una fila en una de las columnas y devuelve sus coordenadas.
   * @param {'left'|'right'} side
   */
  nextRow(side) {
    const y = this.stackY[side];
    this.stackY[side] += LAYOUT.rowHeight;

    return {
      x: side === 'left' ? LAYOUT.marginX : GAME_WIDTH - LAYOUT.marginX,
      y,
      side,
    };
  }

  /** Icono del HUD a tamaño uniforme. */
  addIcon(x, y, key, side) {
    return this.add
      .image(x, y, key)
      .setDisplaySize(LAYOUT.iconSize, LAYOUT.iconSize)
      .setOrigin(side === 'left' ? 0 : 1, 0);
  }

  addLabel(x, y, side, style = {}) {
    return this.add
      .text(x, y + 3, '', {
        fontFamily: UI.fonts.family,
        fontSize: '14px',
        color: UI.colors.text,
        ...style,
      })
      .setOrigin(side === 'left' ? 0 : 1, 0);
  }

  /**
   * Barra de progreso horizontal. Se anima con scaleX (cambiar `width` en un
   * Shape de Phaser no regenera la geometría que se dibuja).
   */
  addBar(x, y, side, color) {
    const originX = side === 'left' ? 0 : 1;

    const track = this.add
      .rectangle(x, y + 7, LAYOUT.barWidth, LAYOUT.barHeight, 0x000000, 0.6)
      .setOrigin(originX, 0)
      .setStrokeStyle(1, UI.colors.panelBorder);

    const fill = this.add
      .rectangle(x, y + 7, LAYOUT.barWidth, LAYOUT.barHeight, color)
      .setOrigin(originX, 0);

    return { track, fill };
  }

  // -------------------------------------------------------------------------
  // Munición
  // -------------------------------------------------------------------------

  buildAmmo() {
    const row = this.nextRow('left');
    const icon = this.addIcon(row.x, row.y, 'icon_ammo', row.side);
    const text = this.addLabel(row.x + LAYOUT.iconSize + 8, row.y, row.side);
    const bar = this.addBar(row.x + LAYOUT.iconSize + 8, row.y + 14, row.side, 0xffc857);

    this.widgets.ammo = { icon, text, bar };
  }

  updateAmmo(state) {
    const widget = this.widgets.ammo;
    if (!widget || !state.ammo) return;

    const { current, magazineSize, isReloading, reloadProgress } = state.ammo;

    if (isReloading) {
      widget.text.setText('RECARGANDO').setColor(UI.colors.accent);
      widget.bar.track.setVisible(true);
      widget.bar.fill.setVisible(true);
      widget.bar.fill.scaleX = reloadProgress;
    } else {
      widget.text.setText(`${current}/${magazineSize}`);
      widget.text.setColor(current === 0 ? UI.colors.danger : UI.colors.text);
      widget.bar.track.setVisible(false);
      widget.bar.fill.setVisible(false);
    }
  }

  // -------------------------------------------------------------------------
  // Vidas
  // -------------------------------------------------------------------------

  buildLives() {
    const row = this.nextRow('left');
    this.widgets.lives = { row, icons: [], max: 0 };
  }

  updateLives(state) {
    const widget = this.widgets.lives;
    if (!widget || !state.lives) return;

    const { current, max } = state.lives;

    // Creamos los iconos la primera vez (el máximo puede subir con vendajes en
    // el nivel 3, así que también crecemos si hace falta).
    if (widget.icons.length < max) {
      for (let i = widget.icons.length; i < max; i++) {
        const x = widget.row.x + i * (LAYOUT.iconSize + 5);
        widget.icons.push(this.addIcon(x, widget.row.y, 'icon_life', 'left'));
      }
    }

    // Las vidas perdidas se atenúan en lugar de desaparecer: así el jugador ve
    // de un vistazo cuántas le quedan sobre cuántas posibles.
    widget.icons.forEach((icon, i) => {
      const alive = i < current;
      icon.setAlpha(alive ? 1 : 0.22);
    });
  }

  // -------------------------------------------------------------------------
  // Contador de objetivo (gemas, llaves...)
  // -------------------------------------------------------------------------

  buildObjective() {
    const row = this.nextRow('left');
    this.widgets.objective = {
      text: this.addLabel(row.x, row.y, row.side, {
        fontSize: '15px',
        fontStyle: 'bold',
        color: UI.colors.accent,
      }),
    };
  }

  updateObjective(state) {
    const widget = this.widgets.objective;
    if (!widget || !state.objective) return;

    const { label, current, total } = state.objective;
    widget.text.setText(`${label}: ${current}/${total}`);
  }

  // -------------------------------------------------------------------------
  // Temporizador (fase de supervivencia del nivel 2)
  // -------------------------------------------------------------------------

  buildTimer() {
    const row = this.nextRow('left');
    this.widgets.timer = {
      text: this.addLabel(row.x, row.y, row.side, {
        fontSize: '16px',
        fontStyle: 'bold',
        color: UI.colors.info,
      }),
    };
  }

  updateTimer(state) {
    const widget = this.widgets.timer;
    if (!widget || !state.timer) return;

    // El nivel puede sustituir la cuenta por un mensaje (fase 2 del nivel 2).
    if (state.timer.text) {
      widget.text.setText(state.timer.text);
      return;
    }

    const seconds = Math.ceil(state.timer.remainingMs / 1000);
    widget.text.setText(`${state.timer.label}: ${seconds}s`);
  }

  // -------------------------------------------------------------------------
  // Escudo térmico (nivel 2) — sustituye a las vidas
  // -------------------------------------------------------------------------

  buildShield() {
    const row = this.nextRow('right');
    const icon = this.addIcon(row.x, row.y, 'icon_shield', row.side);
    const bar = this.addBar(row.x - LAYOUT.iconSize - 8, row.y, row.side, 0xffa726);
    const text = this.addLabel(row.x - LAYOUT.iconSize - LAYOUT.barWidth - 16, row.y, row.side, {
      fontSize: '13px',
    });

    this.widgets.shield = { icon, bar, text };
  }

  updateShield(state) {
    const widget = this.widgets.shield;
    if (!widget || !state.shield) return;

    const { remainingMs, totalMs, inGrace } = state.shield;

    widget.bar.fill.scaleX = Phaser.Math.Clamp(remainingMs / totalMs, 0, 1);
    widget.text.setText(`${Math.ceil(remainingMs / 1000)}s`);

    // Durante los 2 s de gracia el escudo parpadea en rojo.
    if (inGrace) {
      const blink = Math.floor(this.time.now / 150) % 2 === 0;
      widget.bar.fill.setFillStyle(blink ? 0xe5484d : 0x7a1d20);
      widget.text.setColor(UI.colors.danger);
      widget.icon.setAlpha(blink ? 1 : 0.35);
    } else {
      widget.bar.fill.setFillStyle(0xffa726);
      widget.text.setColor(UI.colors.text);
      widget.icon.setAlpha(1);
    }
  }

  // -------------------------------------------------------------------------
  // Habilidades con cooldown (doble salto / dash)
  // -------------------------------------------------------------------------

  buildAbility(name, iconKey, label) {
    const row = this.nextRow('right');
    const icon = this.addIcon(row.x, row.y, iconKey, row.side);
    const bar = this.addBar(row.x - LAYOUT.iconSize - 8, row.y, row.side, 0x46d160);
    const text = this.addLabel(row.x - LAYOUT.iconSize - LAYOUT.barWidth - 16, row.y, row.side, {
      fontSize: '11px',
      color: UI.colors.textDim,
    });
    text.setText(label);

    this.widgets[name] = { icon, bar, text };
  }

  updateAbility(name, state) {
    const widget = this.widgets[name];
    if (!widget || !state[name]) return;

    const { ready, progress } = state[name];

    widget.bar.fill.scaleX = ready ? 1 : progress;
    widget.bar.fill.setFillStyle(ready ? 0x46d160 : 0x6b6b80);
    widget.icon.setAlpha(ready ? 1 : 0.4);
  }

  // -------------------------------------------------------------------------
  // Sangrado y vendajes (nivel 3)
  // -------------------------------------------------------------------------

  buildBleeding() {
    const row = this.nextRow('right');
    const icon = this.addIcon(row.x, row.y, 'icon_bleeding', row.side);
    const text = this.addLabel(row.x - LAYOUT.iconSize - 8, row.y, row.side, {
      fontSize: '15px',
      fontStyle: 'bold',
      color: UI.colors.danger,
    });

    this.widgets.bleeding = { icon, text };
  }

  updateBleeding(state) {
    const widget = this.widgets.bleeding;
    if (!widget || !state.bleeding) return;

    const { active, remainingMs } = state.bleeding;

    if (!active) {
      widget.icon.setVisible(false);
      widget.text.setVisible(false);
      return;
    }

    // Parpadeo urgente mientras corre la cuenta atrás.
    const blink = Math.floor(this.time.now / 200) % 2 === 0;
    widget.icon.setVisible(blink);
    widget.text.setVisible(true).setText(`${(remainingMs / 1000).toFixed(1)}s`);
  }

  buildBandages() {
    const row = this.nextRow('right');
    const icon = this.addIcon(row.x, row.y, 'icon_bandage', row.side);
    const text = this.addLabel(row.x - LAYOUT.iconSize - 8, row.y, row.side, { fontSize: '14px' });

    this.widgets.bandages = { icon, text };
  }

  updateBandages(state) {
    const widget = this.widgets.bandages;
    if (!widget || !state.bandages) return;

    widget.text.setText(`x${state.bandages.count}`);
    widget.icon.setAlpha(state.bandages.count > 0 ? 1 : 0.35);
  }

  // -------------------------------------------------------------------------
  // Brújula: apunta al artefacto cuando está fuera de cámara (nivel 2)
  // -------------------------------------------------------------------------

  buildCompass() {
    this.widgets.compass = {
      arrow: this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'icon_compass')
        .setDisplaySize(28, 28)
        .setOrigin(0.5)
        .setVisible(false),
    };
  }

  updateCompass(state) {
    const widget = this.widgets.compass;
    if (!widget || !state.compass) return;

    const target = state.compass.target;
    const camera = this.levelScene.cameras?.main;

    if (!target || !camera) {
      widget.arrow.setVisible(false);
      return;
    }

    // `worldView` es el rectángulo del mundo que la cámara está mostrando, y ya
    // tiene en cuenta el zoom. Comparar contra él (en vez de restar `scrollX` y
    // medir en píxeles de pantalla) hace este cálculo independiente del zoom.
    const view = camera.worldView;

    if (view.contains(target.x, target.y)) {
      widget.arrow.setVisible(false);
      return;
    }

    // Fuera de cámara: colocamos la flecha sobre una elipse pegada al borde de
    // la pantalla, en la dirección en la que queda el objetivo.
    const angle = Phaser.Math.Angle.Between(view.centerX, view.centerY, target.x, target.y);
    const margin = 34;
    const radiusX = GAME_WIDTH / 2 - margin;
    const radiusY = GAME_HEIGHT / 2 - margin;

    widget.arrow
      .setVisible(true)
      .setPosition(
        GAME_WIDTH / 2 + Math.cos(angle) * radiusX,
        GAME_HEIGHT / 2 + Math.sin(angle) * radiusY,
      )
      .setRotation(angle);
  }
}
