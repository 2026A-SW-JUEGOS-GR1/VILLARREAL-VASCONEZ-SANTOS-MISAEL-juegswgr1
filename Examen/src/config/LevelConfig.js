/**
 * Metadatos de los 4 niveles: lo que necesitan el selector de niveles, los
 * tutoriales y los propios niveles para configurarse.
 *
 * Las cifras de balance (velocidades, cooldowns, temporizadores) NO viven aquí
 * sino en GameConfig.js; esto es la "ficha" descriptiva de cada nivel.
 */

export const LEVELS = [
  {
    id: 1,
    sceneKey: 'Level1Scene',
    name: 'Antigua Roma',
    subtitle: 'El Coliseo fracturado',
    /** Vidas iniciales (spec: 3, 1, 5, 3). */
    lives: 3,
    objective: 'Recupera los 3 fragmentos de la gema de protección.',
    enemyName: 'Soldado Romano',
    /** Habilidad especial que Nadia otorga en este nivel (null = ninguna). */
    ability: null,
    mechanics: ['Plataformas móviles', 'Suelo falso', 'Pozos de pinchos'],
    /** Widgets que monta el HUD en este nivel (ver HUDScene). */
    hud: ['ammo', 'lives', 'objective'],
    /** Mapa lineal de 3 secciones: 63 tiles de 64 px. */
    widthPx: 4032,
    accent: 0xc0392b,
    backgrounds: ['level1_far', 'level1_mid', 'level1_near'],
    floorTexture: 'floor_rome',
    /** Pista de fondo del nivel. */
    music: 'music_level1',
  },
  {
    id: 2,
    sceneKey: 'Level2Scene',
    name: 'Antiguo Egipto',
    subtitle: 'El sello del sol',
    /**
     * Una sola vida: cualquier impacto manda directamente a GAME OVER y de
     * vuelta al selector. Por eso este nivel NO usa invulnerabilidad temporal.
     */
    lives: 1,
    objective: 'Aguanta 60 s y recoge el artefacto del escudo.',
    enemyName: 'Momia',
    ability: 'Doble salto',
    mechanics: ['Escudo térmico', 'Doble salto', 'Rocas rodantes', 'Arena movediza'],
    hud: ['ammo', 'timer', 'shield', 'doubleJump', 'compass'],
    /** Arena abierta: 56 tiles de 64 px. */
    widthPx: 3584,
    accent: 0xe0a030,
    backgrounds: ['level2_far', 'level2_mid', 'level2_near'],
    floorTexture: 'floor_egypt',
    /** Pista de fondo del nivel. */
    music: 'music_level2',
  },
  {
    id: 3,
    sceneKey: 'Level3Scene',
    name: 'Japón Feudal',
    subtitle: 'La torre del shōgun',
    lives: 5,
    objective: 'Alcanza la cima y recoge el tesoro sellado.',
    enemyName: 'Ninja',
    ability: 'Dash',
    mechanics: ['Dash', 'Trampolines', 'Sangrado y vendajes'],
    hud: ['ammo', 'lives', 'dash', 'bleeding', 'bandages'],
    widthPx: 3200,
    accent: 0xc2185b,
    backgrounds: ['level3_far', 'level3_mid', 'level3_near'],
    floorTexture: 'floor_japan',
    /** Pista de fondo del nivel. */
    music: 'music_level3',
  },
  {
    id: 4,
    sceneKey: 'Level4Scene',
    name: 'Fortaleza Medieval',
    subtitle: 'La línea rota',
    lives: 3,
    objective: 'Reúne 3 llaves, abre el portón y toma el artefacto.',
    enemyName: 'Verdugo',
    ability: null,
    mechanics: ['Pozos de ácido', 'Hachas péndulo', 'Palanca A/B', 'Impulsos de aire'],
    hud: ['ammo', 'lives', 'objective'],
    /** Fortaleza sobre el foso: 63 tiles de 64 px. */
    widthPx: 4032,
    accent: 0x3f8ecc,
    backgrounds: ['level4_far', 'level4_mid', 'level4_near'],
    floorTexture: 'floor_medieval',
    /** Pista de fondo del nivel. */
    music: 'music_level4',
  },
];

/** Devuelve la ficha de un nivel por su id (1-4), o undefined. */
export function getLevel(id) {
  return LEVELS.find((level) => level.id === id);
}
