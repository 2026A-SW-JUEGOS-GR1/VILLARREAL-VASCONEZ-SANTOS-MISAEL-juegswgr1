import Phaser from '../lib/phaser.js';
import { GAME_WIDTH, GAME_HEIGHT, UI, DEV } from '../config/GameConfig.js';
import { getLevel } from '../config/LevelConfig.js';
import Player from '../entities/Player.js';
import Bullet from '../entities/Bullet.js';
import InputManager from '../systems/InputManager.js';
import SaveManager from '../systems/SaveManager.js';
import { returnToLevelSelect } from '../systems/LevelFlow.js';
import { isPlaceholder } from '../systems/PlaceholderFactory.js';
import { playMusic, playSfx } from '../systems/AudioManager.js';

/** Factores de scroll de las tres capas de parallax (lejana → cercana). */
const PARALLAX_FACTORS = { far: 0.2, mid: 0.5, near: 0.9 };

/** Margen bajo el borde inferior del mundo que cuenta como caída mortal. */
const FALL_MARGIN = 40;

/**
 * Esqueleto común a los 4 niveles.
 *
 * Concentra todo lo que es idéntico nivel a nivel —parallax, jugador, balas,
 * cámara, HUD, pausa, reaparición, banners y fin de nivel— para que cada
 * LevelXScene solo tenga que aportar su geometría, sus enemigos y sus mecánicas
 * propias.
 *
 * Ganchos que sobreescriben las subclases:
 *   - `buildTerrain()`   obligatorio: crea `this.platforms` (StaticGroup).
 *   - `buildLevel()`     opcional: enemigos, objetos y trampas del nivel.
 *   - `updateLevel()`    opcional: lógica por frame.
 *   - `resetEnemies()`   opcional: al reaparecer tras perder una vida.
 *   - `getSpawnPoint()`  opcional: punto de aparición (por defecto, arriba a la izquierda).
 *   - `getHudState()`    opcional: añade widgets al estado base (munición y vidas).
 */
export default class BaseLevelScene extends Phaser.Scene {
  /**
   * Todo el estado se reinicia aquí y NO en el constructor: Phaser reutiliza la
   * instancia de la escena entre partidas, así que el constructor solo corre una
   * vez en toda la sesión.
   */
  init(data) {
    this.levelId = data?.levelId ?? this.levelId;
    this.level = this.level ?? getLevel(this.levelId);

    this.isPaused = false;
    /** true desde que el nivel se gana o se pierde: bloquea más lógica. */
    this.isFinished = false;
    this.pauseObjects = [];

    /**
     * Progreso que sobrevive a perder una vida (fragmentos ya recogidos, llaves,
     * vendajes...). Se reinicia solo al volver a entrar al nivel, porque `init`
     * se ejecuta de nuevo en cada `scene.start`.
     */
    this.levelProgress = { collected: [], keys: 0 };
  }

  create() {
    this.worldWidth = this.level?.widthPx ?? GAME_WIDTH;
    this.worldHeight = this.getWorldHeight();

    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    playMusic(this, this.level?.music);

    this.controls = new InputManager(this);

    this.buildParallax();
    this.buildTerrain();
    this.createBullets();
    this.createPlayer();
    this.setupCamera();

    this.buildLevel();

    this.launchHud();
    this.startIntro();

    // Al cerrar la escena hay que llevarse el HUD por delante.
    this.events.once('shutdown', () => this.scene.stop('HUDScene'));
  }

  /** Alto del mundo. Por defecto el del viewport; los niveles verticales lo amplían. */
  getWorldHeight() {
    return GAME_HEIGHT;
  }

  // -------------------------------------------------------------------------
  // Escenografía
  // -------------------------------------------------------------------------

  /**
   * Tres capas de parallax como TileSprite.
   *
   * Los fondos son de 1920 px y los niveles miden hasta 4000, así que se repiten
   * horizontalmente. Se fijan a la cámara (`scrollFactor 0`) y el desplazamiento
   * se simula moviendo `tilePositionX`: así el bucle es infinito y sin costuras.
   */
  buildParallax() {
    const [far, mid, near] = this.level?.backgrounds ?? [];

    this.parallaxLayers = [];

    this.addParallaxLayer(far, PARALLAX_FACTORS.far, -20);
    this.addParallaxLayer(mid, PARALLAX_FACTORS.mid, -19);

    // La capa cercana es decoración de PRIMER PLANO según el documento de arte,
    // así que va DELANTE del terreno y del jugador. Solo si de verdad es una
    // silueta con transparencia; ver isUsableForeground().
    if (this.isUsableForeground(near)) {
      this.addParallaxLayer(near, PARALLAX_FACTORS.near, 50);
    }
  }

