import Phaser from '../lib/phaser.js';
import { ASSET_MANIFEST, AUDIO_MANIFEST } from '../config/AssetManifest.js';
import { GAME_WIDTH, GAME_HEIGHT, UI, DEV } from '../config/GameConfig.js';
import { createMissingPlaceholders } from '../systems/PlaceholderFactory.js';
import { playMusic } from '../systems/AudioManager.js';

/**
 * Carga todos los assets del manifiesto y sustituye por placeholders los que
 * todavía no existen.
 *
 * El manifiesto se carga completo aquí (no por nivel) para que las escenas de
 * juego puedan asumir que cualquier key está disponible. Mientras la carpeta
 * /assets esté incompleta verás errores 404 en la consola del navegador: son
 * esperados, cada uno se convierte en un placeholder.
 */
/**
 * Tiempo sin NINGÚN avance tras el cual se continúa de todas formas.
 *
 * Hace falta porque una carga puede quedarse colgada sin fallar: si el navegador
 * no puede decodificar audio (sin salida de sonido, o con el audio deshabilitado),
 * `decodeAudioData` no resuelve ni rechaza nunca, el loader no termina y el
 * jugador se queda mirando la pantalla de carga para siempre.
 *
 * Es un detector de ATASCO, no un tope total: el temporizador se reinicia con
 * cada archivo que llega. Esa distinción importa porque el juego carga unos 14 MB
 * de audio, y un tope total cortaría una carga que iba bien —solo lenta— dejando
 * al jugador sin música. Así, solo se rinde cuando de verdad no avanza nada.
 */
