import Phaser from '../lib/phaser.js';
import BaseLevelScene from './BaseLevelScene.js';
import { TILE, PLAYER, LEVEL2 } from '../config/GameConfig.js';
import Mummy from '../entities/Mummy.js';
import Boulder from '../entities/Boulder.js';
import Bullet from '../entities/Bullet.js';
import { pairBy } from '../systems/CollisionUtils.js';
import { playSfx } from '../systems/AudioManager.js';

/** Rejilla: 56 columnas x 10 filas de 64 px. */
const ROWS = 10;
/** Fila del suelo del valle. */
const GROUND_ROW = 8;
/** Fila de las mesetas (colinas) desde donde bajan las rocas. */
const HILL_ROW = 5;

/**
 * Suelo continuo de lado a lado: este nivel es una arena, no un recorrido
 * lineal. No hay pozos porque lo que mata aquí es el calor, las rocas y las
 * momias, no caerse.
 */
const GROUND_RUN = [0, 55];

/**
 * Arena movediza, en columnas [desde, hasta]. Va en los dos valles, entre las
 * colinas y el centro, para que cruzar de un lado a otro tenga coste.
 */
const QUICKSAND_RUNS = [
  [14, 18],
  [36, 40],
];

/** Plataformas fijas: [columna, fila, ancho en tiles]. */
const LEDGES = [
  // Meseta izquierda y su escalera de bajada.
  [0, HILL_ROW, 7],
  [7, 6, 1],
  [8, 7, 1],
  // Plataformas centrales.
  [20, HILL_ROW, 5],
  [26, 3, 4], // Solo se alcanza con doble salto desde el suelo
  [31, 6, 5],
  // Meseta derecha y su escalera.
  [47, 7, 1],
  [48, 6, 1],
  [49, HILL_ROW, 7],
];

/** Puntos de aparición de momias: [columna, fila de la superficie]. */
const MUMMY_SPAWNS = [
  [3, HILL_ROW],
  [17, GROUND_ROW],
  [28, GROUND_ROW],
  [43, GROUND_ROW],
  [52, HILL_ROW],
];

/** Origen de las rocas: [columna, fila, dirección de rodadura]. */
const BOULDER_SOURCES = [
  [4, HILL_ROW, 1],
  [51, HILL_ROW, -1],
];

/** Columna donde se libera el artefacto de la ciudad al acabar la fase 1. */
const ARTIFACT_COLUMN = 28;

/**
 * Distancia máxima a la que reaparece el talismán del escudo.
 *
 * A 200 px/s son unos 8 s de carrera, sobre los 15 s que dura el escudo: deja
 * margen para trepar, esquivar momias y cruzar arena movediza (que va a mitad de
 * velocidad). Sin este tope el talismán podía aparecer al otro extremo de los
 * 3584 px del mapa y no había forma de llegar.
 */
const SHIELD_MAX_DISTANCE = 1600;

/**
 * NIVEL 2 — Antiguo Egipto.
 *
 * Arena abierta con dos colinas y dos valles de arena movediza. **Una sola
 * vida**: cualquier impacto va directo a GAME OVER, así que aquí no hay
 * invulnerabilidad temporal (la desactiva BaseLevelScene al ver `lives: 1`).
 *
 * Dos fases:
 *  1. Aguantar 60 s mientras llegan oleadas de momias y bajan rocas de las
 *     colinas.
 *  2. Al cumplirse el minuto se libera el artefacto que genera el escudo de la
 *     ciudad en el centro del mapa; recogerlo completa el nivel.
 *
 * Y por encima de todo corre el escudo térmico: una cuenta de 15 s que solo se
 * reinicia recogiendo talismanes solares. Si llega a cero hay 2 s de gracia
 * antes de morir de calor.
 */
export default class Level2Scene extends BaseLevelScene {
  constructor() {
    super({ key: 'Level2Scene' });
  }

