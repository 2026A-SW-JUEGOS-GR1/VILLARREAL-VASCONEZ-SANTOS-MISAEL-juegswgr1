import BaseLevelScene from './BaseLevelScene.js';
import { TILE, LEVEL1 } from '../config/GameConfig.js';
import MovingPlatform from '../entities/MovingPlatform.js';
import FakeFloor from '../entities/FakeFloor.js';
import RomanSoldier from '../entities/RomanSoldier.js';
import Bullet from '../entities/Bullet.js';
import { pairBy } from '../systems/CollisionUtils.js';
import { playSfx } from '../systems/AudioManager.js';

/**
 * Rejilla del nivel. Todo se coloca por (columna, fila) de 64 px, así que el
 * diseño es legible y encaja con las alturas de salto de GameConfig.
 */
const ROWS = 10;
/** Fila de la superficie del suelo. */
const GROUND_ROW = 8;
/** Fila del fondo de los pozos, donde van los pinchos. */
const SPIKE_ROW = 9;

/**
 * Tramos de suelo firme, en columnas [desde, hasta] inclusive.
 * Los huecos entre ellos son los acantilados que hay que cruzar.
 */
const FLOOR_RUNS = [
  [0, 14], // Sección A
  [20, 27], // Sección B
  [31, 37], // Sección B (tras el pozo de suelo falso)
  [41, 62], // Sección C
];

/** Columnas ocupadas por losas de suelo falso (sobre un pozo con pinchos). */
const FAKE_FLOOR_COLUMNS = [28, 29, 30];

/**
 * Pozos con pinchos al fondo, en columnas [desde, hasta].
 *
 * Ojo con el ancho: un salto cubre 277 px en horizontal (1,39 s de vuelo a
 * 200 px/s), o sea 4,3 tiles. Un hueco de 5 tiles (320 px) es IMPOSIBLE de
 * saltar y solo se cruza con plataforma móvil; de 4 (256 px) deja 21 px de
 * margen, demasiado justo. Sin plataforma, máximo 3 tiles.
 */
const SPIKE_PITS = [
  [15, 19], // Acantilado 1 (5 tiles): se cruza con la plataforma horizontal
  [28, 30], // Pozo bajo las losas falsas
  [38, 40], // Acantilado 2 (3 tiles): se cruza de un salto, con 85 px de margen
];

/** Repisas fijas: [columna, fila, ancho en tiles]. */
const LEDGES = [
  [5, 6, 3],
  [9, 5, 2],
  // Repisa del segundo fragmento: fila 3 = 5 tiles (320 px) sobre el suelo.
  // Se alcanza subiendo en la plataforma vertical (+214 px) y saltando desde
  // ella (+192 px): sobran 86 px de margen. Está desplazada a la izquierda de la
  // plataforma a propósito, para que el salto no choque con su cara inferior.
  [32, 3, 3],
  [47, 6, 2],
];

/**
 * NIVEL 1 — Antigua Roma.
 *
 * Mapa lineal de 3 secciones separadas por acantilados con pinchos. Objetivo:
 * recoger los 3 fragmentos de la gema de protección.
 *
 * Mecánicas propias:
 *  - Plataformas móviles (horizontal para cruzar el primer acantilado, vertical
 *    para alcanzar la repisa del segundo fragmento).
 *  - Losas de suelo falso que ceden un segundo después de pisarlas.
 *  - Legionarios romanos que patrullan y cargan con la lanza.
 */
export default class Level1Scene extends BaseLevelScene {
  constructor() {
    super({ key: 'Level1Scene' });
  }

  init(data) {
    super.init(data);

    this.totalGems = 3;
    this.soldiers = [];
    this.fakeFloors = [];
    this.movingPlatforms = [];
  }

  /** El mundo es más alto que la pantalla para que quepan los pozos. */
  getWorldHeight() {
    return ROWS * TILE;
  }

  getSpawnPoint() {
    return { x: 96, y: rowTop(GROUND_ROW) - 112 };
  }

