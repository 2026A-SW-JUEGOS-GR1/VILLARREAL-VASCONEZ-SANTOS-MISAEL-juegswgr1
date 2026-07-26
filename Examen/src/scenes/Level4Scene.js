import BaseLevelScene from './BaseLevelScene.js';
import { TILE, LEVEL4 } from '../config/GameConfig.js';
import Executioner from '../entities/Executioner.js';
import PendulumAxe from '../entities/PendulumAxe.js';
import AirPlatform from '../entities/AirPlatform.js';
import Bullet from '../entities/Bullet.js';
import { pairBy } from '../systems/CollisionUtils.js';
import { playSfx } from '../systems/AudioManager.js';

/** Rejilla: 63 columnas x 12 filas de 64 px. */
const ROWS = 12;
/** Fila de las plataformas principales. */
const MAIN_ROW = 8;
/** Fila del foso de ácido, al fondo del mapa. */
const ACID_ROW = 10;

/**
 * Terreno sólido: [columna, fila, ancho en tiles].
 *
 * Aquí no hay suelo continuo: la fortaleza es un conjunto de islas sobre el
 * foso de ácido, y todo hueco entre ellas es mortal.
 */
const LEDGES = [
  [0, MAIN_ROW, 13], // Patio de entrada
  [5, 6, 3], // Repisa de la primera llave
  [12, 7, 1], // Muro contra el que se estrella el verdugo del patio

  [16, MAIN_ROW, 3], // Isla 1 de la sala de las hachas
  [21, MAIN_ROW, 3], // Isla 2
  [17, 4, 1], // Techo del que cuelga la primera hacha
  [22, 4, 1], // Techo de la segunda

  [26, MAIN_ROW, 6], // Sala de la palanca

  [43, MAIN_ROW, 4], // Antesala de los impulsos de aire
  /**
   * Galería del portón, a 128 px de la plataforma de impulso.
   *
   * Esa distancia está elegida para que el salto funcione con cualquier forma de
   * volarlo. Los pies quedan por encima de la galería entre los 116 px y los
   * 276 px de avance, así que:
   *  - Manteniendo "derecha" desde el despegue se llega a los 128 px en 0,64 s,
   *    ya pasado el umbral de 0,58 s (a 200 px/s es imposible llegar antes).
   *  - Subiendo recto y desplazándose después quedan 160 px de alcance, de sobra
   *    para los 128 px necesarios.
   *
   * Pegada a la plataforma, quien mantuviera "derecha" se estrellaría contra su
   * lateral y caería al ácido.
   */
  [51, 3, 12],
  [62, 2, 1], // Muro del fondo
];

/**
 * Plataformas mágicas del grupo A: el puente que cruza el ácido hacia adelante.
 * Sólidas al empezar. Formato [columna, fila] con la plataforma ocupando 2 tiles.
 */
const GROUP_A = [
  [33, 7],
  [36, 7],
  [39, 7],
];

/**
 * Grupo B: escalera que sube a la tercera llave. Fantasma al empezar.
 *
 * Va hacia arriba y a la IZQUIERDA, quedando siempre sobre la sala de la palanca:
 * así, al caerse de ella, se aterriza en suelo firme y no en el ácido.
 */
const GROUP_B = [
  [30, 6],
  [28, 4],
  [26, 2],
];

/** Hachas péndulo: [columna, fila del pivote, desfase 0-1]. */
const AXES = [
  [17, 5, 0],
  [22, 5, 0.5],
];

/** Plataformas de impulso de aire: [columna, fila de la superficie]. */
const AIR_PLATFORMS = [[48, MAIN_ROW]];

/** Llaves del Rey: [columna, fila de la superficie]. */
const KEY_SPAWNS = [
  [6, 6], // En la repisa del patio
  [22, MAIN_ROW], // Entre las hachas
  [26, 2], // En lo alto de la escalera del grupo B
];

/** Verdugos: [columna, fila de la superficie, radio de patrulla]. */
const EXECUTIONER_SPAWNS = [
  [9, MAIN_ROW, 150],
  [45, MAIN_ROW, 90],
  [57, 3, 140],
];

/** Palanca, portón y artefacto final: [columna, fila de la superficie]. */
const LEVER = [28, MAIN_ROW];
const DOOR = [53, 3];
const ARTIFACT = [58, 3];

/**
 * NIVEL 4 — Fortaleza Medieval.
 *
 * El último escenario, y el único que Kaelen construyó: no está en ningún
 * registro histórico. Objetivo: reunir 3 llaves, abrir el portón y tomar el
 * artefacto que cierra la línea temporal.
 *
 * Mecánicas propias:
 *  - **Foso de ácido** cubriendo todo el fondo: no hay suelo continuo, la
 *    fortaleza es un conjunto de islas.
 *  - **Hachas péndulo** que oscilan del techo, con el hitbox solo en el filo.
 *  - **Palanca A/B**: intercambia dos grupos de plataformas mágicas. El grupo A
 *    es el puente que lleva hacia adelante; el B, la escalera a la tercera llave.
 *    Hay que accionarla al menos dos veces para completar el nivel.
 *  - **Impulsos de aire** cada 3 s, con aviso previo.
 *  - **Verdugos** que embisten y quedan aturdidos al chocar.
 */
