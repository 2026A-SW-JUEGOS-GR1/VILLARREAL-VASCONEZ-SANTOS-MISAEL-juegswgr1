import Phaser from '../lib/phaser.js';
import { LEVEL3 } from '../config/GameConfig.js';

/**
 * Trampa de pared lanza-shuriken (nivel 3).
 *
 * Panel fijo que dispara un shuriken en horizontal cada 2-3 segundos con
 * trayectoria fija (no apunta al jugador): así el jugador puede aprenderse el
 * ritmo y cronometrar el paso, en lugar de recibir un proyectil teledirigido.
 *
 * Es decoración con lógica, no un cuerpo físico: no hace falta que colisione con
 * nada, solo emitir. De ahí que sea un Image normal y no un sprite de Arcade.
 */
export default class ShurikenTrap extends Phaser.GameObjects.Image {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {number} direction -1 dispara a la izquierda, 1 a la derecha.
   */
  constructor(scene, x, y, direction) {
    super(scene, x, y, 'shuriken_trap_wall');

    scene.add.existing(this);

    this.direction = direction;
    this.setDisplaySize(64, 64);
    // El panel mira hacia donde dispara.
    this.setFlipX(direction < 0);

    // Cada trampa arranca con un desfase aleatorio para que no disparen todas al
    // unísono y el nivel no se convierta en una única ventana de paso.
    this.nextFireAt = Phaser.Math.Between(0, LEVEL3.trapFireIntervalMs[1]);
  }

  /**
   * @param {number} now Reloj de la escena.
   * @param {Phaser.Physics.Arcade.Group} shurikens Pool de proyectiles.
   */
  update(now, shurikens) {
    if (now < this.nextFireAt) return;

    this.nextFireAt = now + Phaser.Math.Between(...LEVEL3.trapFireIntervalMs);

    const shuriken = shurikens.get(this.x, this.y);
    if (!shuriken) return;

    // Sale por delante del panel, no desde su centro.
    shuriken.throwAt(this.x + 36 * this.direction, this.y, this.direction, LEVEL3.trapShurikenSpeed);
  }
}