  // -------------------------------------------------------------------------
  // Terreno
  // -------------------------------------------------------------------------

  buildTerrain() {
    this.platforms = this.physics.add.staticGroup();

    FLOOR_RUNS.forEach(([from, to]) => {
      for (let column = from; column <= to; column++) {
        this.addTile(column, GROUND_ROW, this.level.floorTexture);
      }
    });

    LEDGES.forEach(([column, row, width]) => {
      for (let i = 0; i < width; i++) {
        this.addTile(column + i, row, this.level.floorTexture);
      }
    });

    this.buildSpikes();
    this.buildFakeFloors();
  }

  /** Coloca un tile sólido de 64x64 en (columna, fila). */
  addTile(column, row, texture) {
    const tile = this.platforms.create(columnCenter(column), rowCenter(row), texture);
    tile.setDisplaySize(TILE, TILE);
    tile.refreshBody();
    return tile;
  }

  buildSpikes() {
    this.spikes = this.physics.add.staticGroup();

    SPIKE_PITS.forEach(([from, to]) => {
      for (let column = from; column <= to; column++) {
        const spike = this.spikes.create(columnCenter(column), rowCenter(SPIKE_ROW), 'spikes');
        spike.setDisplaySize(TILE, TILE);
        spike.refreshBody();
      }
    });
  }

  buildFakeFloors() {
    this.fakeFloors = FAKE_FLOOR_COLUMNS.map(
      (column) => new FakeFloor(this, columnCenter(column), rowCenter(GROUND_ROW)),
    );
  }

  // -------------------------------------------------------------------------
  // Objetos, plataformas móviles y enemigos
  // -------------------------------------------------------------------------

  buildLevel() {
    this.buildMovingPlatforms();
    this.buildGems();
    this.buildSoldiers();
    this.registerInteractions();
  }

  buildMovingPlatforms() {
    const { horizontal, vertical } = LEVEL1.movingPlatform;

    this.movingPlatforms = [
      // Cruza el primer acantilado (columnas 15-19).
      new MovingPlatform(this, columnCenter(15) + TILE / 2, rowTop(7) + 16, {
        axis: 'horizontal',
        distance: horizontal.distance,
        durationMs: horizontal.durationMs,
      }),
      // Sube hasta la repisa del segundo fragmento. Va en la columna 36, a la
      // derecha de la repisa (columnas 32-34), para que se salte en diagonal
      // hacia ella en lugar de contra su parte de abajo.
      new MovingPlatform(this, columnCenter(36), rowTop(7) + 16, {
        axis: 'vertical',
        distance: vertical.distance,
        durationMs: vertical.durationMs,
      }),
    ];
  }

  buildGems() {
    if (!this.anims.exists('gem-spin')) {
      this.anims.create({
        key: 'gem-spin',
        frames: this.anims.generateFrameNumbers('gem_fragment', { start: 0, end: 5 }),
        frameRate: 8,
        repeat: -1,
      });
    }

    this.gems = this.physics.add.group({ allowGravity: false, immovable: true });

    // 1) Tras cruzar la plataforma horizontal. 2) En la repisa alta, solo
    // accesible con la plataforma vertical. 3) Al final, custodiado por dos
    // legionarios.
    const positions = [
      { id: 'gem-1', x: columnCenter(21), y: rowTop(GROUND_ROW) - 48 },
      { id: 'gem-2', x: columnCenter(33), y: rowTop(3) - 48 },
      { id: 'gem-3', x: columnCenter(58), y: rowTop(GROUND_ROW) - 48 },
    ];

    positions.forEach(({ id, x, y }) => {
      // Un fragmento ya recogido no reaparece al perder una vida.
      if (this.levelProgress.collected.includes(id)) return;

      const gem = this.gems.create(x, y, 'gem_fragment');
      gem.gemId = id;
      gem.setDisplaySize(48, 48);
      gem.body.setSize(64, 64);
      gem.play('gem-spin');
    });
  }

