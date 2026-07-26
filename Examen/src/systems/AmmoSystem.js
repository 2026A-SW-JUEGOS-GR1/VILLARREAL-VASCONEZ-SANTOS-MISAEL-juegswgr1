/**
 * Munición y recarga del rifle de Drago.
 *
 * Reglas (sección 3 de la especificación):
 *  - Cargador de 7 balas, recargas infinitas.
 *  - Cadencia máxima de un disparo cada 200 ms.
 *  - La recarga es automática: arranca sola al vaciar el cargador y también si
 *    el jugador aprieta disparo estando vacío (para no tener que esperar el
 *    temporizador si ya sabe que está seco).
 *
 * El sistema no conoce Phaser: recibe el reloj (`now`) desde fuera. Eso lo hace
 * trivial de razonar y de probar.
 */
export default class AmmoSystem {
  constructor({ magazineSize, fireRateMs, reloadMs }) {
    this.magazineSize = magazineSize;
    this.fireRateMs = fireRateMs;
    this.reloadMs = reloadMs;

    this.current = magazineSize;
    this.isReloading = false;

    /** Momento en que se puede volver a disparar. */
    this.nextShotAt = 0;
    /** Momento en que termina la recarga en curso. */
    this.reloadEndsAt = 0;
  }

  /** Progreso de la recarga, 0 → 1. Lo usa el HUD para la barra. */
  reloadProgress(now) {
    if (!this.isReloading) return 1;

    const remaining = Math.max(0, this.reloadEndsAt - now);
    return 1 - remaining / this.reloadMs;
  }

  /** Hay que llamarlo cada frame para cerrar la recarga cuando le toca. */
  update(now) {
    if (this.isReloading && now >= this.reloadEndsAt) {
      this.isReloading = false;
      this.current = this.magazineSize;
    }
  }

  /**
   * Intenta disparar.
   *
   * @returns {boolean} true si sale una bala. Si el cargador está vacío,
   *          devuelve false y deja iniciada la recarga.
   */
  tryFire(now) {
    if (this.isReloading) return false;

    if (this.current <= 0) {
      // Apretar el gatillo en seco adelanta la recarga.
      this.startReload(now);
      return false;
    }

    if (now < this.nextShotAt) return false;

    this.current -= 1;
    this.nextShotAt = now + this.fireRateMs;

    // Última bala: la recarga arranca sola.
    if (this.current === 0) {
      this.startReload(now);
    }
    return true;
  }

  startReload(now) {
    if (this.isReloading || this.current === this.magazineSize) return;

    this.isReloading = true;
    this.reloadEndsAt = now + this.reloadMs;
  }

  /** Cargador lleno y sin recarga pendiente (reinicio de nivel). */
  reset() {
    this.current = this.magazineSize;
    this.isReloading = false;
    this.nextShotAt = 0;
    this.reloadEndsAt = 0;
  }
}
