/**
 * Ayudas para los callbacks de colisión de Arcade Physics.
 */

/**
 * Devuelve `[instanciaDeTipo, elOtro]` a partir de los dos argumentos que Phaser
 * pasa a un callback de colisión, sin depender del orden en que los entregue.
 *
 * Hace falta porque ese orden NO es fiable cuando se mezcla un grupo con un
 * array. Comprobado en Phaser 3.90: con
 *
 *     this.physics.add.overlap(grupoDeBalas, arrayDeEnemigos, cb)
 *
 * Phaser resuelve internamente por `collideSpriteVsGroup` tratando el elemento
 * del array como "sprite" y el grupo como "grupo", así que invoca el callback
 * como `cb(enemigo, bala)` — al revés de como se declararon los objetos. Asumir
 * el orden provocaba un `TypeError` que rompía el bucle de render y congelaba el
 * juego entero.
 *
 * @template T
 * @param {new (...args: any[]) => T} Type Clase del objeto que se quiere primero.
 * @param {object} a Primer argumento del callback.
 * @param {object} b Segundo argumento del callback.
 * @returns {[T, object]}
 */
export function pairBy(Type, a, b) {
  return a instanceof Type ? [a, b] : [b, a];
}