  buildSoldiers() {
    // Uno por sección, y dos vigilando el último fragmento.
    const spawns = [
      { column: 11, patrolRange: 150 },
      { column: 24, patrolRange: 130 },
      { column: 55, patrolRange: 160 },
      { column: 60, patrolRange: 120 },
    ];

    this.soldiers = spawns.map(
      ({ column, patrolRange }) =>
        new RomanSoldier(
          this,
          columnCenter(column),
          rowTop(GROUND_ROW) - 80,
          patrolRange,
        ),
    );
  }

  registerInteractions() {
    // --- Jugador ---
    this.physics.add.collider(this.player, this.movingPlatforms);
    this.physics.add.collider(this.player, this.fakeFloors, (player, floor) =>
      floor.touch(this.time.now),
    );
    this.physics.add.overlap(this.player, this.spikes, () => this.loseLife());
    this.physics.add.overlap(this.player, this.gems, (player, gem) => this.collectGem(gem));

    // --- Enemigos ---
    // Pisan el suelo normal y el falso, pero NO lo activan ni los pinchos les
    // afectan: son inmunes a las trampas del escenario.
    this.physics.add.collider(this.soldiers, this.platforms);
    this.physics.add.collider(this.soldiers, this.fakeFloors);

    // --- Balas ---
    // `pairBy` es obligatorio aquí: al mezclar un grupo (balas) con un array
    // (losas, legionarios) Phaser invierte el orden de los argumentos del
    // callback. Ver la explicación en systems/CollisionUtils.js.
    this.physics.add.collider(this.bullets, this.fakeFloors, (a, b) => {
      const [bullet] = pairBy(Bullet, a, b);
      bullet.deactivate();
    });

    this.physics.add.overlap(this.bullets, this.soldiers, (a, b) => {
      const [bullet, soldier] = pairBy(Bullet, a, b);
      bullet.deactivate();
      soldier.takeBulletHit();
    });
  }

  // -------------------------------------------------------------------------
  // Bucle del nivel
  // -------------------------------------------------------------------------

  /** @param {number} now Reloj de la escena (ver BaseLevelScene.update). */
  updateLevel(now) {
    this.carryRiders();

    this.fakeFloors.forEach((floor) => floor.update(now));
    this.soldiers.forEach((soldier) => soldier.update(now, this.player));
  }

  /**
   * Arrastra a Drago con la plataforma que esté pisando.
   *
   * Es necesario porque las plataformas se mueven por tween y no por física
   * (ver MovingPlatform): Arcade no propaga ese movimiento al cuerpo que va
   * encima, así que se le suma el desplazamiento del frame a mano.
   */
  carryRiders() {
    this.movingPlatforms.forEach((platform) => {
      platform.refreshDelta();

      if (platform.isCarrying(this.player)) {
        this.player.x += platform.deltaX;
        this.player.y += platform.deltaY;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Objetivo
  // -------------------------------------------------------------------------

  collectGem(gem) {
    if (!gem.active) return;

    playSfx(this, 'sfx_collect');
    this.levelProgress.collected.push(gem.gemId);
    gem.destroy();

    if (this.levelProgress.collected.length >= this.totalGems) {
      this.completeLevel();
    }
  }

  /** Al reaparecer: legionarios y losas falsas vuelven a su estado inicial. */
  resetEnemies() {
    this.soldiers.forEach((soldier) => soldier.reset());
    this.fakeFloors.forEach((floor) => floor.reset());
  }

  getHudState() {
    return {
      ...super.getHudState(),
      objective: {
        label: 'FRAGMENTOS',
        current: this.levelProgress.collected.length,
        total: this.totalGems,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Ayudas de rejilla
// ---------------------------------------------------------------------------

/** Borde superior de una fila, en píxeles. */
function rowTop(row) {
  return row * TILE;
}

/** Centro vertical de una fila. */
function rowCenter(row) {
  return row * TILE + TILE / 2;
}

/** Centro horizontal de una columna. */
function columnCenter(column) {
  return column * TILE + TILE / 2;
}
