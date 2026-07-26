import { getAudio } from '../config/AssetManifest.js';
import SaveManager from './SaveManager.js';

/**
 * Gestor de música y efectos de sonido.
 *
 * Es un módulo con estado, no una clase por escena, porque el SoundManager de
 * Phaser es único para todo el juego: la música tiene que sobrevivir a los
 * cambios de escena para no cortarse en cada transición.
 *
 * Cuatro decisiones que explican casi todo el archivo:
 *
 *  1. **Una pista que no exista no es un error.** Si el archivo no está en la
 *     caché (todavía no se ha entregado, o falló la carga), se ignora la llamada
 *     en silencio. Es el mismo criterio que con los placeholders gráficos: el
 *     juego funciona incompleto y suena en cuanto aparezca el archivo.
 *
 *  2. **La música no se para al cambiar de escena, se sustituye.** Cada escena
 *     pide su pista en `create()`; si es la misma que ya suena, no se reinicia.
 *     Así no hay silencios entre menú → diálogo → tutorial → nivel.
 *
 *  3. **Los navegadores bloquean el audio hasta que el usuario interactúa.** Si
 *     el SoundManager está bloqueado, la pista queda pendiente y arranca sola en
 *     cuanto se desbloquea. Sin esto, la música del menú no sonaría nunca hasta
 *     que el jugador pulsase algo, y parecería que el audio está roto.
 *
 *  4. **Los fundidos NO usan tweens de Phaser.** Los tweens pertenecen a una
 *     escena y se destruyen con ella, así que un fundido lanzado justo antes de
 *     un cambio de escena nunca llegaba a su `onComplete` y la pista se quedaba
 *     sonando para siempre. Al acumularse una por transición, todo se solapaba y
 *     no se entendía nada. Aquí los fundidos van sobre `requestAnimationFrame`,
 *     que es del navegador y sobrevive a cualquier cambio de escena.
 */

/** Pista de música que suena ahora mismo (o que quedó pendiente de desbloqueo). */
let currentMusicKey = null;
let currentMusic = null;
/** Pista solicitada mientras el audio estaba bloqueado por el navegador. */
let pendingMusicKey = null;
/** Jingle de evento en curso. Solo puede haber uno. */
let currentJingle = null;
/** Evita apilar varios manejadores del evento 'unlocked'. */
let waitingForUnlock = false;

/** Multiplicador global y silencio, persistidos entre sesiones. */
let masterVolume = 1;
let muted = false;

/** Duración del fundido al sustituir una pista. */
const FADE_MS = 400;

/** Fundidos en curso: sonido → id de requestAnimationFrame. */
const activeFades = new Map();

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

/** Carga los ajustes guardados. Llamar una vez, al arrancar el juego. */
export function initAudio() {
  const settings = SaveManager.loadSettings();
  masterVolume = settings.volume;
  muted = settings.muted;
}

/** ¿Está esta pista disponible en la caché de sonido? */
function isAvailable(scene, key) {
  return Boolean(key) && scene.cache.audio.exists(key);
}

// ---------------------------------------------------------------------------
// Fundidos independientes de las escenas
// ---------------------------------------------------------------------------

function cancelFade(sound) {
  const frame = activeFades.get(sound);
  if (frame !== undefined) {
    cancelAnimationFrame(frame);
    activeFades.delete(sound);
  }
}

function destroySound(sound) {
  if (!sound) return;

  cancelFade(sound);
  // Un sonido ya destruido lanza al pararlo; no es un caso a tratar, solo a ignorar.
  try {
    sound.stop();
    sound.destroy();
  } catch {
    /* ya estaba destruido */
  }
}

/**
 * Lleva el volumen de un sonido hasta `target` en `durationMs`.
 *
 * Usa requestAnimationFrame en lugar de un tween de escena a propósito: ver la
 * nota 4 de la cabecera. Es la diferencia entre que la pista se pare de verdad y
 * que se quede colgada sonando cuando la escena que pidió el fundido desaparece.
 */
function fade(sound, target, durationMs, { destroyOnEnd = false } = {}) {
  if (!sound) return;

  cancelFade(sound);

  if (!sound.isPlaying) {
    if (destroyOnEnd) destroySound(sound);
    return;
  }

  const from = sound.volume;
  const startedAt = performance.now();

  const step = () => {
    // Si dejó de sonar por su cuenta (un jingle que terminó), se cierra aquí.
    if (!sound.isPlaying) {
      activeFades.delete(sound);
      if (destroyOnEnd) destroySound(sound);
      return;
    }

    const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
    sound.setVolume(from + (target - from) * progress);

    if (progress < 1) {
      activeFades.set(sound, requestAnimationFrame(step));
      return;
    }

    activeFades.delete(sound);
    if (destroyOnEnd) destroySound(sound);
  };

  activeFades.set(sound, requestAnimationFrame(step));
}

/**
 * Red de seguridad: corta cualquier pista de música o jingle que haya quedado
 * suelta y ya no sea la actual.
 *
 * No debería hacer falta si todo lo demás funciona, pero es baratísima y evita
 * que un solo fallo se convierta en el problema que fue: pistas acumulándose una
 * sobre otra hasta que no se entiende nada.
 */
function stopStraySounds(scene) {
  scene.sound.sounds
    .filter(
      (sound) =>
        sound !== currentMusic &&
        sound !== currentJingle &&
        (sound.isPlaying || sound.isPaused) &&
        (sound.key?.startsWith('music_') || sound.key?.startsWith('jingle_')),
    )
    .forEach(destroySound);
}

