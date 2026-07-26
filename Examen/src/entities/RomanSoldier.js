import EnemyBase from './EnemyBase.js';
import { ENEMY } from '../config/GameConfig.js';

/**
 * Legionario romano corrompido (nivel 1).
 *
 * Patrulla un tramo fijo; cuando detecta a Drago a menos de 150 px carga contra
 * él a 250 px/s y ataca con la lanza al ponerse a distancia corta.
 *
 * Todo su comportamiento ya está en EnemyBase: aquí solo se fijan sus estadísticas
 * y su rango de patrulla. Las subclases de los otros niveles (Momia, Ninja,
 * Verdugo) sí sobreescribirán métodos, porque cambian de patrón.
 */
export default class RomanSoldier extends EnemyBase {
  constructor(scene, x, y, patrolRange = 140) {
    super(scene, x, y, {
      spriteKey: 'roman',
      stats: ENEMY.roman,
      patrolRange,
      // 24 + 96 = 120, donde acaban sus pies en las hojas entregadas.
      bodyHeight: 96,
    });
  }
}
