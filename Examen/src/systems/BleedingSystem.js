/**
 * Sangrado y vendajes (nivel 3).
 *
 * Los shuriken no quitan vida al impactar: provocan un sangrado que mata en 5
 * segundos si no te vendas. Alrededor de eso la especificación define seis
 * reglas que se pisan entre sí, así que viven todas aquí, juntas y comentadas,
 * en lugar de repartidas por la escena:
 *
 *  R1. Shuriken sin sangrar        → empieza a sangrar. No cuesta vida.
 *  R2. Shuriken YA sangrando       → cuesta 1 vida y el sangrado continúa
 *                                    (reiniciando los 5 s)... salvo que al
 *                                    perderla te quedes con exactamente 1 vida,
 *                                    en cuyo caso el sangrado se corta.
 *  R3. Se agotan los 5 s           → cuesta 1 vida y el sangrado se corta.
 *  R4. Cuerpo a cuerpo sangrando   → te deja en 1 vida, vengas de las que
 *                                    vengas, y corta el sangrado.
 *  R5. Cuerpo a cuerpo sin sangrar → cuesta 1 vida.
 *  R6. E sangrando, con vendajes   → gasta 1 vendaje y corta el sangrado.
 *  R7. Doble E sin sangrar         → gasta 2 vendajes y recupera 1 vida
 *                                    (bloqueado si ya estás al máximo).
 *
 * El sistema NO toca las vidas: no conoce al jugador. Devuelve qué hay que
 * aplicar y la escena lo aplica sobre el HealthSystem. Así las reglas se pueden
 * leer y comprobar sin arrastrar media escena detrás.
 */
export default class BleedingSystem {
  constructor({
    durationMs,
    startingBandages,
    bandagesPerHeal,
    bandagesPerExtraLife,
    maxLives,
    doubleTapWindowMs,
  }) {
    this.durationMs = durationMs;
    this.bandagesPerHeal = bandagesPerHeal;
    this.bandagesPerExtraLife = bandagesPerExtraLife;
    this.maxLives = maxLives;
    this.doubleTapWindowMs = doubleTapWindowMs;

    this.startingBandages = startingBandages;
    this.bandages = startingBandages;

    this.isBleeding = false;
    this.remainingMs = 0;
    this.lastInteractAt = -Infinity;
  }

  // -------------------------------------------------------------------------
  // Ciclo
  // -------------------------------------------------------------------------

  /**
   * Avanza la cuenta atrás.
   * @returns {'expired'|null} 'expired' cuando se agotan los 5 s (R3).
   */
  update(delta) {
    if (!this.isBleeding) return null;

    this.remainingMs -= delta;

    if (this.remainingMs <= 0) {
      this.stop();
      return 'expired';
    }
    return null;
  }

  start() {
    this.isBleeding = true;
    this.remainingMs = this.durationMs;
  }

  stop() {
    this.isBleeding = false;
    this.remainingMs = 0;
  }

  // -------------------------------------------------------------------------
  // Impactos
  // -------------------------------------------------------------------------

  /**
   * Impacto de shuriken (trampa de pared o ninja).
   *
   * @param {number} currentLives Vidas ANTES del impacto.
   * @returns {{loseLife: boolean}}
   */
  onShurikenHit(currentLives) {
    // R1: primer impacto, solo empieza el sangrado.
    if (!this.isBleeding) {
      this.start();
      return { loseLife: false };
    }

    // R2: sangrando ya, cuesta una vida.
    const livesAfter = currentLives - 1;

    if (livesAfter === 1) {
      // Excepción: quedarse en 1 vida corta el sangrado.
      this.stop();
    } else {
      // Sigue sangrando, con los 5 s reiniciados.
      this.start();
    }

    return { loseLife: true };
  }

  /**
   * Ataque cuerpo a cuerpo de un enemigo.
   *
   * @param {number} currentLives Vidas ANTES del impacto.
   * @returns {{loseLife?: boolean, forceLives?: number}}
   */
  onMeleeHit(currentLives) {
    // R4: sangrando, el golpe te deja en 1 vida y corta el sangrado.
    //
    // Ojo con el caso límite: si ya estabas en 1 vida, "dejar en 1" no cambia
    // nada, así que el golpe no mata. Es lo que dice la especificación al pie de
    // la letra, y de hecho actúa como red de seguridad.
    if (this.isBleeding) {
      this.stop();
      return { forceLives: 1 };
    }

    // R5: sin sangrar, cuesta una vida.
    return { loseLife: true };
  }

  // -------------------------------------------------------------------------
  // Vendajes
  // -------------------------------------------------------------------------

  /**
   * Pulsación de E.
   *
   * @param {number} now Reloj de la escena.
   * @param {number} currentLives
   * @returns {{healed?: boolean, extraLife?: boolean, none?: boolean}}
   */
  onInteract(now, currentLives) {
    // R6: sangrando, una sola pulsación se venda.
    if (this.isBleeding) {
      if (this.bandages < this.bandagesPerHeal) return { none: true };

      this.bandages -= this.bandagesPerHeal;
      this.stop();
      return { healed: true };
    }

    // R7: sin sangrar, doble pulsación cambia 2 vendajes por 1 vida.
    const isDoubleTap = now - this.lastInteractAt <= this.doubleTapWindowMs;
    this.lastInteractAt = now;

    const canTrade =
      isDoubleTap && this.bandages >= this.bandagesPerExtraLife && currentLives < this.maxLives;

    if (!canTrade) return { none: true };

    this.bandages -= this.bandagesPerExtraLife;
    // Consumimos la ventana para que un triple toque no cuente dos veces.
    this.lastInteractAt = -Infinity;
    return { extraLife: true };
  }

  /** Vendaje recogido del mapa. */
  addBandage(amount = 1) {
    this.bandages += amount;
  }

  /**
   * Estado inicial. Solo se llama al reingresar al nivel desde el selector, no
   * al reaparecer tras perder una vida: los vendajes ya recogidos siguen gastados.
   */
  reset() {
    this.bandages = this.startingBandages;
    this.lastInteractAt = -Infinity;
    this.stop();
  }
}
