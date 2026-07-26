import { getLevel } from '../config/LevelConfig.js';

/**
 * Encadena las escenas del flujo de un nivel:
 *
 *   LevelSelect → Dialogue → Tutorial → (banner GAME START) → LevelXScene
 *
 * Cada eslabón se salta solo si su escena todavía no está registrada, de forma
 * que el flujo funciona igual con el proyecto a medio construir. Centralizarlo
 * aquí evita repetir estas comprobaciones en cada escena.
 */

/** ¿Está registrada esta escena en el juego? */
export function sceneExists(scene, key) {
  return Boolean(scene.scene.manager?.keys?.[key]);
}

/** Entra al flujo de un nivel por el primer eslabón disponible. */
export function startLevelFlow(scene, levelId) {
  if (sceneExists(scene, 'DialogueScene')) {
    scene.scene.start('DialogueScene', { levelId });
    return;
  }
  goToTutorial(scene, levelId);
}

/** Del diálogo al tutorial (o directo al nivel si no hay tutorial). */
export function goToTutorial(scene, levelId) {
  if (sceneExists(scene, 'TutorialScene')) {
    scene.scene.start('TutorialScene', { levelId });
    return;
  }
  goToLevel(scene, levelId);
}

/**
 * Arranca el nivel. Si su escena aún no existe, vuelve al selector con un aviso
 * en lugar de fallar.
 */
export function goToLevel(scene, levelId) {
  const level = getLevel(levelId);

  if (level && sceneExists(scene, level.sceneKey)) {
    scene.scene.start(level.sceneKey, { levelId });
    return;
  }

  scene.scene.start('LevelSelectScene', {
    notice:
      `${level?.name ?? 'Ese nivel'} todavía no está implementado.\n` +
      'Llega en los pasos 3 a 6 del plan de entrega.',
  });
}

/** Vuelve al selector de niveles (fin de nivel, game over o salir de la pausa). */
export function returnToLevelSelect(scene) {
  scene.scene.start('LevelSelectScene');
}