export default class Level4Scene extends BaseLevelScene {
  constructor() {
    super({ key: 'Level4Scene' });
  }

  init(data) {
    super.init(data);

    this.executioners = [];
    this.axes = [];
    this.airPlatforms = [];
    /** true = grupo A sólido; false = grupo B sólido. */
    this.groupASolid = true;
    this.doorOpen = false;
  }

  getWorldHeight() {
    return ROWS * TILE;
  }

  getSpawnPoint() {
    return { x: columnCenter(2), y: rowTop(MAIN_ROW) - 112 };
  }

  // -------------------------------------------------------------------------
  // Terreno
  // -------------------------------------------------------------------------

  buildTerrain() {
    this.platforms = this.physics.add.staticGroup();

    LEDGES.forEach(([column, row, width]) => {
      for (let i = 0; i < width; i++) {
        this.addTile(column + i, row);
      }
    });

    this.buildAcid();
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

  /** Franja de ácido de lado a lado. Cada charco cubre 2 columnas. */
  buildAcid() {
    if (!this.anims.exists('acid-bubble')) {
      this.anims.create({
        key: 'acid-bubble',
        frames: this.anims.generateFrameNumbers('acid_pool', { start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1,
      });
    }

    this.acid = this.physics.add.staticGroup();
    const columns = Math.ceil(this.worldWidth / TILE);

    for (let column = 0; column < columns; column += 2) {
      const pool = this.acid.create(column * TILE + TILE, rowCenter(ACID_ROW), 'acid_pool');
      pool.setDisplaySize(128, 64);
      pool.refreshBody();
      pool.play('acid-bubble');
    }
  }

  // -------------------------------------------------------------------------
  // Objetos, trampas y enemigos
  // -------------------------------------------------------------------------

  buildLevel() {
    this.createAnimations();
    this.createMagicPlatforms();
    this.createLever();
    this.createAxes();
    this.createAirPlatforms();
    this.createKeys();
    this.createDoor();
    this.createArtifact();
    this.createExecutioners();
    this.registerInteractions();

    this.applyGroupState();
  }

  createAnimations() {
    [
      ['key-spin', 'medieval_key'],
      ['artifact-pulse', 'final_artifact'],
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

  /**
   * Los dos grupos de plataformas mágicas. Ambos existen siempre; lo que cambia
   * es cuál tiene el cuerpo activo. Se usan grupos estáticos porque no se mueven:
   * solo aparecen y desaparecen.
   */
  createMagicPlatforms() {
    this.groupA = this.physics.add.staticGroup();
    this.groupB = this.physics.add.staticGroup();

    const build = (group, positions, texture) =>
      positions.forEach(([column, row]) => {
        const platform = group.create(column * TILE + TILE, rowTop(row) + 16, texture);
        platform.setDisplaySize(128, 32);
        platform.refreshBody();
      });

    build(this.groupA, GROUP_A, 'platform_group_a');
    build(this.groupB, GROUP_B, 'platform_group_b');
  }

  createLever() {
    const [column, row] = LEVER;

    this.lever = this.add
      .image(columnCenter(column), rowTop(row) - 32, 'lever')
      .setDisplaySize(48, 64);
  }

  createAxes() {
    this.axes = AXES.map(
      ([column, row, phase]) => new PendulumAxe(this, columnCenter(column), rowTop(row), phase),
    );
  }

  createAirPlatforms() {
    this.airPlatforms = AIR_PLATFORMS.map(
      ([column, row]) => new AirPlatform(this, column * TILE + TILE, rowTop(row) + 24),
    );
  }

  createKeys() {
    this.keys = this.physics.add.group({ allowGravity: false, immovable: true });

    KEY_SPAWNS.forEach(([column, row], index) => {
      const id = `key-${index}`;
      // Una llave ya recogida no reaparece al perder una vida.
      if (this.levelProgress.collected.includes(id)) return;

      const key = this.keys.create(columnCenter(column), rowTop(row) - 48, 'medieval_key');
      key.keyId = id;
      key.setDisplaySize(48, 48);
      key.body.setSize(56, 56);
      key.play('key-spin');
    });
  }

  /**
   * El portón es sólido hasta reunir las 3 llaves. Al abrirse basta con
   * desactivar su cuerpo: la imagen se queda como marco.
   */
  createDoor() {
    const [column, row] = DOOR;

    this.door = this.physics.add.staticImage(
      columnCenter(column),
      rowTop(row) - 96,
      'exit_door',
    );
    this.door.setDisplaySize(128, 192);
    this.door.refreshBody();
  }

  createArtifact() {
    const [column, row] = ARTIFACT;

    this.artifact = this.physics.add.sprite(
      columnCenter(column),
      rowTop(row) - 52,
      'final_artifact',
    );
    this.artifact.body.setAllowGravity(false);
    this.artifact.setDisplaySize(80, 80);
    this.artifact.body.setSize(80, 80);
    this.artifact.play('artifact-pulse');
  }

  createExecutioners() {
    this.executioners = EXECUTIONER_SPAWNS.map(
      ([column, row, patrolRange]) =>
        new Executioner(this, columnCenter(column), rowTop(row) - 80, patrolRange),
    );
  }

  registerInteractions() {
    // --- Jugador ---
    this.playerVsGroupA = this.physics.add.collider(this.player, this.groupA);
    this.playerVsGroupB = this.physics.add.collider(this.player, this.groupB);
    this.physics.add.collider(this.player, this.door);
    this.physics.add.collider(this.player, this.airPlatforms);

    this.physics.add.overlap(this.player, this.acid, () => this.loseLife());
    this.physics.add.overlap(this.player, this.keys, (player, key) => this.collectKey(key));
    this.physics.add.overlap(this.player, this.artifact, () => this.completeLevel());

    // El filo de cada hacha lleva su propio cuerpo, separado de la cadena.
    this.axes.forEach((axe) => {
      this.physics.add.overlap(this.player, axe.hitbox, () => this.loseLife());
    });

    // Solo hace daño mientras embiste: esquivar la carga es la defensa.
    this.physics.add.overlap(this.player, this.executioners, (a, b) => {
      const executioner = a === this.player ? b : a;
      if (executioner.isCharging()) this.loseLife();
    });

    // --- Enemigos ---
    // Inmunes a las trampas: pisan el terreno y las plataformas mágicas, pero el
    // ácido y las hachas no les afectan.
    this.physics.add.collider(this.executioners, this.platforms);
    this.physics.add.collider(this.executioners, this.groupA);

    // --- Balas ---
    this.physics.add.overlap(this.bullets, this.executioners, (a, b) => {
      const [bullet, executioner] = pairBy(Bullet, a, b);
      bullet.deactivate();
      executioner.takeBulletHit();
    });
  }

  // -------------------------------------------------------------------------
  // Bucle del nivel
  // -------------------------------------------------------------------------

  updateLevel(now) {
    this.axes.forEach((axe) => axe.update());
    this.airPlatforms.forEach((platform) => platform.update(now, this.player));
    this.executioners.forEach((executioner) => executioner.update(now, this.player));

    if (this.controls.pressedInteract()) this.tryUseLever();
  }

  // -------------------------------------------------------------------------
  // Palanca y plataformas mágicas
  // -------------------------------------------------------------------------

  /** Acciona la palanca si Drago está a su lado. */
  tryUseLever() {
    const distance = Math.abs(this.player.x - this.lever.x);
    if (distance > 90) return;

    this.groupASolid = !this.groupASolid;
    this.applyGroupState();

    // La palanca gira al accionarse.
    this.tweens.add({
      targets: this.lever,
      angle: this.groupASolid ? 0 : 40,
      duration: 180,
    });
  }

  /**
   * Aplica el estado de los grupos: el sólido se ve entero y colisiona; el otro
   * queda fantasma (semitransparente y atravesable).
   *
   * Se activan y desactivan los *colliders* además de los cuerpos, para que el
   * grupo fantasma no frene tampoco a los enemigos.
   */
  applyGroupState() {
    const setGroup = (group, solid) => {
      group.getChildren().forEach((platform) => {
        platform.body.enable = solid;
        platform.setAlpha(solid ? 1 : 0.28);
      });
    };

    setGroup(this.groupA, this.groupASolid);
    setGroup(this.groupB, !this.groupASolid);

    this.playerVsGroupA.active = this.groupASolid;
    this.playerVsGroupB.active = !this.groupASolid;
  }

  // -------------------------------------------------------------------------
  // Llaves y portón
  // -------------------------------------------------------------------------

  collectKey(key) {
    if (!key.active) return;

    playSfx(this, 'sfx_collect');
    this.levelProgress.collected.push(key.keyId);
    this.levelProgress.keys = this.levelProgress.collected.length;
    key.destroy();

    if (this.levelProgress.keys >= LEVEL4.keysRequired) this.openDoor();
  }

  openDoor() {
    if (this.doorOpen) return;

    this.doorOpen = true;
    this.door.body.enable = false;

    this.tweens.add({
      targets: this.door,
      alpha: 0.25,
      duration: 700,
    });
    this.cameras.main.flash(400, 120, 190, 255);
  }

  // -------------------------------------------------------------------------
  // Estado del HUD
  // -------------------------------------------------------------------------

  getHudState() {
    return {
      ...super.getHudState(),
      objective: {
        label: 'LLAVES',
        current: this.levelProgress.keys,
        total: LEVEL4.keysRequired,
      },
    };
  }

  /**
   * Al reaparecer: verdugos a su sitio y la palanca al estado inicial. Las llaves
   * ya recogidas siguen recogidas, y el portón sigue abierto si lo estaba.
   */
  resetEnemies() {
    this.executioners.forEach((executioner) => executioner.reset());

    this.groupASolid = true;
    this.applyGroupState();
    this.lever.setAngle(0);
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
