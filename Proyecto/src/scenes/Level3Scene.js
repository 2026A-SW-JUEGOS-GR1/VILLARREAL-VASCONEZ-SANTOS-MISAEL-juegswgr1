import BaseLevelScene from './BaseLevelScene.js';
import { TILE, LEVEL3 } from '../config/GameConfig.js';
import Ninja from '../entities/Ninja.js';
import Shuriken from '../entities/Shuriken.js';
import ShurikenTrap from '../entities/ShurikenTrap.js';
import Bullet from '../entities/Bullet.js';
import BleedingSystem from '../systems/BleedingSystem.js';
import { pairBy } from '../systems/CollisionUtils.js';
import { playSfx } from '../systems/AudioManager.js';

/** Rejilla: 50 columnas x 22 filas de 64 px. El nivel es alto, no largo. */
const ROWS = 22;
/** Fila del suelo del patio de entrada. */
const GROUND_ROW = 20;

/** Suelo inicial. A partir de la columna 20 hay vacío: hay que subir, no andar. */
const GROUND_RUN = [0, 19];

/**
 * Ascenso en zigzag hasta la torre: [columna, fila, ancho en tiles].
 *
 * Cada plataforma queda 2 filas (128 px) por encima de la anterior, dentro del
 * salto normal de 3 tiles con margen. La única excepción es la cima, a 4 filas
 * de la última plataforma: ahí el trampolín es obligatorio.
 */
const LEDGES = [
  [6, 18, 4], // P1
  [12, 16, 4], // P2
  [18, 14, 4], // P3
  [24, 12, 4], // P4
  [30, 10, 4], // P5
  [36, 8, 6], // P6, la plataforma de lanzamiento
  [43, 4, 7], // Cima de la torre del shōgun
];

/**
 * Trampolines: [columna, fila de la superficie donde se apoya].
 *
 * Impulsan 7 tiles (448 px), muy por encima del salto normal.
 */
const TRAMPOLINES = [
  [17, GROUND_ROW], // Atajo: del patio directo a P3, saltándose P1 y P2
  [40, 8], // Obligatorio: de P6 a la cima
];

/**
 * Trampas de pared: [columna, fila, dirección].
 *
 * Van una fila por encima de la plataforma que barren, para que el shuriken
 * pase a la altura del pecho de quien esté de pie en ella.
 */
const TRAPS = [
  [5, 17, 1], // barre P1
  [11, 15, 1], // barre P2
  [23, 11, 1], // barre P4
  [35, 7, 1], // barre P6
];

/** Ninjas: [columna, fila de la superficie]. */
const NINJA_SPAWNS = [
  [19, 14], // en P3
  [31, 10], // en P5
  [44, 4], // guardando el tesoro
];

/** Vendajes repartidos por el mapa: [columna, fila de la superficie]. */
const BANDAGE_SPAWNS = [
  [14, 16], // en P2
  [26, 12], // en P4
  [39, 8], // en P6
];

/** Dónde está el tesoro sellado, en la cima. */
const TREASURE = [47, 4];

/**
 * NIVEL 3 — Japón Feudal.
 *
 * Torre vertical: se sube en zigzag desde el patio hasta la cima, donde espera
 * el tesoro sellado del shōgun. **5 vidas**, las más de los cuatro niveles,
 * porque aquí el daño llega por acumulación y no de golpe.
 *
 * Mecánicas propias:
 *  - **Dash** (SHIFT) con invencibilidad mientras dura: sirve tanto para cruzar
 *    huecos como para atravesar una cortina de shuriken.
 *  - **Trampolines**: impulsan 7 tiles. El último tramo hasta la cima solo se
 *    puede hacer con uno.
 *  - **Sangrado y vendajes**: los shuriken no quitan vida, provocan un sangrado
 *    de 5 s. Toda la casuística está en `systems/BleedingSystem.js`.
 */
export default class Level3Scene extends BaseLevelScene {
  constructor() {
    super({ key: 'Level3Scene' });
  }

  init(data) {
    super.init(data);

    this.ninjas = [];
    this.traps = [];

    this.bleeding = new BleedingSystem({
      durationMs: LEVEL3.bleedDurationMs,
      startingBandages: LEVEL3.startingBandages,
      bandagesPerHeal: LEVEL3.bandagesPerHeal,
      bandagesPerExtraLife: LEVEL3.bandagesPerExtraLife,
      maxLives: LEVEL3.maxLives,
      doubleTapWindowMs: LEVEL3.doubleTapWindowMs,
    });
  }

