import type { Adjustments, Framing, TextOverlay } from './types';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Fonte de imagem indiferente à origem: o preview desenha a partir de um
 * `<video>` e a exportação a partir de um `VideoSample` decodificado.
 */
export type FrameSource = {
  /** Dimensões já corrigidas por rotação e pixel aspect ratio. */
  width: number;
  height: number;
  draw(
    ctx: Ctx2D,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
};

export type RenderState = {
  framing: Framing;
  adjustments: Adjustments;
  overlays: TextOverlay[];
  /** Posição na linha do tempo de saída, em segundos. */
  time: number;
};

const FONT_STACK = `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export function videoElementSource(el: HTMLVideoElement): FrameSource {
  return {
    width: el.videoWidth,
    height: el.videoHeight,
    draw: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) => {
      ctx.drawImage(el, sx, sy, sw, sh, dx, dy, dw, dh);
    },
  };
}

export function buildFilter(a: Adjustments): string {
  const parts: string[] = [];
  if (a.brightness !== 1) parts.push(`brightness(${a.brightness})`);
  if (a.contrast !== 1) parts.push(`contrast(${a.contrast})`);
  if (a.saturation !== 1) parts.push(`saturate(${a.saturation})`);
  if (a.sepia > 0) parts.push(`sepia(${a.sepia}%)`);
  if (a.grayscale > 0) parts.push(`grayscale(${a.grayscale}%)`);
  if (a.blur > 0) parts.push(`blur(${a.blur}px)`);
  return parts.length ? parts.join(' ') : 'none';
}

type Rect = { dx: number; dy: number; dw: number; dh: number };

/** Calcula onde o quadro de origem cai dentro do quadro de saída. */
function fitRect(
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
  mode: 'cover' | 'contain',
  zoom: number,
  offsetX: number,
  offsetY: number,
): Rect {
  const base = mode === 'cover' ? Math.max(outW / srcW, outH / srcH) : Math.min(outW / srcW, outH / srcH);
  const scale = base * zoom;
  const dw = srcW * scale;
  const dh = srcH * scale;
  // O deslocamento percorre a sobra do eixo, seja ela corte (cover) ou barra (contain).
  const dx = (outW - dw) / 2 + (offsetX * Math.abs(outW - dw)) / 2;
  const dy = (outH - dh) / 2 + (offsetY * Math.abs(outH - dh)) / 2;
  return { dx, dy, dw, dh };
}

/**
 * Desenha um quadro completo — fundo, vídeo enquadrado, ajustes de cor e textos.
 * Preview e exportação chamam exatamente esta função, então o que aparece na
 * tela é o que sai no arquivo.
 */
export function drawFrame(
  ctx: Ctx2D,
  outW: number,
  outH: number,
  source: FrameSource | null,
  state: RenderState,
): void {
  const { framing, adjustments, overlays, time } = state;

  ctx.save();
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.fillStyle = framing.background;
  ctx.fillRect(0, 0, outW, outH);

  if (source && source.width > 0 && source.height > 0) {
    const { width: sw, height: sh } = source;

    if (framing.fit === 'blur') {
      // Fundo desfocado preenchendo o quadro, com leve escurecimento para o
      // vídeo em primeiro plano continuar legível.
      const bg = fitRect(sw, sh, outW, outH, 'cover', 1.12, 0, 0);
      ctx.save();
      ctx.filter = `blur(${Math.round(Math.max(outW, outH) * 0.035)}px) brightness(0.65) saturate(1.1)`;
      source.draw(ctx, 0, 0, sw, sh, bg.dx, bg.dy, bg.dw, bg.dh);
      ctx.restore();
    }

    const mode = framing.fit === 'cover' ? 'cover' : 'contain';
    const r = fitRect(sw, sh, outW, outH, mode, framing.zoom, framing.offsetX, framing.offsetY);

    ctx.save();
    // Em 'cover' o vídeo sangra para fora do quadro; o recorte evita desenhar
    // fora da área útil e mantém o custo de rasterização baixo.
    ctx.beginPath();
    ctx.rect(0, 0, outW, outH);
    ctx.clip();
    ctx.filter = buildFilter(adjustments);
    source.draw(ctx, 0, 0, sw, sh, r.dx, r.dy, r.dw, r.dh);
    ctx.restore();
  }

  ctx.filter = 'none';
  for (const overlay of overlays) {
    if (time < overlay.start || time >= overlay.end) continue;
    drawOverlay(ctx, outW, outH, overlay);
  }
  ctx.restore();
}

function drawOverlay(ctx: Ctx2D, outW: number, outH: number, overlay: TextOverlay): void {
  const lines = overlay.text.split('\n');
  if (lines.every((l) => l.trim() === '')) return;

  const fontSize = Math.max(8, overlay.size * outH);
  const lineHeight = fontSize * 1.22;
  const padX = fontSize * 0.42;
  const padY = fontSize * 0.26;

  ctx.save();
  ctx.font = `${overlay.weight} ${fontSize}px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = overlay.align;

  const anchorX = overlay.x * outW;
  const blockHeight = lines.length * lineHeight;
  const firstLineCenter = overlay.y * outH - blockHeight / 2 + lineHeight / 2;

  if (overlay.background) {
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    let boxX = anchorX - widest / 2;
    if (overlay.align === 'left') boxX = anchorX;
    else if (overlay.align === 'right') boxX = anchorX - widest;

    ctx.fillStyle = overlay.background;
    roundedRect(
      ctx,
      boxX - padX,
      overlay.y * outH - blockHeight / 2 - padY,
      widest + padX * 2,
      blockHeight + padY * 2,
      fontSize * 0.22,
    );
    ctx.fill();
  }

  lines.forEach((line, i) => {
    const y = firstLineCenter + i * lineHeight;
    if (overlay.stroke > 0) {
      ctx.lineWidth = overlay.stroke;
      ctx.strokeStyle = overlay.strokeColor;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(line, anchorX, y);
    }
    ctx.fillStyle = overlay.color;
    ctx.fillText(line, anchorX, y);
  });

  ctx.restore();
}

function roundedRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