// ---------------------------------------------------------------------------
// Música
// ---------------------------------------------------------------------------

/**
 * Pone una pista de fondo en bucle, sustituyendo la anterior con un fundido.
 *
 * @param {Phaser.Scene} scene
 * @param {string} key Key del manifiesto de audio.
 */
export function playMusic(scene, key) {
  if (!isAvailable(scene, key)) return;

  // Ya suena: no se reinicia (transiciones entre escenas que comparten pista).
  if (currentMusicKey === key && currentMusic?.isPlaying) return;

  // Audio bloqueado por política de autoplay: lo dejamos pendiente.
  if (scene.sound.locked) {
    pendingMusicKey = key;
    hookUnlock(scene);
    return;
  }

  fade(currentMusic, 0, FADE_MS, { destroyOnEnd: true });

  const track = getAudio(key);
  currentMusicKey = key;
  pendingMusicKey = null;
  currentMusic = scene.sound.add(key, {
    loop: track?.loop ?? true,
    volume: effectiveVolume(track?.volume ?? 0.4),
  });
  currentMusic.play();

  stopStraySounds(scene);
}

/**
 * Registra UN solo manejador del desbloqueo.
 *
 * Antes se registraba uno por llamada, así que al desbloquearse disparaban todos
 * a la vez. El guardado por `pendingMusicKey` evitaba que sonaran varias pistas,
 * pero apilar manejadores no tiene ningún sentido.
 */
function hookUnlock(scene) {
  if (waitingForUnlock) return;
  waitingForUnlock = true;

  scene.sound.once('unlocked', () => {
    waitingForUnlock = false;
    if (pendingMusicKey) playMusic(scene, pendingMusicKey);
  });
}

/** Detiene la música actual. */
export function stopMusic({ fade: withFade = true } = {}) {
  const previous = currentMusic;

  currentMusicKey = null;
  pendingMusicKey = null;
  currentMusic = null;

  if (!previous) return;

  if (withFade) fade(previous, 0, FADE_MS, { destroyOnEnd: true });
  else destroySound(previous);
}

// ---------------------------------------------------------------------------
// Jingles de evento
// ---------------------------------------------------------------------------

/**
 * Lanza un jingle de evento (GAME START / LEVEL COMPLETE / GAME OVER).
 *
 * Las pistas entregadas duran más de 30 s, así que no son golpes cortos: hay que
 * cortarlas explícitamente con `fadeOutJingle` cuando su banner termine, o se
 * quedarían sonando por encima de la música del nivel.
 *
 * @param {Phaser.Scene} scene
 * @param {string} key
 * @param {boolean} [duckMusic] Si true, baja la música de fondo mientras suena.
 * @returns {Phaser.Sound.BaseSound|null}
 */
export function playJingle(scene, key, duckMusic = false) {
  if (!isAvailable(scene, key)) return null;

  // Solo un jingle a la vez.
  if (currentJingle) destroySound(currentJingle);

  if (duckMusic && currentMusic?.isPlaying) {
    fade(currentMusic, currentMusic.volume * 0.25, 250);
  }

  const track = getAudio(key);
  currentJingle = scene.sound.add(key, { volume: effectiveVolume(track?.volume ?? 0.6) });
  currentJingle.play();

  return currentJingle;
}

/**
 * Corta el jingle en curso con un fundido corto y devuelve la música a su
 * volumen normal.
 *
 * Ya no recibe la escena: el fundido es independiente de ella, que es justo lo
 * que hacía falta porque quien llama a esto (BannerScene) se cierra a sí misma
 * en la línea siguiente.
 */
export function fadeOutJingle(sound = currentJingle, duration = 450) {
  if (sound) {
    fade(sound, 0, duration, { destroyOnEnd: true });
    if (sound === currentJingle) currentJingle = null;
  }

  // Devolvemos la música al volumen que le toca por manifiesto.
  if (currentMusic?.isPlaying) {
    const track = getAudio(currentMusicKey);
    fade(currentMusic, effectiveVolume(track?.volume ?? 0.4), duration);
  }
}

// ---------------------------------------------------------------------------
// Efectos
// ---------------------------------------------------------------------------

/**
 * Dispara un efecto de sonido puntual.
 *
 * No falla si el archivo no existe: hoy ninguno de los seis efectos está
 * entregado, así que estas llamadas están colocadas en su sitio y no hacen nada.
 * En cuanto aparezcan los .mp3 en assets/audio/ empezarán a sonar sin tocar código.
 */
export function playSfx(scene, key) {
  if (!isAvailable(scene, key)) return;

  const track = getAudio(key);
  scene.sound.play(key, { volume: effectiveVolume(track?.volume ?? 0.4) });
}

// ---------------------------------------------------------------------------
// Volumen y silencio
// ---------------------------------------------------------------------------

function effectiveVolume(base) {
  return muted ? 0 : base * masterVolume;
}

export function isMuted() {
  return muted;
}

/** Alterna el silencio y lo guarda. Devuelve el nuevo estado. */
export function toggleMute(scene) {
  muted = !muted;
  SaveManager.saveSettings({ volume: masterVolume, muted });

  // El SoundManager global tiene su propio mute, que afecta a todo de una vez.
  if (scene) scene.sound.mute = muted;
  return muted;
}

/** Aplica el estado de silencio guardado al SoundManager. */
export function applyMute(scene) {
  scene.sound.mute = muted;
}
