/**
 * Constantes globales y superficie de balance del juego.
 *
 * Toda cifra que un diseñador podría querer retocar (velocidades, alturas de
 * salto, cooldowns, temporizadores) vive aquí y NO dentro de las escenas. Si hay
 * que ajustar dificultad, se toca este archivo y nada más.
 */

// ---------------------------------------------------------------------------
// Pantalla y mundo
// ---------------------------------------------------------------------------

/** Resolución interna del juego. Se escala a la ventana con Phaser.Scale.FIT. */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/**
 * Rejilla base del diseño de niveles. Las texturas de suelo/plataforma del
 * documento de assets son de 64x64 px, así que todo el level design (alturas de
 * salto incluidas) se piensa en múltiplos de este valor.
 */
export const TILE = 64;

/** Gravedad global en px/s². */
export const GRAVITY_Y = 800;

/**
 * Traduce "quiero que el salto alcance N tiles de altura" a la velocidad
 * vertical necesaria.
 *
 * La altura máxima de un tiro vertical es h = v² / (2·g), de donde v = √(2·g·h).
 * Expresar los impulsos así (en vez de hardcodear -450, -700...) garantiza que
 * el salto siga siendo coherente con la rejilla de 64 px aunque cambie la
 * gravedad, y hace evidente cuántos bloques puede escalar el jugador.
 */
export function jumpVelocityForTiles(tiles) {
  return -Math.round(Math.sqrt(2 * GRAVITY_Y * tiles * TILE));
}

// ---------------------------------------------------------------------------
// Jugador (Drago)
// ---------------------------------------------------------------------------

export const PLAYER = {
  /** Velocidad horizontal en px/s. */
  speed: 200,

  /**
   * Salto de 3 tiles (192 px) ≈ -555 px/s con g=800. Es la altura mínima que
   * hace cómodo un plataformeo sobre bloques de 64 px: sube un escalón de 2
   * tiles con margen y no llega a 4, lo que deja al diseño de nivel un rango
   * claro de alturas "alcanzables" vs. "necesitas plataforma/habilidad".
   */
  jumpVelocity: jumpVelocityForTiles(3),

  /**
   * Los spritesheets son de 128x128 px. Sin escalar, Drago mediría 2 tiles de
   * alto y ocuparía el 24 % del alto de pantalla: demasiado. A 0.75 queda en
   * 96 px ≈ 1.5 tiles, la proporción clásica de plataformas.
   */
  scale: 0.75,

  /**
   * Caja de colisión en píxeles de textura: Arcade la multiplica por la escala
   * del sprite, así que 44x100 a escala 0.75 son 33x75 px de mundo.
   *
   * La altura está calibrada sobre los sprites definitivos, midiendo el alpha de
   * `drago_idle`/`drago_walk`: su contenido acaba en y=123, así que el cuerpo
   * termina en 24 + 100 = 124 y las botas quedan plantadas en el suelo. Antes
   * llegaba hasta el borde del frame (128) y el personaje flotaba unos píxeles.
   */
  bodyWidth: 44,
  bodyHeight: 100,
  bodyOffsetX: 42,
  bodyOffsetY: 24,

  // --- Disparo ---
  /** Cadencia máxima: una bala cada 200 ms. */
  fireRateMs: 200,
  /** Balas por cargador. */
  magazineSize: 7,
  /** Duración de la recarga (automática, munición infinita). */
  reloadMs: 1200,
  /** Velocidad de la bala en px/s. */
  bulletSpeed: 700,

  // --- Daño ---
  /** Invulnerabilidad tras recibir daño, con parpadeo. Ver nota del nivel 2. */
  invulnerabilityMs: 800,
};

// ---------------------------------------------------------------------------
// Habilidades especiales
// ---------------------------------------------------------------------------

export const ABILITIES = {
  doubleJump: {
    /** Mismo impulso que el salto normal: encadenados dan ~6 tiles. */
    velocity: jumpVelocityForTiles(3),
    cooldownMs: 5000,
  },
  dash: {
    speed: 600,
    durationMs: 200,
    cooldownMs: 5000,
    /** El dash concede invencibilidad mientras dura. */
    grantsInvulnerability: true,
  },
};

// ---------------------------------------------------------------------------
// Enemigos
// ---------------------------------------------------------------------------

export const ENEMY = {
  /** Todos los enemigos mueren a los 3 impactos de bala. */
  maxHp: 3,
  /** Los enemigos son inmunes a las trampas del escenario. */
  ignoresTraps: true,
  /** Barra de vida flotante sobre el enemigo (se dibuja con Graphics). */
  healthBar: {
    width: 48,
    height: 6,
    offsetY: -12,
  },

  roman: {
    patrolSpeed: 90,
    chaseSpeed: 250,
    detectionRange: 150,
    attackRange: 40,
    attackCooldownMs: 900,
  },
  mummy: {
    patrolSpeed: 150,
    chaseSpeed: 150,
    detectionRange: 260,
    attackRange: 42,
    attackCooldownMs: 1000,
    /** Al morir queda "caída" 3 s y revive con HP completo. */
    downedMs: 3000,
  },
  ninja: {
    patrolSpeed: 120,
    chaseSpeed: 200,
    detectionRange: 340,
    /** Por debajo de esta distancia cambia a wakizashi (cuerpo a cuerpo). */
    meleeRange: 60,
    throwCooldownMs: 1800,
    shurikenSpeed: 320,
  },
  executioner: {
    patrolSpeed: 70,
    chargeSpeed: 300,
    detectionRange: 220,
    /** Aviso previo (telegraph) antes de embestir. */
    telegraphMs: 500,
    /** Aturdimiento si choca contra una pared. */
    stunMs: 1000,
  },
};

