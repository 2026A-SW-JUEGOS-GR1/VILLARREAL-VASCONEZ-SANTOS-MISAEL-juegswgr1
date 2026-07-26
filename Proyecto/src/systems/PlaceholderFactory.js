/**
 * Generador de texturas placeholder procedurales.
 *
 * Los assets gráficos se están produciendo en paralelo. Para no bloquear el
 * desarrollo, cuando un PNG del manifiesto todavía no existe generamos por
 * código una textura con la MISMA key, las MISMAS dimensiones de frame y el
 * MISMO número de frames. El resto del juego no sabe (ni le importa) si está
 * usando el asset final o un placeholder.
 *
 * Los placeholders se dibujan sobre un <canvas> normal y se registran en el
 * TextureManager de Phaser con `addCanvas`, añadiendo los frames a mano cuando
 * se trata de un spritesheet.
 */

/** Clave del registry donde se guarda la lista de keys que son placeholder. */
const REGISTRY_KEY = 'placeholderKeys';

/** Color base por categoría, para reconocer de un vistazo qué es cada cosa. */
const CATEGORY_COLORS = {
  branding: '#00acc1',
  characters: '#43a047',
  enemies: '#e53935',
  items: '#fbc02d',
  projectiles: '#fdd835',
  backgrounds: '#37474f',
  tiles: '#8d6e63',
  hazards: '#8e24aa',
  ui: '#039be5',
  story: '#5e35b1',
};

/** Por debajo de este tamaño no cabe texto legible: se dibuja solo el bloque. */
const MIN_LABEL_WIDTH = 40;
const MIN_LABEL_HEIGHT = 24;

/**
 * Convierte 'drago_idle' en ['DRAGO', 'IDLE'] para rotularlo en dos líneas.
 * Se queda con las dos primeras palabras: suficiente para identificar el asset.
 */
function labelLines(key) {
  return key.toUpperCase().split('_').slice(0, 2);
}

/** Dibuja un único frame del placeholder en el canvas. */
function drawFrame(ctx, ox, oy, w, h, color, lines, frameIndex, frameCount) {
  ctx.save();

  // Recortamos al área del frame para que la trama no se desborde al vecino.
  ctx.beginPath();
  ctx.rect(ox, oy, w, h);
  ctx.clip();
  ctx.translate(ox, oy);

  // Relleno base con un degradado suave (da algo de volumen).
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  // Trama diagonal: señal visual inequívoca de "esto es provisional".
  const step = Math.max(8, Math.round(Math.min(w, h) / 12));
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -h; x < w; x += step) {
    ctx.moveTo(x, h);
    ctx.lineTo(x + h, 0);
  }
  ctx.stroke();

  // Borde.
  const border = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, w - border, h - border);

  // Rótulo con el nombre del asset.
  if (w >= MIN_LABEL_WIDTH && h >= MIN_LABEL_HEIGHT) {
    // Un fondo a pantalla completa lleva el rótulo discreto abajo a la izquierda:
    // centrado y grande competiría con la UI, y arriba choca justo con el HUD.
    // Los assets pequeños (sprites, iconos) sí lo llevan centrado y a contraste.
    const isLargeSurface = Math.min(w, h) >= 400;
    const fontSize = Math.max(8, Math.min(isLargeSurface ? 22 : 26, Math.round(Math.min(w, h) / 8)));
    const lineHeight = fontSize + 2;

    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textBaseline = 'middle';

    const padding = Math.round(fontSize * 0.9);
    const anchorX = isLargeSurface ? padding : w / 2;
    const anchorY = isLargeSurface
      ? h - padding - fontSize / 2 - (lines.length - 1) * lineHeight
      : h / 2 - ((lines.length - 1) * lineHeight) / 2;

    ctx.textAlign = isLargeSurface ? 'left' : 'center';
    ctx.globalAlpha = isLargeSurface ? 0.5 : 1;

    lines.forEach((line, i) => {
      const y = anchorY + i * lineHeight;
      // Sombra + texto, para que se lea sobre cualquier color de fondo.
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(line, anchorX + 1, y + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, anchorX, y);
    });

    ctx.globalAlpha = 1;
  }

  // Indicador de frame: una marca que se desplaza a lo largo de la hoja, así
  // se ve a simple vista que la animación está corriendo y en qué frame va.
  if (frameCount > 1 && w >= 24 && h >= 16) {
    const pad = Math.max(2, Math.round(w * 0.06));
    const trackW = w - pad * 2;
    const markW = Math.max(4, trackW / frameCount);
    const progress = frameCount > 1 ? frameIndex / (frameCount - 1) : 0;
    const markH = Math.max(2, Math.round(h * 0.04));

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(pad, h - pad - markH, trackW, markH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pad + (trackW - markW) * progress, h - pad - markH, markW, markH);
  }

  ctx.restore();
}

/**
 * Crea (y registra en Phaser) la textura placeholder de un descriptor del
 * manifiesto. Devuelve la textura creada.
 */
export function createPlaceholder(scene, asset) {
  const frameWidth = asset.frameWidth ?? asset.width;
  const frameHeight = asset.frameHeight ?? asset.height;
  const frameCount = asset.type === 'spritesheet' ? asset.frames ?? 1 : 1;
  const color = CATEGORY_COLORS[asset.category] ?? '#616161';
  const lines = labelLines(asset.key);

  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * frameCount;
  canvas.height = frameHeight;

  const ctx = canvas.getContext('2d');
  for (let i = 0; i < frameCount; i++) {
    drawFrame(ctx, i * frameWidth, 0, frameWidth, frameHeight, color, lines, i, frameCount);
  }

  // Si la key ya existiera (recarga de escena), la reemplazamos.
  if (scene.textures.exists(asset.key)) {
    scene.textures.remove(asset.key);
  }

  const texture = scene.textures.addCanvas(asset.key, canvas);

  // Para un spritesheet hay que declarar los frames numerados 0..N-1, que es lo
  // que después busca `anims.generateFrameNumbers`.
  if (asset.type === 'spritesheet' && texture) {
    for (let i = 0; i < frameCount; i++) {
      texture.add(i, 0, i * frameWidth, 0, frameWidth, frameHeight);
    }
  }

  return texture;
}

/**
 * Genera los placeholders de todas las keys que no se pudieron cargar y anota
 * la lista en el registry para que cualquier escena pueda consultarla.
 */
export function createMissingPlaceholders(scene, missingAssets) {
  missingAssets.forEach((asset) => createPlaceholder(scene, asset));

  const keys = missingAssets.map((asset) => asset.key);
  scene.registry.set(REGISTRY_KEY, keys);
  return keys;
}

/**
 * ¿La textura de esta key es un placeholder? Se usa, por ejemplo, para mostrar
 * el título en texto mientras `logo.png` no exista.
 */
export function isPlaceholder(scene, key) {
  const keys = scene.registry.get(REGISTRY_KEY);
  return Array.isArray(keys) && keys.includes(key);
}

/** Número de assets que siguen siendo placeholder. */
export function placeholderCount(scene) {
  const keys = scene.registry.get(REGISTRY_KEY);
  return Array.isArray(keys) ? keys.length : 0;
}
