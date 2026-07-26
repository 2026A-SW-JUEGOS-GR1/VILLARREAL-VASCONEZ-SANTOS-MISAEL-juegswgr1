import Phaser from '../lib/phaser.js';
import BaseLevelScene from './BaseLevelScene.js';
import { GAME_HEIGHT, TILE, LEVEL2, LEVEL3 } from '../config/GameConfig.js';

/**
 * Ficha sintética: el sandbox no es un nivel del juego, así que no está en
 * LevelConfig.js. Pide TODOS los widgets del HUD para poder revisarlos de una
 * sola pasada.
 */
const SANDBOX_LEVEL = {
  name: 'Sandbox',
  subtitle: 'Escena de pruebas',
  lives: 3,
  objective: 'Recoge los 3 fragmentos de prueba.',
  ability: 'Dash',
  hud: [
    'ammo',
    'lives',
    'objective',
    'timer',
    'shield',
    'doubleJump',
    'dash',
    'bleeding',
    'bandages',
    'compass',
  ],
  widthPx: 1800,
  backgrounds: ['level1_far', 'level1_mid', 'level1_near'],
  floorTexture: 'floor_rome',
};

/**
 * Escena de pruebas de desarrollo (no forma parte del juego).
 *
 * Existe para poder validar en ejecución las piezas del paso 2 —jugador,
 * disparo, munición, HUD, banners, pausa y fin de nivel— antes de que existan
 * los niveles reales. Se abre con `?scene=SandboxScene`.
 *
 * Las plataformas están colocadas a 2, 3 y 4 tiles de altura a propósito: sirven
 * para comprobar que el salto de 3 tiles calculado en GameConfig se siente bien
 * sobre la rejilla de 64 px.
 */
export default class SandboxScene extends BaseLevelScene {
  constructor() {
    super({ key: 'SandboxScene' });
  }

  init(data) {
    this.level = SANDBOX_LEVEL;
    super.init(data);

    this.gems = null;
    // Ambos se habilitan aquí para poder probar las dos habilidades a la vez.
    this.forceDoubleJump = true;
  }

  create() {
    super.create();

    // El sandbox concede las dos habilidades especiales, cosa que ningún nivel
    // real hace (cada época otorga una).
    this.player.enableDoubleJump = true;
    this.player.enableDash = true;

    this.startedAt = this.time.now;
  }

  // -------------------------------------------------------------------------
  // Terreno
  // -------------------------------------------------------------------------

  buildTerrain() {
    this.platforms = this.physics.add.staticGroup();

    const groundTop = GAME_HEIGHT - TILE;
    const columns = Math.ceil(this.worldWidth / TILE);

    // Suelo continuo con un hueco (columnas 11-13) para probar la caída mortal.
    for (let column = 0; column < columns; column++) {
      const isGap = column >= 11 && column <= 13;
      if (isGap) continue;

      this.addTile(column * TILE, groundTop);
    }

    // Escalones a 2, 3 y 4 tiles sobre el suelo: el salto normal llega a 3.
    this.addPlatform(5, 2, 3);
    this.addPlatform(9, 3, 2);
    this.addPlatform(16, 4, 3);
    this.addPlatform(21, 2, 4);
  }

  /** Coloca un tile sólido con su esquina superior izquierda en (x, y). */
  addTile(x, y) {
    const tile = this.platforms.create(x + TILE / 2, y + TILE / 2, this.level.floorTexture);
    tile.setDisplaySize(TILE, TILE);
    tile.refreshBody();
    return tile;
  }

  /**
   * Plataforma horizontal.
   * @param {number} column        Columna inicial, en tiles.
   * @param {number} heightInTiles Altura sobre el suelo, en tiles.
   * @param {number} widthInTiles  Longitud, en tiles.
   */
  addPlatform(column, heightInTiles, widthInTiles) {
    const y = GAME_HEIGHT - TILE * (heightInTiles + 1);

    for (let i = 0; i < widthInTiles; i++) {
      this.addTile((column + i) * TILE, y);
    }
  }

  // -------------------------------------------------------------------------
  // Objetos
  // -------------------------------------------------------------------------

  buildLevel() {
    if (!this.anims.exists('gem-spin')) {
      this.anims.create({
        key: 'gem-spin',
        frames: this.anims.generateFrameNumbers('gem_fragment', { start: 0, end: 5 }),
        frameRate: 8,
        repeat: -1,
      });
    }

    this.gems = this.physics.add.group({ allowGravity: false, immovable: true });

    // Uno accesible de un salto, otro sobre la plataforma alta, otro al final.
    [
      { x: 6 * TILE, y: GAME_HEIGHT - TILE * 4 },
      { x: 17 * TILE, y: GAME_HEIGHT - TILE * 6 },
      { x: 26 * TILE, y: GAME_HEIGHT - TILE * 2 },
    ].forEach(({ x, y }) => {
      const gem = this.gems.create(x, y, 'gem_fragment');
      gem.setDisplaySize(48, 48);
      gem.body.setSize(64, 64);
      gem.play('gem-spin');
    });

    this.physics.add.overlap(this.player, this.gems, (player, gem) => this.collectGem(gem));
  }

  collectGem(gem) {
    gem.destroy();
    this.levelProgress.collected.push('gem');

    if (this.levelProgress.collected.length >= 3) {
      this.completeLevel();
    }
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  /**
   * Amplía el estado base con el resto de widgets. Los valores de escudo,
   * sangrado y vendajes son simulados: aquí solo interesa comprobar que los
   * widgets se dibujan y se animan bien; su lógica real vive en los niveles 2 y 3.
   */
  getHudState() {
    const now = this.time.now;
    const elapsed = now - (this.startedAt ?? now);

    const shieldRemaining = LEVEL2.heatShieldMs - (elapsed % LEVEL2.heatShieldMs);
    const bleedCycle = elapsed % 12000;
    const isBleeding = bleedCycle < LEVEL3.bleedDurationMs;

    return {
      ...super.getHudState(),

      objective: {
        label: 'FRAGMENTOS',
        current: this.levelProgress.collected.length,
        total: 3,
      },
      timer: {
        label: 'PRUEBA',
        remainingMs: Math.max(0, LEVEL2.survivalMs - elapsed),
      },
      shield: {
        remainingMs: shieldRemaining,
        totalMs: LEVEL2.heatShieldMs,
        inGrace: shieldRemaining < LEVEL2.heatGraceMs,
      },
      doubleJump: {
        ready: this.player.doubleJumpCooldown.isReady(now),
        progress: this.player.doubleJumpCooldown.progress(now),
      },
      dash: {
        ready: this.player.dashCooldown.isReady(now),
        progress: this.player.dashCooldown.progress(now),
      },
      bleeding: {
        active: isBleeding,
        remainingMs: LEVEL3.bleedDurationMs - bleedCycle,
      },
      bandages: { count: LEVEL3.startingBandages },
      compass: { target: this.getFarthestGem() },
    };
  }

  /** Posición del fragmento más lejano, para probar la flecha de la brújula. */
  getFarthestGem() {
    const remaining = this.gems?.getChildren().filter((gem) => gem.active) ?? [];
    if (remaining.length === 0) return null;

    return remaining.reduce((farthest, gem) =>
      Math.abs(gem.x - this.player.x) > Math.abs(farthest.x - this.player.x) ? gem : farthest,
    );
  }
}
