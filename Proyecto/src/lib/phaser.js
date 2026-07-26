/**
 * Punto único de entrada de Phaser para todo el proyecto.
 *
 * El build ESM de Phaser 3 expone *named exports* (Game, Scene, Scale...) y no
 * tiene `export default`, así que lo importamos con `import * as` y lo
 * re-exportamos como default. De esa forma el resto del código escribe siempre
 * `import Phaser from '../lib/phaser.js'` y no hay ninguna variable global
 * implícita.
 *
 * Para cambiar de versión (o servir Phaser desde node_modules en lugar del CDN)
 * solo hay que editar la URL de esta línea.
 *
 * Nota: existe Phaser 4.x, pero la especificación del proyecto está escrita
 * sobre la API de Phaser 3, así que quedamos en la última estable de la rama 3.
 */
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js';

export default Phaser;