const LOAD_STALL_MS = 12000;

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  init() {
    /** Evita que la carga se cierre dos veces (por timeout y por 'complete'). */
    this.hasContinued = false;
    this.loadTimeout = null;
  }

  preload() {
    this.buildLoadingScreen();

    // La música de la pantalla de carga se pide como cualquier otro asset y
    // arranca en cuanto su archivo llega, sin bloquear el arranque del juego.
    this.load.on('filecomplete', (key) => {
      if (key === 'music_loading') playMusic(this, 'music_loading');
    });

    // Un fallo de carga NO debe abortar el arranque: se resolverá como
    // placeholder al terminar, igual que lo que no haya llegado a tiempo.
    this.load.on('loaderror', (file) => {
      console.warn(`[Preload] No se pudo cargar "${file.key}".`);
    });

    this.load.on('progress', (value) => {
      // Cada avance reinicia el detector de atasco: mientras entren archivos, se
      // sigue esperando por lento que sea.
      this.armStallTimer();

      // Escalamos en X en lugar de reasignar `width`: en los Shapes de Phaser
      // cambiar `width` no regenera la geometría que se dibuja.
      this.progressFill.scaleX = value;
      this.percentText.setText(`${Math.round(value * 100)}%`);
    });

    this.load.on('fileprogress', (file) => {
      this.fileText.setText(file.key);
    });

    // Audio primero: así la música de carga es de lo primero que llega.
    AUDIO_MANIFEST.forEach((track) => {
      this.load.audio(track.key, track.path);
    });

    this.armStallTimer();

    ASSET_MANIFEST.forEach((asset) => {
      if (asset.type === 'spritesheet') {
        this.load.spritesheet(asset.key, asset.path, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
        });
      } else {
        this.load.image(asset.key, asset.path);
      }
    });
  }

  /**
   * (Re)arma el detector de atasco.
   *
   * Usa `window.setTimeout` y NO `this.time.delayedCall` a propósito: mientras la
   * escena está cargando no ha llegado al estado "running", así que su reloj no
   * avanza y un temporizador de Phaser jamás se dispararía. Que es precisamente
   * el caso que hay que cubrir.
   */
  armStallTimer() {
    window.clearTimeout(this.loadTimeout);
    this.loadTimeout = window.setTimeout(() => this.finishLoading(true), LOAD_STALL_MS);
  }

  create() {
    this.finishLoading(false);
  }

  /**
   * Cierra la carga y pasa a la siguiente escena.
   *
   * Se llama desde `create()` (carga terminada) o desde el temporizador de
   * seguridad (carga atascada), y se protege para no ejecutarse dos veces.
   *
   * Los placeholders se deciden preguntando al gestor de texturas qué falta, no
   * apuntando los fallos: así cubre tanto lo que falló como lo que se quedó a
   * medias al agotarse el plazo.
   */
  finishLoading(byTimeout) {
    if (this.hasContinued) return;
    this.hasContinued = true;

    window.clearTimeout(this.loadTimeout);

    if (byTimeout) {
      console.warn(
        `[Preload] La carga se atascó (${LOAD_STALL_MS / 1000} s sin avanzar); se ` +
          'continúa sin los assets que falten.',
      );
      this.load.removeAllListeners();
    }

    this.fileText.setText('Generando placeholders...');

    const missingAssets = ASSET_MANIFEST.filter((asset) => !this.textures.exists(asset.key));

    createMissingPlaceholders(this, missingAssets);
    this.reportAssetStatus(missingAssets);
    this.reportAudioStatus();

    this.startNextScene();
  }

  /**
   * Va al menú principal, salvo que se haya pedido otra escena con `?scene=`
   * (atajo de desarrollo). Si la escena pedida no existe, avisa y sigue al menú.
   */
  startNextScene() {
    const { startScene, levelId } = DEV;

    if (startScene) {
      if (this.scene.manager?.keys?.[startScene]) {
        console.info(`[Dev] Arrancando en ${startScene}` + (levelId ? ` (nivel ${levelId})` : ''));
        this.scene.start(startScene, levelId ? { levelId } : undefined);
        return;
      }
      console.warn(`[Dev] La escena "${startScene}" no está registrada; voy al menú.`);
    }

    this.scene.start('MainMenuScene');
  }

  // -------------------------------------------------------------------------
  // Pantalla de carga
  // -------------------------------------------------------------------------

  buildLoadingScreen() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    this.add
      .text(centerX, centerY - 70, 'KILLING TIME', {
        fontFamily: UI.fonts.family,
        fontSize: '34px',
        fontStyle: 'bold',
        color: UI.colors.accent,
      })
      .setOrigin(0.5);

    this.progressBarWidth = 460;
    const barHeight = 22;
    const barX = centerX - this.progressBarWidth / 2;
    const barY = centerY - barHeight / 2;

    this.add
      .rectangle(centerX, centerY, this.progressBarWidth + 6, barHeight + 6)
      .setStrokeStyle(2, UI.colors.panelBorder)
      .setFillStyle(UI.colors.panel);

    // El relleno crece desde la izquierda, así que le anclamos el origen ahí y
    // lo animamos con scaleX (0 → 1) según avanza la carga.
    this.progressFill = this.add
      .rectangle(barX, barY, this.progressBarWidth, barHeight, 0x46d160)
      .setOrigin(0, 0);
    this.progressFill.scaleX = 0;

    this.percentText = this.add
      .text(centerX, centerY + 34, '0%', {
        fontFamily: UI.fonts.family,
        fontSize: '16px',
        color: UI.colors.text,
      })
      .setOrigin(0.5);

    this.fileText = this.add
      .text(centerX, centerY + 60, '', {
        fontFamily: UI.fonts.family,
        fontSize: '12px',
        color: UI.colors.textDim,
      })
      .setOrigin(0.5);
  }

  /**
   * Informe del audio. Una pista que falte no se sustituye por nada (no hay
   * "placeholder de sonido"): AudioManager ignora la llamada en silencio.
   */
  reportAudioStatus() {
    const ausentes = AUDIO_MANIFEST.filter((track) => !this.cache.audio.exists(track.key));
    const total = AUDIO_MANIFEST.length;

    if (ausentes.length === 0) {
      console.info(`[Audio] ${total}/${total} pistas cargadas.`);
      return;
    }

    console.info(
      `[Audio] ${total - ausentes.length}/${total} pistas cargadas. ` +
        `Faltan ${ausentes.length}: ${ausentes.map((t) => t.key).join(', ')}`,
    );
  }

  // -------------------------------------------------------------------------
  // Informe en consola
  // -------------------------------------------------------------------------

  /**
   * Resume en consola qué assets son reales y cuáles placeholder, agrupados por
   * carpeta. Es la forma rápida de saber qué le falta entregar a quien está
   * generando el arte.
   */
  reportAssetStatus(missingAssets) {
    const total = ASSET_MANIFEST.length;
    const missing = missingAssets.length;
    const loaded = total - missing;

    if (missing === 0) {
      console.info(`[Assets] ${total}/${total} assets reales cargados. Sin placeholders.`);
      return;
    }

    console.info(
      `[Assets] ${loaded}/${total} assets reales. ${missing} generados como placeholder ` +
        '(los errores 404 de arriba son esperados).',
    );

    const byCategory = missingAssets.reduce((acc, asset) => {
      acc[asset.category] = acc[asset.category] ?? [];
      acc[asset.category].push(asset.key);
      return acc;
    }, {});

    console.groupCollapsed('[Assets] Pendientes por carpeta');
    Object.entries(byCategory).forEach(([category, keys]) => {
      console.info(`assets/${category}/ — faltan ${keys.length}: ${keys.join(', ')}`);
    });
    console.groupEnd();
  }
}