  getWorldHeight() {
    return ROWS * TILE;
  }

  getSpawnPoint() {
    return { x: columnCenter(2), y: rowTop(GROUND_ROW) - 112 };
  }

  // -------------------------------------------------------------------------
  // Terreno
  // -------------------------------------------------------------------------

  buildTerrain() {
    this.platforms = this.physics.add.staticGroup();

    const [from, to] = GROUND_RUN;
    for (let column = from; column <= to; column++) {
      this.addTile(column, GROUND_ROW);
    }

    LEDGES.forEach(([column, row, width]) => {
      for (let i = 0; i < width; i++) {
        this.addTile(column + i, row);
      }
    });
  }

  addTile(column, row) {
    const tile = this.platforms.create(
      columnCenter(column),
      rowCenter(row),
      this.level.floorTexture,
    );
    tile.setDisplaySize(TILE, TILE);
    tile.refreshBody();
    return tile;
  }

  // -------------------------------------------------------------------------
  // Objetos, trampas y enemigos
  // -------------------------------------------------------------------------

  buildLevel() {
    this.createAnimations();
    this.createShurikens();
    this.createTrampolines();
    this.createTraps();
    this.createBandages();
    this.createTreasure();
    this.createNinjas();
    this.registerInteractions();
  }

  createAnimations() {
    Shuriken.createAnimations(this);

    if (!this.anims.exists('treasure-pulse')) {
      this.anims.create({
        key: 'treasure-pulse',
        frames: this.anims.generateFrameNumbers('shogun_treasure', { start: 0, end: 5 }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  createShurikens() {
    this.shurikens = this.physics.add.group({
      classType: Shuriken,
      runChildUpdate: true,
      maxSize: 24,
      allowGravity: false,
    });
  }

  /**
   * Los trampolines son zonas de solape, no cuerpos sólidos: el jugador cae
   * sobre ellos y sale disparado antes de atravesarlos. Al no haber resolución
   * de colisión, nada sobreescribe el impulso.
   */
  createTrampolines() {
    this.trampolines = this.physics.add.staticGroup();

    TRAMPOLINES.forEach(([column, row]) => {
      const trampoline = this.trampolines.create(
        columnCenter(column),
        rowTop(row) - 20,
        'trampoline',
      );
      trampoline.setDisplaySize(96, 40);
      trampoline.refreshBody();
    });
  }

  createTraps() {
    this.traps = TRAPS.map(
      ([column, row, direction]) =>
        new ShurikenTrap(this, columnCenter(column), rowCenter(row), direction),
    );
  }

  createBandages() {
    this.bandageItems = this.physics.add.group({ allowGravity: false, immovable: true });

    BANDAGE_SPAWNS.forEach(([column, row], index) => {
      // Un vendaje ya recogido no reaparece al perder una vida.
      const id = `bandage-${index}`;
      if (this.levelProgress.collected.includes(id)) return;

      const bandage = this.bandageItems.create(columnCenter(column), rowTop(row) - 44, 'bandage_icon');
      bandage.bandageId = id;
      bandage.setDisplaySize(40, 40);
      bandage.body.setSize(56, 56);
    });
  }

  createTreasure() {
    const [column, row] = TREASURE;

    this.treasure = this.physics.add.sprite(
      columnCenter(column),
      rowTop(row) - 48,
      'shogun_treasure',
    );
    this.treasure.body.setAllowGravity(false);
    this.treasure.setDisplaySize(72, 72);
    this.treasure.body.setSize(72, 72);
    this.treasure.play('treasure-pulse');
  }

  createNinjas() {
    this.ninjas = NINJA_SPAWNS.map(
      ([column, row]) =>
        new Ninja(this, columnCenter(column), rowTop(row) - 80, {
          shurikens: this.shurikens,
          patrolRange: 110,
        }),
    );
  }

  registerInteractions() {
    // --- Jugador ---
    this.physics.add.overlap(this.player, this.trampolines, (player, trampoline) =>
      this.bounce(trampoline),
    );
    this.physics.add.overlap(this.player, this.shurikens, (a, b) => {
      const [shuriken] = pairBy(Shuriken, a, b);
      shuriken.deactivate();
      this.onShurikenHit();
    });
    this.physics.add.overlap(this.player, this.bandageItems, (player, bandage) =>
      this.collectBandage(bandage),
    );
    this.physics.add.overlap(this.player, this.treasure, () => this.completeLevel());

    // --- Enemigos ---
    // Los ninjas pisan el terreno; son inmunes a las trampas del escenario, así
    // que no colisionan ni con trampolines ni con shuriken.
    this.physics.add.collider(this.ninjas, this.platforms);

    // --- Balas ---
    this.physics.add.overlap(this.bullets, this.ninjas, (a, b) => {
      const [bullet, ninja] = pairBy(Bullet, a, b);
      bullet.deactivate();
      ninja.takeBulletHit();
    });
  }

  // -------------------------------------------------------------------------
  // Bucle del nivel
  // -------------------------------------------------------------------------

  updateLevel(now, delta) {
    // R3: si se agotan los 5 s de sangrado, cuesta una vida.
    if (this.bleeding.update(delta) === 'expired') {
      this.loseLife();
    }

    if (this.controls.pressedInteract()) {
      this.useBandage(now);
    }

    this.traps.forEach((trap) => trap.update(now, this.shurikens));
    this.ninjas.forEach((ninja) => ninja.update(now, this.player));
  }

  /** Impulso del trampolín, solo si Drago viene cayendo. */
  bounce(trampoline) {
    if (this.player.body.velocity.y <= 0) return;

    this.player.setVelocityY(LEVEL3.trampolineVelocity);

    this.tweens.add({
      targets: trampoline,
      scaleY: { from: trampoline.scaleY * 0.6, to: trampoline.scaleY },
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  // -------------------------------------------------------------------------
  // Sangrado: la escena aplica lo que decide BleedingSystem
  // -------------------------------------------------------------------------

  /** Impacto de shuriken, venga de una trampa o de un ninja. */
  onShurikenHit() {
    if (this.isFinished || this.player.isImmune(this.time.now)) return;

    const { loseLife } = this.bleeding.onShurikenHit(this.player.health.current);

    if (loseLife) {
      this.loseLife();
    } else {
      // Primer impacto: no cuesta vida, pero conviene que se note.
      this.flashPlayer(0xe5484d);
    }
  }

  /** Golpe de wakizashi de un ninja. */
  onNinjaMelee() {
    if (this.isFinished || this.player.isImmune(this.time.now)) return;

    const outcome = this.bleeding.onMeleeHit(this.player.health.current);

    if (outcome.loseLife) {
      this.loseLife();
      return;
    }

    // R4: sangrando, el golpe deja a Drago en una sola vida.
    if (outcome.forceLives !== undefined) {
      this.player.health.setCurrent(outcome.forceLives);
      this.flashPlayer(0xffffff);
      this.player.startBlink();
    }
  }

  /** Tecla E: vendarse, o canjear 2 vendajes por 1 vida con doble pulsación. */
  useBandage(now) {
    const outcome = this.bleeding.onInteract(now, this.player.health.current);

    if (outcome.healed) {
      this.flashPlayer(0x46d160);
      return;
    }

    if (outcome.extraLife) {
      this.player.health.heal(1);
      this.flashPlayer(0x46d160);
    }
  }

  collectBandage(bandage) {
    if (!bandage.active) return;

    playSfx(this, 'sfx_collect');
    this.levelProgress.collected.push(bandage.bandageId);
    this.bleeding.addBandage();
    bandage.destroy();
  }

  /** Destello breve sobre Drago como respuesta a un evento de sangrado. */
  flashPlayer(color) {
    this.player.setTintFill(color);
    this.time.delayedCall(110, () => {
      if (!this.player.isDashing) this.player.clearTint();
    });
  }

  // -------------------------------------------------------------------------
  // Estado del HUD
  // -------------------------------------------------------------------------

  getHudState() {
    const now = this.time.now;

    return {
      ...super.getHudState(),

      dash: {
        ready: this.player.dashCooldown.isReady(now),
        progress: this.player.dashCooldown.progress(now),
      },
      bleeding: {
        active: this.bleeding.isBleeding,
        remainingMs: this.bleeding.remainingMs,
      },
      bandages: { count: this.bleeding.bandages },
    };
  }

  /** Al reaparecer: ninjas a su sitio y se corta el sangrado, pero los vendajes ya gastados no vuelven. */
  resetEnemies() {
    this.ninjas.forEach((ninja) => ninja.reset());
    this.shurikens.getChildren().forEach((shuriken) => shuriken.deactivate());
    this.bleeding.stop();
  }
}

// ---------------------------------------------------------------------------
// Ayudas de rejilla
// ---------------------------------------------------------------------------

function rowTop(row) {
  return row * TILE;
}

function rowCenter(row) {
  return row * TILE + TILE / 2;
}

function columnCenter(column) {
  return column * TILE + TILE / 2;
}
