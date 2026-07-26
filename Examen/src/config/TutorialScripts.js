/**
 * Paneles de tutorial que se muestran tras el diálogo y antes de cada nivel.
 *
 * Cada panel lleva un título, líneas explicativas y las teclas implicadas. Es el
 * único sitio donde el jugador aprende controles que no son obvios (el dash con
 * SHIFT, el doble tap de E para gastar dos vendajes...).
 */
const COMMON_MOVEMENT = {
  title: 'CONTROLES BÁSICOS',
  lines: [
    'Muévete con A y D.',
    'Salta con ESPACIO.',
    'Dispara con J: 7 balas por cargador y recarga automática.',
    'Apunta hacia arriba con W (o hacia abajo con S en el aire).',
  ],
  keys: ['A', 'D', 'ESPACIO', 'J', 'W', 'S'],
};

export const TUTORIAL_SCRIPTS = {
  1: [
    COMMON_MOVEMENT,
    {
      title: 'PLATAFORMAS Y SUELO FALSO',
      lines: [
        'Las plataformas de piedra se mueven solas: súbete y espera.',
        'Algunas losas tienen grietas. Si te quedas encima, ceden en un segundo',
        'y caes al pozo de pinchos. Si te apartas a tiempo, se recomponen.',
      ],
      keys: [],
    },
    {
      title: 'LEGIONARIOS',
      lines: [
        'Patrullan hasta que te ven; entonces cargan con la lanza.',
        'Caen a los 3 disparos.',
        'Recoge los 3 fragmentos de gema para completar el nivel.',
      ],
      keys: ['J'],
    },
  ],

  2: [
    {
      title: 'ESCUDO TÉRMICO',
      lines: [
        'La barra naranja del HUD es tu escudo: 15 segundos.',
        'Recoge los talismanes solares para reiniciarla.',
        'Si llega a cero tienes 2 segundos de gracia. Solo tienes UNA vida.',
        'La flecha del borde de pantalla apunta al talismán fuera de cámara.',
      ],
      keys: [],
    },
    {
      title: 'DOBLE SALTO',
      lines: [
        'Pulsa ESPACIO otra vez en el aire para dar un segundo salto.',
        'Tras usarlo tarda 5 segundos en recargarse (indicador del HUD).',
      ],
      keys: ['ESPACIO', 'ESPACIO'],
    },
    {
      title: 'AGUANTA UN MINUTO',
      lines: [
        'Las momias vienen en oleadas y reviven 3 segundos después de caer.',
        'Las rocas rodantes bajan de las colinas: un golpe y fin de nivel.',
        'La arena oscura te frena; si te paras en ella, te atrapa:',
        'pulsa ESPACIO repetidamente para salir.',
      ],
      keys: ['ESPACIO'],
    },
  ],

  3: [
    {
      title: 'DASH',
      lines: [
        'Pulsa SHIFT para impulsarte en horizontal.',
        'Eres invulnerable mientras dura el impulso.',
        'Recarga: 5 segundos.',
      ],
      keys: ['SHIFT'],
    },
    {
      title: 'SANGRADO Y VENDAJES',
      lines: [
        'Los shuriken no quitan vida: provocan sangrado durante 5 segundos.',
        'Pulsa E para vendarte y detenerlo (gasta 1 vendaje).',
        'Si no te vendas a tiempo, pierdes 1 vida.',
        'Sin sangrado, doble tap de E gasta 2 vendajes y recupera 1 vida (máx. 5).',
      ],
      keys: ['E', 'E'],
    },
    {
      title: 'TRAMPOLINES',
      lines: [
        'Cae sobre los tambores para saltar mucho más alto de lo normal.',
        'Es la única forma de llegar a la cima de la torre.',
      ],
      keys: [],
    },
  ],

  4: [
    {
      title: 'LLAVES Y PORTÓN',
      lines: [
        'Reúne las 3 llaves repartidas por la fortaleza.',
        'Con las 3, el portón del fondo se abre.',
        'Detrás está el artefacto final.',
      ],
      keys: [],
    },
    {
      title: 'PALANCA A/B',
      lines: [
        'Pulsa E junto a la palanca para intercambiar los dos grupos',
        'de plataformas: las sólidas se vuelven fantasma y al contrario.',
        'Puedes accionarla tantas veces como necesites.',
      ],
      keys: ['E'],
    },
    {
      title: 'PELIGROS',
      lines: [
        'El foso de ácido del fondo te cuesta 1 vida.',
        'Las hachas péndulo también: cronometra su oscilación.',
        'Las plataformas con runas te lanzan hacia arriba cada 3 segundos;',
        'brillan justo antes de disparar.',
      ],
      keys: [],
    },
  ],
};

/** Devuelve los paneles de tutorial de un nivel (array vacío si no hay). */
export function getTutorial(levelId) {
  return TUTORIAL_SCRIPTS[levelId] ?? [];
}