  /**
   * ¿Sirve esta textura como capa de primer plano?
   *
   * Una capa de primer plano tiene que ser una silueta con transparencia: se
   * dibuja delante del jugador, así que si es una imagen opaca a pantalla completa
   * tapa el nivel entero y lo vuelve injugable. Ha pasado: `level1_near` se
   * entregó sin canal alfa útil (100 % de píxeles opacos).
   *
   * En vez de confiar en el archivo, se muestrea una rejilla de píxeles y se
   * descarta la capa si TODOS son opacos. Es una comprobación barata (25 lecturas
   * una vez por nivel) que convierte un error de exportación en un fondo más plano
   * en lugar de en una pantalla tapada.
   */
  isUsableForeground(key) {
    if (!key || isPlaceholder(this, key)) return false;

    const samples = 5;
    const source = this.textures.get(key)?.getSourceImage?.();
    if (!source) return false;

    for (let row = 0; row < samples; row++) {
      for (let column = 0; column < samples; column++) {
        // Se evitan los bordes exactos, que suelen ser atípicos.
        const x = Math.floor(((column + 0.5) / samples) * source.width);
        const y = Math.floor(((row + 0.5) / samples) * source.height);

        if (this.textures.getPixelAlpha(x, y, key) < 250) return true;
      }
    }

    console.warn(
      `[Parallax] "${key}" es opaca a pantalla completa y no se usará como capa de ` +
        'primer plano: taparía el nivel. Hay que reexportarla como silueta con ' +
        'transparencia.',
    );
    return false;
  }

  /**
   * Añade una capa de parallax y la registra para su actualización.
   *
   * Solo se monta si su arte existe de verdad: un rectángulo de placeholder
   * encima de un fondo real se lee como un fallo de render, y en el caso de la
   * capa de primer plano taparía el nivel entero. Así, a un nivel al que le
   * falten capas se le ve el fondo más plano, pero correcto.
   *
   * @returns {{layer: Phaser.GameObjects.TileSprite, factor: number}|null}
   */
  addParallaxLayer(key, factor, depth) {
    if (!key || isPlaceholder(this, key)) return null;

    const layer = this.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);

