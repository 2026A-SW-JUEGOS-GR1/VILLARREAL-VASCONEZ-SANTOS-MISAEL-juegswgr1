/**
 * Manifiesto único de assets gráficos.
 *
 * Las keys, rutas, dimensiones y número de frames replican EXACTAMENTE lo
 * definido en `prompts-assets-graficos.md` (el documento con el que se están
 * generando las imágenes). No inventar keys aquí: si cambia ese documento,
 * cambia este archivo y nada más.
 *
 * Mientras un PNG no exista todavía, PreloadScene detecta el fallo de carga y
 * genera un placeholder procedural con la misma key, las mismas dimensiones y
 * el mismo número de frames (ver systems/PlaceholderFactory.js). Eso permite
 * jugar el juego completo antes de tener arte, y sustituir placeholder por
 * asset final es solo copiar el archivo a su carpeta: cero cambios de código.
 */

/** Descriptor de imagen estática. */
const image = (key, category, file, width, height) => ({
  key,
  type: 'image',
  category,
  path: `assets/${category}/${file}`,
  width,
  height,
});

/** Descriptor de spritesheet horizontal de N frames. */
const sheet = (key, category, file, frameWidth, frameHeight, frames) => ({
  key,
  type: 'spritesheet',
  category,
  path: `assets/${category}/${file}`,
  frameWidth,
  frameHeight,
  frames,
});

// ---------------------------------------------------------------------------
// Marca: logo y fondos de menú
// ---------------------------------------------------------------------------
const branding = [
  // El logo entregado es 1024x683, no 1024x512 como pedía el documento de arte.
  // Da igual porque se escala manteniendo su proporción, pero se declara real.
  image('logo', 'branding', 'logo.png', 1024, 683),
  image('menu_background', 'branding', 'menu_background.png', 1920, 1080),
  image('level_select_background', 'branding', 'level_select_background.png', 1920, 1080),
];

// ---------------------------------------------------------------------------
// Personajes (spritesheets de 6 frames a 128x128; retratos estáticos 512x512)
// ---------------------------------------------------------------------------
const characters = [
  sheet('drago_idle', 'characters', 'drago_idle.png', 128, 128, 6),
  sheet('drago_walk', 'characters', 'drago_walk.png', 128, 128, 6),
  sheet('drago_shoot', 'characters', 'drago_shoot.png', 128, 128, 6),
  sheet('nadia_idle', 'characters', 'nadia_idle.png', 128, 128, 6),
  // Retrato de Drago para los diálogos: no estaba en el documento de arte
  // original (solo Nadia y Viktor), pero se entregó y la escena de diálogo lo
  // necesitaba, así que ya no hace falta recortar su spritesheet.
  image('drago_portrait', 'characters', 'drago_portrait.png', 512, 512),
  image('nadia_portrait', 'characters', 'nadia_portrait.png', 512, 512),
  image('viktor_portrait', 'characters', 'viktor_portrait.png', 512, 512),
];

// ---------------------------------------------------------------------------
// Enemigos (idle / walk / attack por cada uno, 6 frames a 128x128)
// ---------------------------------------------------------------------------
const enemies = ['roman', 'mummy', 'ninja', 'executioner'].flatMap((name) =>
  ['idle', 'walk', 'attack'].map((state) =>
    sheet(`${name}_${state}`, 'enemies', `${name}_${state}.png`, 128, 128, 6),
  ),
);

// ---------------------------------------------------------------------------
// Artefactos y objetos (6 frames a 64x64, brillo pulsante en bucle)
// ---------------------------------------------------------------------------
const items = [
  sheet('gem_fragment', 'items', 'gem_fragment.png', 64, 64, 6),
  sheet('shield_artifact', 'items', 'shield_artifact.png', 64, 64, 6),
  // Artefacto que genera el escudo de la ciudad, el objetivo final del nivel 2.
  // Tampoco estaba en el documento de arte (que solo definía los talismanes) y
  // el nivel lo suplía reutilizando `shield_artifact` a mayor tamaño.
  sheet('city_artifact', 'items', 'city_artifact.png', 64, 64, 6),
  sheet('shogun_treasure', 'items', 'shogun_treasure.png', 64, 64, 6),
  sheet('medieval_key', 'items', 'medieval_key.png', 64, 64, 6),
  sheet('final_artifact', 'items', 'final_artifact.png', 64, 64, 6),
  // El vendaje del mapa es estático (distinto del icono de HUD).
  image('bandage_icon', 'items', 'bandage_icon.png', 64, 64),
];

