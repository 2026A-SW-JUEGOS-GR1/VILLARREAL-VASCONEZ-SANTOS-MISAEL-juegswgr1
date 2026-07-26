/**
 * Guiones de diálogo previos a cada nivel.
 *
 * Contexto narrativo (tomado del documento de assets): el coronel Viktor Kaelen
 * activó el dispositivo KT y fracturó las gemas de protección que sostenían
 * cuatro épocas. Drago —soldado checheno, parco y directo— salta por portales
 * temporales para recuperarlas. Nadia, analista temporal, le guía por radio y le
 * fabrica el equipo especial de cada época.
 *
 * `speaker` es 'nadia' o 'drago': la escena de diálogo coloca el retrato a un
 * lado o al otro según quién hable.
 */
export const DIALOGUE_SCRIPTS = {
  1: [
    { speaker: 'nadia', text: 'Drago, estás dentro. Roma, año 80. El Coliseo todavía está en pie… por poco.' },
    { speaker: 'nadia', text: 'La gema de protección de esta era se partió en tres fragmentos. Sin los tres, la época entera se desmorona.' },
    { speaker: 'drago', text: 'Tres piedras. Entendido.' },
    { speaker: 'nadia', text: 'Cuidado con los legionarios: llevan esquirlas de la gema incrustadas en el pecho. Kaelen los está usando como marionetas.' },
    { speaker: 'nadia', text: 'Y no te fíes del suelo. Hay losas que ceden y pozos de pinchos debajo.' },
    { speaker: 'drago', text: 'Nunca me fío del suelo.' },
  ],

  2: [
    { speaker: 'nadia', text: 'Egipto. Y hace cincuenta y dos grados a la sombra, así que escúchame bien.' },
    { speaker: 'nadia', text: 'Te he enviado dos cosas: un escudo térmico y unas botas con impulso temporal. El escudo aguanta quince segundos.' },
    { speaker: 'drago', text: 'Quince segundos. ¿Y después?' },
    { speaker: 'nadia', text: 'Después te achicharras. Hay talismanes solares repartidos por el mapa que lo recargan: cógelos antes de que se agote.' },
    { speaker: 'nadia', text: 'El artefacto que sella la ciudad está bloqueado un minuto. Aguanta ese minuto, Drago. Las momias no se quedan muertas.' },
    { speaker: 'drago', text: 'Nada se queda muerto últimamente.' },
  ],

  3: [
    { speaker: 'nadia', text: 'Japón feudal. El tesoro del shōgun está en lo alto de la torre, y la torre está llena de trampas.' },
    { speaker: 'nadia', text: 'Te he montado un impulso corto en el traje. Sirve para cruzar huecos y para salir de una trayectoria de shuriken.' },
    { speaker: 'drago', text: 'Los shuriken no matan.' },
    { speaker: 'nadia', text: 'Estos van con filo envenenado. No te quitan vida de golpe: te desangras. Tienes cinco segundos para vendarte antes de perder una.' },
    { speaker: 'nadia', text: 'Llevas dos vendajes. Hay tres más por el nivel. Y si te sobran, dos vendajes valen una vida.' },
    { speaker: 'drago', text: 'Entonces no gastaré ninguno.' },
  ],

  4: [
    { speaker: 'nadia', text: 'Última parada. Esta fortaleza no está en ningún registro histórico, Drago. Kaelen la construyó.' },
    { speaker: 'nadia', text: 'El portón del fondo tiene tres cerraduras. Las llaves están dentro, y el foso es de ácido.' },
    { speaker: 'drago', text: 'Ácido, hachas y un verdugo. Kaelen tiene sentido del humor.' },
    { speaker: 'nadia', text: 'Hay una palanca que intercambia dos grupos de plataformas. Sin ella no llegas a la tercera llave.' },
    { speaker: 'nadia', text: 'Detrás del portón está el artefacto que cierra la línea. Tráelo y esto se acaba.' },
    { speaker: 'drago', text: 'Voy a por él.' },
  ],
};

/** Devuelve el guion de un nivel (array vacío si no hay). */
export function getDialogue(levelId) {
  return DIALOGUE_SCRIPTS[levelId] ?? [];
}