    const entry = { layer, factor };
    this.parallaxLayers.push(entry);
    return entry;
  }

  updateParallax() {
    const scrollX = this.cameras.main.scrollX;

    this.parallaxLayers.forEach(({ layer, factor }) => {
      layer.tilePositionX = scrollX * factor;
    });
  }

  /**
   * Gancho obligatorio: la subclase debe crear `this.platforms` como
   * StaticGroup con la geometría sólida del nivel.
   */
  buildTerrain() {
    throw new Error(`${this.scene.key}: falta implementar buildTerrain().`);
  }

  /** Gancho opcional: enemigos, objetos y trampas propias del nivel. */
  buildLevel() {}

  // -------------------------------------------------------------------------
  // Jugador y balas
  // -------------------------------------------------------------------------

  createBullets() {
    this.bullets = this.physics.add.group({
      classType: Bullet,
      runChildUpdate: true,
      maxSize: 30,
      allowGravity: false,
    });

    // Las balas se consumen al chocar con el terreno.
    this.physics.add.collider(this.bullets, this.platforms, (bullet) => bullet.deactivate());
  }

  createPlayer() {
    const spawn = this.getSpawnPoint();

    this.player = new Player(this, spawn.x, spawn.y, {
      lives: this.level?.lives ?? 3,
      // El nivel 2 no usa invulnerabilidad: con una sola vida no tiene sentido.
      useInvulnerability: (this.level?.lives ?? 3) > 1,
      enableDoubleJump: this.level?.ability === 'Doble salto',
      enableDash: this.level?.ability === 'Dash',
      bullets: this.bullets,
    });

    this.physics.add.collider(this.player, this.platforms);
  }

  /** Punto de aparición y reaparición. */
  getSpawnPoint() {
    return { x: 96, y: this.worldHeight - 200 };
  }

  setupCamera() {
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Atajo de desarrollo para inspeccionar el trazado completo del mapa.
    if (DEV.zoom) this.cameras.main.setZoom(DEV.zoom);
  }

  // -------------------------------------------------------------------------
  // HUD y banner de entrada
  // -------------------------------------------------------------------------

  launchHud() {
    this.scene.launch('HUDScene', { levelScene: this, level: this.level });
  }

  /**
   * Estado que lee el HUD cada frame. Las subclases lo amplían con sus propios
   * widgets (escudo, sangrado, vendajes...) sobre esta base.
   */
  getHudState() {
    const now = this.time.now;
    const { ammo, health } = this.player;

    return {
      ammo: {
        current: ammo.current,
        magazineSize: ammo.magazineSize,
        isReloading: ammo.isReloading,
        reloadProgress: ammo.reloadProgress(now),
      },
      lives: { current: health.current, max: health.max },
    };
  }

  /** Banner GAME START con el jugador congelado hasta que termina. */
  startIntro() {
    // Atajo de desarrollo: entrar a jugar directamente.
    if (DEV.skipIntro) return;

    this.player.setFrozen(true);

    this.scene.launch('BannerScene', {
      type: 'gameStart',
      subtitle: this.level?.objective,
      onComplete: () => {
        if (!this.isFinished) this.player.setFrozen(false);
      },
    });
  }

  // -------------------------------------------------------------------------
  // Bucle principal
  // -------------------------------------------------------------------------

  update(time, delta) {
    if (this.controls.pressedPause() && !this.isFinished) {
      this.togglePause();
    }

    if (this.isPaused || this.isFinished) return;

    // Se usa el reloj de la ESCENA (`this.time.now`), no el del bucle del juego
    // que llega en `time`. Son distintos: el de la escena se congela al pausar,
    // y es el que usan los temporizadores, los cooldowns y `getHudState()`.
    // Mezclarlos desincronizaría, por ejemplo, la barra de recarga con la
    // recarga real.
    const now = this.time.now;

    this.updateParallax();
    this.player.update(now, this.controls);
    this.checkFallDeath();
    this.updateLevel(now, delta);
  }

  /** Gancho opcional para la lógica propia del nivel. `now` = reloj de escena. */
  updateLevel() {}

  /** Caer por debajo del mundo cuesta una vida. */
  checkFallDeath() {
    if (this.player.y > this.worldHeight - FALL_MARGIN) {
      this.loseLife();
    }
  }

  // -------------------------------------------------------------------------
  // Vidas, victoria y derrota
  // -------------------------------------------------------------------------

  /**
   * Quita una vida. Si quedan, reaparece; si no, GAME OVER.
   * Respeta la invulnerabilidad del jugador (salvo en el nivel 2, que no la usa).
   */
  loseLife(amount = 1) {
    if (this.isFinished) return;

    const result = this.player.takeDamage(this.time.now, amount);

    if (result === 'ignored') return;
    if (result === 'dead') {
      this.gameOver();
      return;
    }

    playSfx(this, 'sfx_hurt');
    this.respawnPlayer();
  }

  /**
   * Devuelve al jugador al punto de aparición y resetea los enemigos, pero
   * conserva lo ya recogido (`levelProgress`).
   */
  respawnPlayer() {
    const spawn = this.getSpawnPoint();

    this.player.respawn(spawn.x, spawn.y);
    this.resetEnemies();
  }

  /** Gancho opcional: devolver los enemigos a su posición y HP inicial. */
  resetEnemies() {}

  completeLevel() {
    if (this.isFinished) return;

    this.isFinished = true;
    this.player.setFrozen(true);
    this.physics.pause();

    if (this.levelId) SaveManager.markCompleted(this.levelId);

    this.scene.launch('BannerScene', {
      type: 'levelComplete',
      duration: UI.outroDelayMs,
      onComplete: () => returnToLevelSelect(this),
    });
  }

  gameOver() {
    if (this.isFinished) return;

    this.isFinished = true;
    this.player.setFrozen(true);
    this.physics.pause();

    this.scene.launch('BannerScene', {
      type: 'gameOver',
      duration: UI.outroDelayMs,
      onComplete: () => returnToLevelSelect(this),
    });
  }

  // -------------------------------------------------------------------------
  // Pausa
  // -------------------------------------------------------------------------

  togglePause() {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.physics.pause();
      // Parar el reloj congela también temporizadores del nivel (oleadas,
      // rocas, cooldowns), no solo el movimiento.
      this.time.paused = true;
      this.player.setFrozen(true);
      this.showPauseOverlay();
    } else {
      this.physics.resume();
      this.time.paused = false;
      this.player.setFrozen(false);
      this.hidePauseOverlay();
    }
  }

  showPauseOverlay() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    const backdrop = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    const text = this.add
      .text(
        centerX,
        centerY,
        'PAUSA\n\nESC para continuar\nM para volver al selector',
        {
          fontFamily: UI.fonts.family,
          fontSize: '26px',
          color: UI.colors.text,
          align: 'center',
          lineSpacing: 8,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.pauseObjects = [backdrop, text];

    // M solo sale al selector mientras la pausa está activa.
    this.pauseMenuKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.pauseMenuKey.once('down', () => {
      if (!this.isPaused) return;

      // Reanudar antes de salir: si no, la escena queda con el reloj parado y
      // las físicas pausadas para la próxima vez que se entre.
      this.time.paused = false;
      this.physics.resume();
      returnToLevelSelect(this);
    });
  }

  hidePauseOverlay() {
    this.pauseObjects.forEach((object) => object.destroy());
    this.pauseObjects = [];

    this.pauseMenuKey?.destroy();
    this.pauseMenuKey = null;
  }
}