// ---------------------------------------------------------------------------
// Proyectiles y efectos
// ---------------------------------------------------------------------------
const projectiles = [
  image('bullet', 'projectiles', 'bullet.png', 32, 16),
  sheet('shuriken', 'projectiles', 'shuriken.png', 32, 32, 6),
  // Ojo: el doc lo lista entre los de 6 frames, pero su prompt pide 4 (§5.3).
  sheet('muzzle_flash', 'projectiles', 'muzzle_flash.png', 64, 64, 4),
];

// ---------------------------------------------------------------------------
// Fondos de parallax: 3 capas por nivel, 1920x540 cada una
// ---------------------------------------------------------------------------
const backgrounds = [1, 2, 3, 4].flatMap((level) =>
  ['far', 'mid', 'near'].map((layer) =>
    image(`level${level}_${layer}`, 'backgrounds', `level${level}_${layer}.png`, 1920, 540),
  ),
);

// ---------------------------------------------------------------------------
// Texturas de suelo y plataforma (tileables, 64x64)
// ---------------------------------------------------------------------------
const tiles = [
  image('floor_rome', 'tiles', 'floor_rome.png', 64, 64),
  image('floor_rome_fake', 'tiles', 'floor_rome_fake.png', 64, 64),
  image('floor_egypt', 'tiles', 'floor_egypt.png', 64, 64),
  image('quicksand_egypt', 'tiles', 'quicksand_egypt.png', 64, 64),
  image('floor_japan', 'tiles', 'floor_japan.png', 64, 64),
  image('floor_medieval', 'tiles', 'floor_medieval.png', 64, 64),
];

// ---------------------------------------------------------------------------
// Trampas y objetos interactivos
// ---------------------------------------------------------------------------
const hazards = [
  image('spikes', 'hazards', 'spikes.png', 64, 64),
  image('moving_platform_rome', 'hazards', 'moving_platform_rome.png', 128, 32),
  sheet('boulder', 'hazards', 'boulder.png', 64, 64, 6),
  image('trampoline', 'hazards', 'trampoline.png', 96, 64),
  image('shuriken_trap_wall', 'hazards', 'shuriken_trap_wall.png', 96, 96),
  // Entregado a 80x160 en vez de 96x160; se dibuja con setDisplaySize, así que
  // solo cambia la declaración.
  image('pendulum_axe', 'hazards', 'pendulum_axe.png', 80, 160),
  image('lever', 'hazards', 'lever.png', 48, 64),
  image('platform_group_a', 'hazards', 'platform_group_a.png', 128, 32),
  image('platform_group_b', 'hazards', 'platform_group_b.png', 128, 32),
  sheet('air_platform', 'hazards', 'air_platform.png', 128, 64, 6),
  sheet('acid_pool', 'hazards', 'acid_pool.png', 128, 64, 6),
  image('exit_door', 'hazards', 'exit_door.png', 128, 192),
];

// ---------------------------------------------------------------------------
// HUD y banners
// ---------------------------------------------------------------------------
const ui = [
  ...[
    'icon_life',
    'icon_ammo',
    'icon_shield',
    'icon_double_jump',
    'icon_dash',
    'icon_bleeding',
    'icon_bandage',
    'icon_compass',
  ].map((key) => image(key, 'ui', `${key}.png`, 48, 48)),
  // El banner de inicio vino a 800x267 y los otros dos a 800x200. Se dibujan a
  // su tamaño natural, así que basta con declararlos como son.
  image('banner_game_start', 'ui', 'banner_game_start.png', 800, 267),
  ...['banner_level_complete', 'banner_game_over'].map((key) =>
    image(key, 'ui', `${key}.png`, 800, 200),
  ),
];

