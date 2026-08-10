/** Helpers de formatação para a interface. */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatBitrate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '—';
  if (bps < 1_000_000) return `${Math.round(bps / 1000)} kbps`;
  return `${(bps / 1_000_000).toFixed(bps < 10_000_000 ? 1 : 0)} Mbps`;
}

/** mm:ss.cs — precisão de centésimos, que é o que importa ao cortar. */
export function formatTime(seconds: number, withCentis = true): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  const base = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  if (!withCentis) return base;
  const cs = Math.floor((seconds - total) * 100);
  return `${base}.${String(cs).padStart(2, '0')}`;
}

/** Duração legível para textos corridos ("1 min 12 s"). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 s';
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Reduz 1080×1920 para "9:16"; cai para decimal quando não é uma razão limpa. */
export function ratioLabel(width: number, height: number): string {
  if (!width || !height) return '—';
  const d = gcd(width, height);
  const w = width / d;
  const h = height / d;
  if (w <= 40 && h <= 40) return `${w}:${h}`;
  return `${(width / height).toFixed(2)}:1`;
}

export function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

/** Troca a extensão preservando o resto do nome. */
export function withExtension(fileName: string, extension: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '') || 'video';
  return `${base}.${extension}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