  init(data) {
    super.init(data);

    /** Fase actual: 1 = supervivencia, 2 = ir a por el artefacto. */
    this.phase = 1;
    this.survivalRemainingMs = LEVEL2.survivalMs;
    this.heatRemainingMs = LEVEL2.heatShieldMs;

    this.mummies = [];
    this.validSpawnPoints = [];
    this.lastShieldPoint = null;
    this.finalArtifact = null;

    this.waveTimer = null;
    this.boulderTimer = null;

    // Estado de la arena movediza.
    this.quicksandColumns = new Set();
    this.stillMs = 0;
    this.isStuck = false;
    this.escapeTaps = 0;
    this.escapeWindowEndsAt = 0;

    /** Celdas sólidas "columna,fila", para derivar puntos de aparición válidos. */
    this.solidCells = new Set();
  }

  getWorldHeight() {
    return ROWS * TILE;
  }

  getSpawnPoint() {
    return { x: columnCenter(10), y: rowTop(GROUND_ROW) - 112 };
  }

  // -------------------------------------------------------------------------
  // Terreno
  // -------------------------------------------------------------------------

  buildTerrain() {
    this.platforms = this.physics.add.staticGroup();

    // Primero anotamos qué columnas son de arena, para no poner dos tiles en la
    // misma celda: el suelo normal se salta esas columnas y la arena las rellena.
    QUICKSAND_RUNS.forEach(([start, end]) => {
      for (let column = start; column <= end; column++) {
        this.quicksandColumns.add(column);
      }
    });

    const [from, to] = GROUND_RUN;
    for (let column = from; column <= to; column++) {
      const texture = this.quicksandColumns.has(column)
        ? 'quicksand_egypt'
        : this.level.floorTexture;

      this.addTile(column, GROUND_ROW, texture);
    }

    LEDGES.forEach(([column, row, width]) => {
      for (let i = 0; i < width; i++) {
        this.addTile(column + i, row, this.level.floorTexture);
      }
    });

    this.computeValidSpawnPoints();
  }

  /** Coloca un tile sólido de 64x64 en (columna, fila) y anota su celda. */
  addTile(column, row, texture) {
    const tile = this.platforms.create(columnCenter(column), rowCenter(row), texture);
    tile.setDisplaySize(TILE, TILE);
    tile.refreshBody();

    this.solidCells.add(cellKey(column, row));
    return tile;
  }

  /**
   * Precalcula dónde puede reaparecer el talismán del escudo.
   *
   * Una superficie sirve si cumple TRES cosas:
   *
   *  1. Es una celda sólida con hueco justo encima (hay dónde posarse).
   *  2. **Tiene columna libre hasta arriba del mapa.** Sin esta comprobación el
   *     talismán acababa en cavidades selladas —por ejemplo el suelo enterrado
   *     bajo las mesetas, tapado por arriba y cerrado por los escalones— y el
   *     jugador moría de calor sin poder llegar. Es una prueba conservadora, no
   *     un cálculo real de accesibilidad: en una arena a cielo abierto como esta,
   *     "se ve el cielo" implica "se puede llegar", y prefiero descartar algún
   *     hueco legítimo (como el que hay bajo las plataformas centrales) antes que
   *     admitir uno imposible.
   *  3. No es arena movediza: dejar el talismán ahí sería una trampa doble,
   *     porque al ir a por él te quedarías atrapado.
   */
  computeValidSpawnPoints() {
    this.validSpawnPoints = [];

    this.solidCells.forEach((key) => {
      const [column, row] = key.split(',').map(Number);

      const hasRoomAbove = !this.solidCells.has(cellKey(column, row - 1));
      const isQuicksand = this.quicksandColumns.has(column) && row === GROUND_ROW;

      if (hasRoomAbove && !isQuicksand && this.isOpenToSky(column, row)) {
        this.validSpawnPoints.push({ x: columnCenter(column), y: rowTop(row) - 48 });
      }
    });
  }