// ---------------------------------------------------------------------------
// Historieta de apertura (5 paneles)
// ---------------------------------------------------------------------------
const story = [1, 2, 3, 4, 5].map((n) =>
  image(`intro_panel_${n}`, 'story', `intro_panel_${n}.png`, 1024, 576),
);

/** Manifiesto completo, en el orden en que se precarga. */
export const ASSET_MANIFEST = [
  ...branding,
  ...characters,
  ...enemies,
  ...items,
  ...projectiles,
  ...backgrounds,
  ...tiles,
  ...hazards,
  ...ui,
  ...story,
];

/** Busca un descriptor por key (lo usa PlaceholderFactory). */
export function getAsset(key) {
  return ASSET_MANIFEST.find((asset) => asset.key === key);
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/** Descriptor de pista de audio. */
const audio = (key, file, { loop = false, volume = 0.5 } = {}) => ({
  key,
  type: 'audio',
  category: 'audio',
  path: `assets/audio/${file}`,
  loop,
  volume,
});

/**
 * Manifiesto de audio. Va aparte del gráfico porque se carga con
 * `load.audio()` y porque no tiene equivalente a los placeholders: una pista que
 * falte simplemente no suena (AudioManager la ignora sin fallar).
 *
 * Las pistas entregadas duran ~31 s cada una y están pensadas como bucles. Los
 * "jingles" también duran 31 s, así que no son golpes cortos: se cortan con un
 * fundido cuando termina el banner que los lanza.
 */
export const AUDIO_MANIFEST = [
  // --- Música de fondo, en bucle ---
  audio('music_loading', 'music_loading.mp3', { loop: true, volume: 0.35 }),
  audio('music_menu', 'music_menu.mp3', { loop: true, volume: 0.45 }),
  audio('music_level_select', 'music_level_select.mp3', { loop: true, volume: 0.45 }),
  audio('music_dialogue', 'music_dialogue.mp3', { loop: true, volume: 0.4 }),
  audio('music_tutorial', 'music_tutorial.mp3', { loop: true, volume: 0.4 }),
  audio('music_intro_comic', 'music_intro_comic.mp3', { loop: true, volume: 0.4 }),
  audio('music_level1', 'music_level1.mp3', { loop: true, volume: 0.4 }),
  audio('music_level2', 'music_level2.mp3', { loop: true, volume: 0.4 }),
  audio('music_level3', 'music_level3.mp3', { loop: true, volume: 0.4 }),
  audio('music_level4', 'music_level4.mp3', { loop: true, volume: 0.4 }),

  // --- Jingles de evento, una sola vez ---
  audio('jingle_game_start', 'jingle_game_start.mp3', { volume: 0.6 }),
  audio('jingle_level_complete', 'jingle_level_complete.mp3', { volume: 0.6 }),
  audio('jingle_game_over', 'jingle_game_over.mp3', { volume: 0.6 }),

  /*
   * --- Efectos de sonido ---
   *
   * Declarados porque el código ya los pide en su sitio, pero los archivos
   * todavía NO existen: AudioManager los ignora en silencio. Basta con dejar el
   * .mp3 correspondiente en assets/audio/ para que empiecen a sonar, igual que
   * con los placeholders gráficos.
   *
   * TODO: reemplazar con los archivos de audio finales.
   */
  audio('sfx_shoot', 'sfx_shoot.mp3', { volume: 0.35 }),
  audio('sfx_reload', 'sfx_reload.mp3', { volume: 0.4 }),
  audio('sfx_jump', 'sfx_jump.mp3', { volume: 0.3 }),
  audio('sfx_hurt', 'sfx_hurt.mp3', { volume: 0.5 }),
  audio('sfx_collect', 'sfx_collect.mp3', { volume: 0.5 }),
  audio('sfx_enemy_death', 'sfx_enemy_death.mp3', { volume: 0.45 }),
];

/** Busca un descriptor de audio por key. */
export function getAudio(key) {
  return AUDIO_MANIFEST.find((track) => track.key === key);
}
