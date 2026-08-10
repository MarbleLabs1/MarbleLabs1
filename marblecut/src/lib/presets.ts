import type { Adjustments, ExportSettings, Framing } from './types';

/**
 * Requisitos de envio de criativo vertical (o formato exigido no formulário:
 * 9:16, mínimo 540x960, bitrate acima de 516 kbps, MP4/MOV/MPEG/AVI, até 500 MB).
 */
export const PLATFORM_SPEC = {
  label: 'Vertical 9:16 — envio de criativo',
  aspectW: 9,
  aspectH: 16,
  minWidth: 540,
  minHeight: 960,
  /** O requisito é "> 516 kbps", então 516000 não passa; precisa ser maior. */
  minBitrate: 516_000,
  allowedExtensions: ['mp4', 'mov', 'mpeg', 'mpg', 'avi'] as const,
  maxBytes: 500 * 1024 * 1024,
} as const;

export type AspectPreset = {
  id: string;
  label: string;
  w: number;
  h: number;
  hint: string;
};

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: '9:16', label: '9:16', w: 9, h: 16, hint: 'Vertical — Reels, Shorts, TikTok' },
  { id: '1:1', label: '1:1', w: 1, h: 1, hint: 'Quadrado — feed' },
  { id: '4:5', label: '4:5', w: 4, h: 5, hint: 'Retrato — feed Instagram' },
  { id: '16:9', label: '16:9', w: 16, h: 9, hint: 'Horizontal — YouTube' },
];

export type ExportPreset = {
  id: string;
  label: string;
  sublabel: string;
  settings: Pick<ExportSettings, 'width' | 'height' | 'videoBitrate' | 'frameRate' | 'audioBitrate'>;
  /** Marca o preset que atende ao formulário de envio de criativo. */
  compliant: boolean;
};

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'vertical-1080',
    label: '1080 × 1920 · 9:16',
    sublabel: 'Recomendado para o envio — 6 Mbps',
    settings: { width: 1080, height: 1920, videoBitrate: 6_000_000, frameRate: 30, audioBitrate: 128_000 },
    compliant: true,
  },
  {
    id: 'vertical-720',
    label: '720 × 1280 · 9:16',
    sublabel: 'Arquivo menor — 3 Mbps',
    settings: { width: 720, height: 1280, videoBitrate: 3_000_000, frameRate: 30, audioBitrate: 128_000 },
    compliant: true,
  },
  {
    id: 'vertical-540',
    label: '540 × 960 · 9:16',
    sublabel: 'Resolução mínima aceita — 1,5 Mbps',
    settings: { width: 540, height: 960, videoBitrate: 1_500_000, frameRate: 30, audioBitrate: 96_000 },
    compliant: true,
  },
  {
    id: 'square-1080',
    label: '1080 × 1080 · 1:1',
    sublabel: 'Feed quadrado — 5 Mbps',
    settings: { width: 1080, height: 1080, videoBitrate: 5_000_000, frameRate: 30, audioBitrate: 128_000 },
    compliant: false,
  },
  {
    id: 'portrait-1080',
    label: '1080 × 1350 · 4:5',
    sublabel: 'Retrato Instagram — 5 Mbps',
    settings: { width: 1080, height: 1350, videoBitrate: 5_000_000, frameRate: 30, audioBitrate: 128_000 },
    compliant: false,
  },
  {
    id: 'landscape-1080',
    label: '1920 × 1080 · 16:9',
    sublabel: 'Horizontal — 8 Mbps',
    settings: { width: 1920, height: 1080, videoBitrate: 8_000_000, frameRate: 30, audioBitrate: 128_000 },
    compliant: false,
  },
];

export const DEFAULT_EXPORT: ExportSettings = {
  ...EXPORT_PRESETS[0].settings,
  includeAudio: true,
  container: 'mp4',
  constantBitrate: true,
};

export const DEFAULT_FRAMING: Framing = {
  fit: 'cover',
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  background: '#000000',
};

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sepia: 0,
  grayscale: 0,
  blur: 0,
};

export type LookPreset = { id: string; label: string; values: Adjustments };

export const LOOK_PRESETS: LookPreset[] = [
  { id: 'original', label: 'Original', values: NEUTRAL_ADJUSTMENTS },
  {
    id: 'vivid',
    label: 'Vívido',
    values: { ...NEUTRAL_ADJUSTMENTS, saturation: 1.35, contrast: 1.12, brightness: 1.04 },
  },
  {
    id: 'clean',
    label: 'Clean',
    values: { ...NEUTRAL_ADJUSTMENTS, brightness: 1.08, contrast: 1.05, saturation: 1.05 },
  },
  {
    id: 'cinema',
    label: 'Cinema',
    values: { ...NEUTRAL_ADJUSTMENTS, contrast: 1.2, saturation: 0.88, brightness: 0.96 },
  },
  {
    id: 'mono',
    label: 'P&B',
    values: { ...NEUTRAL_ADJUSTMENTS, grayscale: 100, contrast: 1.1 },
  },
  {
    id: 'warm',
    label: 'Quente',
    values: { ...NEUTRAL_ADJUSTMENTS, sepia: 28, saturation: 1.15, brightness: 1.03 },
  },
];

/** Ajusta para número par — encoders H.264 exigem dimensões pares. */
export function evenize(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}
