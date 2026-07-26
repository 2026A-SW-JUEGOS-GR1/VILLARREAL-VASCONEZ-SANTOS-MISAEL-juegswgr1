/**
 * Cooldown genérico para habilidades especiales.
 *
 * Lo comparten el doble salto (nivel 2) y el dash (nivel 3), que tienen la misma
 * mecánica de recarga (5 s) y el mismo tipo de indicador en el HUD: verde
 * "disponible" o gris con barra de progreso.
 *
 * No depende de Phaser: recibe el reloj desde fuera.
 */
export default class AbilityCooldown {
  constructor({ cooldownMs }) {
    this.cooldownMs = cooldownMs;
    this.readyAt = 0;
  }

  /** ¿Se puede usar ya? */
  isReady(now) {
    return now >= this.readyAt;
  }

  /** Milisegundos que faltan para estar disponible. */
  remaining(now) {
    return Math.max(0, this.readyAt - now);
  }

  /** Progreso de recarga, 0 (recién usada) → 1 (lista). Para la barra del HUD. */
  progress(now) {
    if (this.cooldownMs <= 0) return 1;
    return 1 - this.remaining(now) / this.cooldownMs;
  }

  /**
   * Consume la habilidad si está disponible y arranca el cooldown.
   * @returns {boolean} true si se pudo usar.
   */
  use(now) {
    if (!this.isReady(now)) return false;

    this.readyAt = now + this.cooldownMs;
    return true;
  }

  /** Deja la habilidad disponible de inmediato. */
  reset() {
    this.readyAt = 0;
  }
}
