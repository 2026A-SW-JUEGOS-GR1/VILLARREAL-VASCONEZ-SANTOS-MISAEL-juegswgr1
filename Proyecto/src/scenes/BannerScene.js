import Phaser from '../lib/phaser.js';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config/GameConfig.js';
import { isPlaceholder } from '../systems/PlaceholderFactory.js';
import { playJingle, fadeOutJingle, stopMusic } from '../systems/AudioManager.js';

/**
 * Definición de los tres banners del juego. Si el PNG correspondiente todavía no
 * existe, se rotula con texto estilado en su lugar.
 */
const BANNERS = {
  gameStart: {
    asset: 'banner_game_start',
    text: 'GAME START',
    color: UI.colors.accent,
    jingle: 'jingle_game_start',
    // Suena por encima de la música del nivel, que solo se atenúa.
    stopsMusic: false,
  },
  levelComplete: {
    asset: 'banner_level_complete',
    text: 'LEVEL COMPLETE',
    color: UI.colors.success,
    jingle: 'jingle_level_complete',
    stopsMusic: true,
  },
  gameOver: {
    asset: 'banner_game_over',
    text: 'GAME OVER',
    color: UI.colors.danger,
    jingle: 'jingle_game_over',
    stopsMusic: true,
  },
};

/**
 * Banner superpuesto reutilizable (GAME START / LEVEL COMPLETE / GAME OVER).
 *
 * Se lanza en paralelo sobre el nivel con `scene.launch` y avisa por callback
 * cuando termina, de modo que quien lo lanza decide qué pasa después (reanudar
 * el control del jugador, volver al selector...).
 *
 * Sustituye a las escenas GameOverScene y LevelCompleteScene que planteaba la
 * especificación: los tres casos son el mismo banner con distinto texto, así que
 * mantenerlos separados solo duplicaría código.
 */
export default class BannerScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BannerScene' });
  }

  /**
   * @param {object} data
   * @param {'gameStart'|'levelComplete'|'gameOver'} data.type
   * @param {Function} [data.onComplete] Se llama al terminar la animación.
   * @param {number} [data.duration]    Duración total en ms.
   * @param {string} [data.subtitle]    Línea extra bajo el banner.
   */
  init(data) {
    this.config = BANNERS[data.type] ?? BANNERS.gameStart;
    this.onComplete = data.onComplete;
    this.duration = data.duration ?? UI.bannerMs;
    this.subtitle = data.subtitle ?? null;
  }

  create() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    const content = this.add.container(centerX, centerY);

    if (isPlaceholder(this, this.config.asset)) {
      // Sin arte todavía: banda oscura + texto grande.
      content.add(
        this.add.rectangle(0, 0, GAME_WIDTH, 120, 0x000000, 0.72).setOrigin(0.5),
      );
      content.add(
        this.add
          .text(0, 0, this.config.text, {
            fontFamily: UI.fonts.family,
            fontSize: '52px',
            fontStyle: 'bold',
            color: this.config.color,
          })
          .setOrigin(0.5),
      );
    } else {
      content.add(this.add.image(0, 0, this.config.asset).setOrigin(0.5));
    }

    if (this.subtitle) {
      content.add(
        this.add
          .text(0, 76, this.subtitle, {
            fontFamily: UI.fonts.family,
            fontSize: '16px',
            color: UI.colors.text,
            align: 'center',
          })
          .setOrigin(0.5),
      );
    }

    this.playAudio();
    this.animate(content);
  }

  /**
   * Lanza el jingle del banner.
   *
   * Las pistas entregadas duran más de 30 s, así que no encajan como golpe
   * corto: se guardan para cortarlas con un fundido cuando el banner termina.
   * En victoria y derrota además se para la música del nivel; en GAME START solo
   * se atenúa, porque el nivel arranca justo después.
   */
  playAudio() {
    if (this.config.stopsMusic) stopMusic();
    this.jingle = playJingle(this, this.config.jingle, !this.config.stopsMusic);
  }

  /** Entrada con escala + salida por desvanecido, dentro de la duración pedida. */
  animate(content) {
    const entryMs = 260;
    const exitMs = 260;
    const holdMs = Math.max(0, this.duration - entryMs - exitMs);

    content.setScale(0.6).setAlpha(0);

    this.tweens.add({
      targets: content,
      scale: 1,
      alpha: 1,
      duration: entryMs,
      ease: 'Back.easeOut',
    });

    this.tweens.add({
      targets: content,
      alpha: 0,
      delay: entryMs + holdMs,
      duration: exitMs,
      onComplete: () => this.finish(),
    });
  }

  finish() {
    const callback = this.onComplete;

    // El fundido del jingle NO depende de esta escena (va por
    // requestAnimationFrame dentro de AudioManager), y es imprescindible que sea
    // así: la línea siguiente cierra la escena. Cuando el fundido era un tween de
    // aquí, moría con ella y el jingle —de más de 30 s— seguía sonando por encima
    // de la música del nivel.
    fadeOutJingle(this.jingle);

    // Cerramos primero y avisamos después: así el callback puede arrancar otra
    // escena sin que este banner siga vivo por encima.
    this.scene.stop();
    callback?.();
  }
}
