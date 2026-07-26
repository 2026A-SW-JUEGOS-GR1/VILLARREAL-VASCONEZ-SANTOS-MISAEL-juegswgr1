/**
 * Gestor de vidas / puntos de golpe.
 *
 * Sirve tanto para el jugador (vidas discretas, sin barra) como para los
 * enemigos (3 impactos, con barra visible que dibuja EnemyBase).
 *
 * La invulnerabilidad temporal es opcional porque el nivel 2 no la usa: allí
 * Drago tiene una sola vida y cualquier impacto va directo a GAME OVER, así que
 * un periodo de gracia no tendría ningún efecto.
 */
export default class HealthSystem {
  /**
   * @param {object} options
   * @param {number} options.max                   Vidas/HP máximos.
   * @param {number} [options.current]             Valor inicial (por defecto, el máximo).
   * @param {boolean} [options.useInvulnerability] Activa el periodo de gracia tras el daño.
   * @param {number} [options.invulnerabilityMs]   Duración de ese periodo.
   */
  constructor({ max, current, useInvulnerability = false, invulnerabilityMs = 0 }) {
    this.max = max;
    this.current = current ?? max;
    this.useInvulnerability = useInvulnerability;
    this.invulnerabilityMs = invulnerabilityMs;

    /** Momento (ms de reloj de escena) en que termina la invulnerabilidad. */
    this.invulnerableUntil = 0;
  }

  get isDead() {
    return this.current <= 0;
  }

  /** ¿Está en periodo de gracia ahora mismo? */
  isInvulnerable(now) {
    return this.useInvulnerability && now < this.invulnerableUntil;
  }

  /**
   * Aplica daño.
   *
   * @returns {'ignored'|'hurt'|'dead'} `ignored` si estaba invulnerable.
   */
  damage(now, amount = 1) {
    if (this.isInvulnerable(now)) return 'ignored';

    this.current = Math.max(0, this.current - amount);

    if (this.isDead) return 'dead';

    if (this.useInvulnerability) {
      this.invulnerableUntil = now + this.invulnerabilityMs;
    }
    return 'hurt';
  }

  /**
   * Cura sin pasar del máximo.
   * @returns {boolean} true si realmente subió.
   */
  heal(amount = 1) {
    if (this.current >= this.max) return false;

    this.current = Math.min(this.max, this.current + amount);
    return true;
  }

  /** Fuerza el valor actual (nivel 3: un golpe en sangrado deja a Drago en 1 vida). */
  setCurrent(value) {
    this.current = Math.max(0, Math.min(this.max, value));
  }

  /** Vuelve al estado inicial (reinicio total del nivel). */
  reset() {
    this.current = this.max;
    this.invulnerableUntil = 0;
  }
}