// ---------------------------------------------------------------------------
// Parámetros específicos por nivel
// ---------------------------------------------------------------------------

export const LEVEL1 = {
  /** El suelo falso cede 1 s después de pisarlo; si te vas antes, se regenera. */
  fakeFloorDelayMs: 1000,
  movingPlatform: {
    horizontal: { distance: 200, durationMs: 3000 },
    vertical: { distance: 150, durationMs: 2500 },
  },
};

export const LEVEL2 = {
  /** Fase 1: aguantar 60 s antes de que se libere el artefacto. */
  survivalMs: 60000,
  /** Escudo térmico: se agota en 15 s. */
  heatShieldMs: 15000,
  /** Margen de gracia tras agotarse el escudo (parpadeo urgente en HUD). */
  heatGraceMs: 2000,
  /** Oleadas de momias. */
  waveIntervalMs: [8000, 10000],
  maxActiveMummies: 4,
  /** Rocas rodantes desde las colinas. */
  boulderIntervalMs: [3000, 5000],
  boulderSpeed: 260,
  /** Arena movediza: reduce la velocidad a la mitad. */
  quicksandSpeedFactor: 0.5,
  /** Si te quedas quieto en la arena este tiempo, quedas atrapado. */
  quicksandStuckMs: 2000,
  /** Pulsaciones de salto necesarias (y ventana) para liberarse. */
  quicksandEscapeTaps: 10,
  quicksandEscapeWindowMs: 3000,
};

export const LEVEL3 = {
  /** Sangrado: si no te curas en 5 s, pierdes 1 vida. */
  bleedDurationMs: 5000,
  /** Vendajes iniciales y extras repartidos por el mapa. */
  startingBandages: 2,
  extraBandagesInMap: 3,
  /** Curarse cuesta 1 vendaje; recuperar una vida cuesta 2. */
  bandagesPerHeal: 1,
  bandagesPerExtraLife: 2,
  /** Tope de vidas: no se puede pasar de aquí con vendajes. */
  maxLives: 5,
  /** Ventana para el doble tap de E (recuperar vida). */
  doubleTapWindowMs: 300,
  /** Trampas de pared. */
  trapFireIntervalMs: [2000, 3000],
  trapShurikenSpeed: 300,
  /** Cadencia del wakizashi del ninja (cuerpo a cuerpo). */
  wakizashiCooldownMs: 1100,
  /** Trampolín: 7 tiles de altura (448 px). */
  trampolineVelocity: jumpVelocityForTiles(7),
};

export const LEVEL4 = {
  /** Plataformas de impulso de aire: disparan cada 3 s. */
  airPlatformIntervalMs: 3000,
  /**
   * 6 tiles de altura (384 px). La especificación proponía -800 (que con esta
   * gravedad son 400 px); 6 tiles queda equivalente y encaja dentro del mapa,
   * que solo tiene 768 px de alto.
   */
  airPlatformVelocity: jumpVelocityForTiles(6),
  /** Aviso visual antes del impulso. */
  airPlatformTelegraphMs: 600,
  /** Hachas péndulo: oscilan entre -45° y 45°. */
  pendulum: { angle: 45, durationMs: 1500 },
  /** Llaves necesarias para abrir el portón. */
  keysRequired: 3,
  /** Invulnerabilidad tras reaparecer del ácido (evita perder varias vidas). */
  respawnInvulnerabilityMs: 1000,
  /**
   * Embestida del verdugo. El tope de duración garantiza que siempre haya una
   * ventana de aturdimiento aunque no choque contra ninguna pared.
   */
  chargeMaxMs: 1400,
};

// ---------------------------------------------------------------------------
// Presentación / flujo
// ---------------------------------------------------------------------------

export const UI = {
  /** Duración de los banners GAME START / LEVEL COMPLETE / GAME OVER. */
  bannerMs: 1500,
  /** Espera antes de volver al selector tras terminar un nivel. */
  outroDelayMs: 2000,

  fonts: {
    /** Fuente monoespaciada disponible en cualquier sistema (estética retro). */
    family: '"Courier New", Courier, monospace',
  },

  colors: {
    background: '#12121a',
    panel: 0x1b1b28,
    panelBorder: 0x3a3a55,
    text: '#e8e8f0',
    textDim: '#8d8da8',
    accent: '#ffc857',
    danger: '#e5484d',
    success: '#46d160',
    info: '#4fc3f7',
  },
};

// ---------------------------------------------------------------------------
// Opciones de desarrollo (vía querystring)
// ---------------------------------------------------------------------------

const params = new URLSearchParams(window.location.search);

/**
 * El debug de Arcade Physics (cajas de colisión) se activa con `?debug=1` en la
 * URL, nunca por defecto: así no se puede quedar encendido por accidente en la
 * entrega.
 */
export const DEBUG_PHYSICS = params.get('debug') === '1';

/**
 * Atajos para no tener que navegar los menús en cada recarga mientras se
 * desarrolla:
 *
 *   ?scene=LevelSelectScene   arranca directamente en esa escena
 *   ?level=3                  id de nivel que se le pasa a la escena
 *
 * Si la escena indicada no está registrada, se ignora y se va al menú.
 */
export const DEV = {
  startScene: params.get('scene'),
  levelId: params.get('level') ? Number(params.get('level')) : null,
  /** `?skipIntro=1` entra al nivel sin el banner GAME START. */
  skipIntro: params.get('skipIntro') === '1',
  /**
   * `?zoom=0.25` aleja la cámara del nivel. Sirve para revisar de un vistazo el
   * trazado completo de un mapa de 4000 px mientras se diseña.
   */
  zoom: params.get('zoom') ? Number(params.get('zoom')) : null,
};
