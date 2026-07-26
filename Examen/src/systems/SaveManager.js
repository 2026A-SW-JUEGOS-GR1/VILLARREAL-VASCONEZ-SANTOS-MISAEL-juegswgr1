/**
 * Persistencia de progreso en localStorage.
 *
 * De momento solo guarda qué niveles se han superado, para que el selector los
 * muestre marcados al recargar la página.
 *
 * Todo acceso va envuelto en try/catch: localStorage puede lanzar excepción en
 * modo incógnito, con cookies bloqueadas o al abrir el juego desde file://, y
 * en ese caso el juego debe seguir funcionando (simplemente sin guardar nada).
 */

/**
 * Nota: el MD de implementación proponía la clave 'lineaRota_progress', pero el
 * juego se llama Killing Time, así que usamos un nombre coherente con el título.
 */
const STORAGE_KEY = 'killingTime_progress';
/** Ajustes de audio, aparte del progreso para poder borrar uno sin el otro. */
const SETTINGS_KEY = 'killingTime_settings';

/** Ajustes por defecto. */
function defaultSettings() {
  return { volume: 1, muted: false };
}

/** Estructura por defecto cuando no hay nada guardado. */
function emptyProgress() {
  return { version: 1, completed: {} };
}

export default class SaveManager {
  /** Lee el progreso guardado. Nunca lanza: ante cualquier fallo devuelve vacío. */
  static load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyProgress();

      const parsed = JSON.parse(raw);
      // Validación mínima: si el formato no es el esperado, empezamos de cero.
      if (!parsed || typeof parsed !== 'object' || typeof parsed.completed !== 'object') {
        return emptyProgress();
      }
      return { ...emptyProgress(), ...parsed };
    } catch (error) {
      console.warn('[SaveManager] No se pudo leer el progreso:', error);
      return emptyProgress();
    }
  }

  /** Escribe el progreso. Devuelve true si se pudo guardar. */
  static save(progress) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      return true;
    } catch (error) {
      console.warn('[SaveManager] No se pudo guardar el progreso:', error);
      return false;
    }
  }

  /** ¿Está superado este nivel? */
  static isCompleted(levelId) {
    return SaveManager.load().completed[levelId] === true;
  }

  /** Marca un nivel como superado. */
  static markCompleted(levelId) {
    const progress = SaveManager.load();
    progress.completed[levelId] = true;
    return SaveManager.save(progress);
  }

  /** Cuántos niveles se han superado. */
  static completedCount() {
    return Object.values(SaveManager.load().completed).filter(Boolean).length;
  }

  // -------------------------------------------------------------------------
  // Ajustes de audio
  // -------------------------------------------------------------------------

  /** Lee los ajustes de audio. Nunca lanza: ante cualquier fallo, los de fábrica. */
  static loadSettings() {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings();

      const parsed = JSON.parse(raw);
      return {
        volume: typeof parsed?.volume === 'number' ? parsed.volume : 1,
        muted: parsed?.muted === true,
      };
    } catch (error) {
      console.warn('[SaveManager] No se pudieron leer los ajustes:', error);
      return defaultSettings();
    }
  }

  static saveSettings(settings) {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.warn('[SaveManager] No se pudieron guardar los ajustes:', error);
      return false;
    }
  }

  /** Borra todo el progreso (opción de menú, útil también para pruebas). */
  static reset() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.warn('[SaveManager] No se pudo borrar el progreso:', error);
      return false;
    }
  }
}