  /** ¿No hay ninguna celda sólida por encima de esta, hasta el borde del mapa? */
  isOpenToSky(column, row) {
    for (let above = row - 1; above >= 0; above--) {
      if (this.solidCells.has(cellKey(column, above))) return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Objetos, enemigos y temporizadores
  // -------------------------------------------------------------------------

  buildLevel() {
    this.createAnimations();
    this.createShieldArtifact();
    this.createMummies();
    this.createBoulders();
    this.registerInteractions();

    this.scheduleWave();
    this.scheduleBoulder();
  }

  createAnimations() {
    Boulder.createAnimations(this);

    [
      ['shield-pulse', 'shield_artifact'],
      ['city-artifact-pulse', 'city_artifact'],
    ].forEach(([key, texture]) => {
      if (this.anims.exists(key)) return;

      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 5 }),
        frameRate: 8,
        repeat: -1,
      });
    });
  }

  createShieldArtifact() {
    const start = this.validSpawnPoints[0] ?? { x: columnCenter(12), y: rowTop(GROUND_ROW) - 48 };

    this.shieldArtifact = this.physics.add.sprite(start.x, start.y, 'shield_artifact');
    this.shieldArtifact.body.setAllowGravity(false);
    this.shieldArtifact.setDisplaySize(52, 52);
    this.shieldArtifact.body.setSize(64, 64);
    this.shieldArtifact.play('shield-pulse');

    this.lastShieldPoint = start;
    this.relocateShield();
  }

  /**
   * Reserva de momias. Nunca se crean ni se destruyen en caliente: se reutilizan
   * las mismas 4, que es el máximo simultáneo permitido.
   */
  createMummies() {
    this.mummies = Array.from({ length: LEVEL2.maxActiveMummies }, () => {
      const mummy = new Mummy(this, -256, -256);
      mummy.disableBody(true, true);
      return mummy;
    });
  }

  createBoulders() {
    this.boulders = this.physics.add.group({
      classType: Boulder,
      runChildUpdate: true,
      maxSize: 8,
    });
  }

  registerInteractions() {
    // --- Jugador ---
    this.physics.add.overlap(this.player, this.shieldArtifact, () => this.collectShield());
    this.physics.add.overlap(this.player, this.boulders, () => this.loseLife());

    // --- Enemigos y rocas contra el terreno ---
    // Las momias son inmunes a las trampas: no hay collider contra la arena ni
    // contra las rocas, solo contra el suelo.
    this.physics.add.collider(this.mummies, this.platforms);
    this.physics.add.collider(this.boulders, this.platforms);

    // --- Balas ---
    // `pairBy` porque se mezcla un grupo (balas) con un array (momias) y Phaser
    // invierte el orden de los argumentos. Ver systems/CollisionUtils.js.
    this.physics.add.overlap(this.bullets, this.mummies, (a, b) => {
      const [bullet, mummy] = pairBy(Bullet, a, b);
      bullet.deactivate();
      mummy.takeBulletHit();
    });
  }

  // -------------------------------------------------------------------------
  // Oleadas y rocas
  // -------------------------------------------------------------------------

  /**
   * Programa la siguiente oleada. Se reprograma sola con un intervalo aleatorio
   * en lugar de usar un evento en bucle, porque el intervalo cambia cada vez.
   */
  scheduleWave() {
    const delay = Phaser.Math.Between(...LEVEL2.waveIntervalMs);

    this.waveTimer = this.time.delayedCall(delay, () => {
      if (this.phase !== 1 || this.isFinished) return;

      this.spawnWave();
      this.scheduleWave();
    });
  }

  /** Levanta hasta dos momias por oleada, sin pasar del máximo simultáneo. */
  spawnWave() {
    const dormant = this.mummies.filter((mummy) => !mummy.active);
    const toSpawn = Math.min(2, dormant.length);

    for (let i = 0; i < toSpawn; i++) {
      const [column, row] = Phaser.Utils.Array.GetRandom(MUMMY_SPAWNS);
      dormant[i].spawnAt(columnCenter(column), rowTop(row) - 80);
    }
  }

  scheduleBoulder() {
    const delay = Phaser.Math.Between(...LEVEL2.boulderIntervalMs);

    this.boulderTimer = this.time.delayedCall(delay, () => {
      if (this.phase !== 1 || this.isFinished) return;

      this.spawnBoulder();
      this.scheduleBoulder();
    });
  }

  spawnBoulder() {
    const [column, row, direction] = Phaser.Utils.Array.GetRandom(BOULDER_SOURCES);
    const boulder = this.boulders.get(columnCenter(column), rowTop(row) - 48);

    if (boulder) {
      boulder.roll(columnCenter(column), rowTop(row) - 48, direction, this.time.now);
    }
  }

  // -------------------------------------------------------------------------
  // Bucle del nivel
  // -------------------------------------------------------------------------

  updateLevel(now, delta) {
    this.updateHeatShield(delta);
    this.updateSurvival(delta);
    this.updateQuicksand(now, delta);

    this.mummies.forEach((mummy) => mummy.update(now, this.player));
  }

  /**
   * Escudo térmico. Al agotarse quedan 2 s de gracia (el HUD parpadea en rojo);
   * si nadie recoge un talismán en ese margen, el calor mata.
   */
  updateHeatShield(delta) {
    this.heatRemainingMs -= delta;

    if (this.heatRemainingMs <= -LEVEL2.heatGraceMs) {
      this.loseLife();
    }
  }

  updateSurvival(delta) {
    if (this.phase !== 1) return;

    this.survivalRemainingMs -= delta;
    if (this.survivalRemainingMs <= 0) this.startPhaseTwo();
  }

  /**
   * Arena movediza: frena a la mitad y, si te paras dentro, te atrapa. Salir
   * exige 10 pulsos de salto en 3 s; si se agota la ventana, el contador vuelve
   * a cero y hay que insistir.
   */
  updateQuicksand(now, delta) {
    if (this.isStuck) {
      this.updateStruggle(now);
      return;
    }

    if (!this.isOnQuicksand()) {
      this.player.speedMultiplier = 1;
      this.player.clearTint();
      this.stillMs = 0;
      return;
    }

    this.player.speedMultiplier = LEVEL2.quicksandSpeedFactor;
    this.player.setTint(0xffcc99);

    // Quieto dentro de la arena = te vas hundiendo.
    if (Math.abs(this.player.body.velocity.x) < 20) {
      this.stillMs += delta;
      if (this.stillMs >= LEVEL2.quicksandStuckMs) this.enterStuck(now);
    } else {
      this.stillMs = 0;
    }
  }

  isOnQuicksand() {
    if (!this.player.body.onFloor()) return false;

    const column = Math.floor(this.player.x / TILE);
    return this.quicksandColumns.has(column);
  }

  enterStuck(now) {
    this.isStuck = true;
    this.stillMs = 0;
    this.escapeTaps = 0;
    this.escapeWindowEndsAt = now + LEVEL2.quicksandEscapeWindowMs;

    this.player.movementLocked = true;
    this.player.setTint(0xcc8844);
  }

  updateStruggle(now) {
    // El jugador tiene `movementLocked`, así que no ha consumido la tecla de
    // salto y aquí la podemos leer para contar el forcejeo.
    if (this.controls.pressedJump()) this.escapeTaps += 1;

    if (this.escapeTaps >= LEVEL2.quicksandEscapeTaps) {
      this.exitStuck();
      return;
    }

    if (now >= this.escapeWindowEndsAt) {
      this.escapeTaps = 0;
      this.escapeWindowEndsAt = now + LEVEL2.quicksandEscapeWindowMs;
    }
  }

  exitStuck() {
    this.isStuck = false;
    this.stillMs = 0;
    this.player.movementLocked = false;
    this.player.clearTint();

    // Salto de salida, para que salir se sienta como zafarse de golpe.
    this.player.setVelocityY(PLAYER.jumpVelocity);
  }

  // -------------------------------------------------------------------------
  // Fases
  // -------------------------------------------------------------------------

  /** Fin de la supervivencia: se rompe el sello y se libera el artefacto. */
  startPhaseTwo() {
    this.phase = 2;
    this.survivalRemainingMs = 0;

    this.waveTimer?.remove();
    this.boulderTimer?.remove();

    // Roto el sello, la maldición se apaga: las momias no vuelven a levantarse.
    this.mummies.forEach((mummy) => {
      if (mummy.active) mummy.banish();
    });

    this.spawnFinalArtifact();
  }

  /** Artefacto que genera el escudo de la ciudad, en el centro del mapa. */
  spawnFinalArtifact() {
    const x = columnCenter(ARTIFACT_COLUMN);
    const y = rowTop(GROUND_ROW) - 64;

    this.finalArtifact = this.physics.add.sprite(x, y, 'city_artifact');
    this.finalArtifact.body.setAllowGravity(false);
    this.finalArtifact.setDisplaySize(104, 104);
    this.finalArtifact.body.setSize(96, 96);
    this.finalArtifact.play('city-artifact-pulse');

    // Aparición: destello y latido continuo para que se vea desde lejos.
    this.finalArtifact.setScale(0);
    this.tweens.add({
      targets: this.finalArtifact,
      scale: 104 / 64,
      duration: 600,
      ease: 'Back.easeOut',
    });
    this.cameras.main.flash(400, 255, 220, 150);

    this.physics.add.overlap(this.player, this.finalArtifact, () => this.completeLevel());
  }

  // -------------------------------------------------------------------------
  // Talismán del escudo
  // -------------------------------------------------------------------------

  collectShield() {
    playSfx(this, 'sfx_collect');
    this.heatRemainingMs = LEVEL2.heatShieldMs;
    this.relocateShield();
  }

  /**
   * Lo lleva a un punto válido al azar: distinto del anterior y, si se puede,
   * dentro de un radio alcanzable.
   *
   * El filtro por distancia es la otra mitad de "que no sea imposible llegar":
   * un punto accesible pero al otro extremo del mapa mata igual, porque el
   * escudo dura 15 s y la arena movediza reduce la velocidad a la mitad.
   */
  relocateShield() {
    if (this.validSpawnPoints.length === 0) return;

    const others = this.validSpawnPoints.filter((p) => p !== this.lastShieldPoint);
    const pool = others.length > 0 ? others : this.validSpawnPoints;

    const nearby = pool.filter(
      (p) => Math.abs(p.x - this.player.x) <= SHIELD_MAX_DISTANCE,
    );

    // Si no hay ninguno cerca (el jugador está en una esquina), vale cualquiera.
    const point = Phaser.Utils.Array.GetRandom(nearby.length > 0 ? nearby : pool);

    this.lastShieldPoint = point;
    this.shieldArtifact.setPosition(point.x, point.y);

    // Pequeño destello de reaparición.
    this.shieldArtifact.setAlpha(0.2);
    this.tweens.add({ targets: this.shieldArtifact, alpha: 1, duration: 260 });
  }

  // -------------------------------------------------------------------------
  // Estado del HUD
  // -------------------------------------------------------------------------

  getHudState() {
    const now = this.time.now;

    return {
      ...super.getHudState(),

      timer:
        this.phase === 1
          ? { label: 'AGUANTA', remainingMs: Math.max(0, this.survivalRemainingMs) }
          : { text: '¡ARTEFACTO LIBERADO!  VE AL CENTRO' },

      shield: {
        remainingMs: Math.max(0, this.heatRemainingMs),
        totalMs: LEVEL2.heatShieldMs,
        // Por debajo de cero estamos en los 2 s de gracia.
        inGrace: this.heatRemainingMs <= 0,
      },

      doubleJump: {
        ready: this.player.doubleJumpCooldown.isReady(now),
        progress: this.player.doubleJumpCooldown.progress(now),
      },

      // La brújula apunta al talismán, que es lo que se mueve y lo que mata si
      // no lo encuentras. El artefacto final está en un sitio fijo y conocido.
      compass: {
        target: this.shieldArtifact.active
          ? { x: this.shieldArtifact.x, y: this.shieldArtifact.y }
          : null,
      },
    };
  }

  /** Con una sola vida no hay reaparición, pero se deja coherente por si cambia. */
  resetEnemies() {
    this.mummies.forEach((mummy) => {
      if (mummy.active) mummy.disableBody(true, true);
    });

    this.boulders.getChildren().forEach((boulder) => boulder.deactivate());

    this.heatRemainingMs = LEVEL2.heatShieldMs;
    this.exitStuck();
  }
}

// ---------------------------------------------------------------------------
// Ayudas de rejilla
// ---------------------------------------------------------------------------

function cellKey(column, row) {
  return `${column},${row}`;
}

function rowTop(row) {
  return row * TILE;
}

function rowCenter(row) {
  return row * TILE + TILE / 2;
}

function columnCenter(column) {
  return column * TILE + TILE / 2;
}
