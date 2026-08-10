import { PLATFORM_SPEC } from './presets';
import type { ExportResult, ExportSettings, SourceInfo } from './types';
import { formatBitrate, formatBytes, ratioLabel } from './format';

export type CheckStatus = 'pass' | 'fail' | 'warn';

export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Regra exigida, mostrada quando a checagem falha. */
  requirement: string;
};

export type ComplianceReport = {
  checks: Check[];
  ok: boolean;
  /** True quando nada falha mas existe algum aviso (valores estimados). */
  hasWarnings: boolean;
};

/** Candidato genérico avaliado contra a especificação da plataforma. */
export type Candidate = {
  width: number;
  height: number;
  /** Bits por segundo. */
  bitrate: number;
  /** Extensão sem ponto, minúscula. */
  extension: string;
  /** Tamanho em bytes. */
  bytes: number;
  /** Marca tamanho/bitrate como estimativa — vira aviso em vez de aprovação firme. */
  estimated?: boolean;
};

const TOLERANCE = 0.005;

function checkAspect(c: Candidate): Check {
  const target = PLATFORM_SPEC.aspectW / PLATFORM_SPEC.aspectH;
  const actual = c.width / c.height;
  const ok = Math.abs(actual - target) <= TOLERANCE;
  return {
    id: 'aspect',
    label: 'Proporção vertical 9:16',
    status: ok ? 'pass' : 'fail',
    detail: `${c.width}×${c.height} (${ratioLabel(c.width, c.height)})`,
    requirement: 'A tela precisa ser 9:16 exato.',
  };
}

function checkResolution(c: Candidate): Check {
  const ok = c.width >= PLATFORM_SPEC.minWidth && c.height >= PLATFORM_SPEC.minHeight;
  return {
    id: 'resolution',
    label: 'Resolução mínima 540×960',
    status: ok ? 'pass' : 'fail',
    detail: `${c.width}×${c.height}`,
    requirement: `Mínimo de ${PLATFORM_SPEC.minWidth}×${PLATFORM_SPEC.minHeight} px.`,
  };
}

function checkBitrate(c: Candidate): Check {
  const ok = c.bitrate > PLATFORM_SPEC.minBitrate;
  // Uma estimativa acima do mínimo ainda é apenas uma estimativa até o arquivo existir.
  const status: CheckStatus = ok ? (c.estimated ? 'warn' : 'pass') : 'fail';
  return {
    id: 'bitrate',
    label: 'Taxa de bits acima de 516 kbps',
    status,
    detail: c.bitrate > 0 ? `${formatBitrate(c.bitrate)}${c.estimated ? ' (estimado)' : ''}` : 'não disponível',
    requirement: 'A taxa de bits precisa ser maior que 516 kbps.',
  };
}

function checkFormat(c: Candidate): Check {
  const list = PLATFORM_SPEC.allowedExtensions as readonly string[];
  const ok = list.includes(c.extension);
  return {
    id: 'format',
    label: 'Formato MP4, MOV, MPEG ou AVI',
    status: ok ? 'pass' : 'fail',
    detail: c.extension ? `.${c.extension}` : 'desconhecido',
    requirement: 'Envie em MP4, MOV, MPEG ou AVI.',
  };
}

function checkSize(c: Candidate): Check {
  const ok = c.bytes > 0 && c.bytes <= PLATFORM_SPEC.maxBytes;
  const status: CheckStatus = !ok ? 'fail' : c.estimated ? 'warn' : 'pass';
  return {
    id: 'size',
    label: 'Tamanho até 500 MB',
    status,
    detail: c.bytes > 0 ? `${formatBytes(c.bytes)}${c.estimated ? ' (estimado)' : ''}` : 'não disponível',
    requirement: 'O arquivo não pode passar de 500 MB.',
  };
}

export function evaluate(candidate: Candidate): ComplianceReport {
  const checks = [
    checkAspect(candidate),
    checkResolution(candidate),
    checkBitrate(candidate),
    checkFormat(candidate),
    checkSize(candidate),
  ];
  return {
    checks,
    ok: checks.every((c) => c.status !== 'fail'),
    hasWarnings: checks.some((c) => c.status === 'warn'),
  };
}

/** Avalia o arquivo importado — mostra por que ele foi recusado no envio. */
export function evaluateSource(info: SourceInfo): ComplianceReport {
  return evaluate({
    width: info.width,
    height: info.height,
    bitrate: info.bitrate,
    extension: info.extension,
    bytes: info.fileSize,
  });
}

/**
 * Estima o que a exportação vai produzir, antes de codificar.
 * O overhead de container do MP4 fica em torno de 1–2%; 2% dá uma margem segura.
 */
export function estimateOutputBytes(settings: ExportSettings, durationSeconds: number): number {
  const audio = settings.includeAudio ? settings.audioBitrate : 0;
  const totalBits = (settings.videoBitrate + audio) * durationSeconds;
  return Math.round((totalBits / 8) * 1.02);
}

export function evaluatePlan(settings: ExportSettings, durationSeconds: number): ComplianceReport {
  const audio = settings.includeAudio ? settings.audioBitrate : 0;
  return evaluate({
    width: settings.width,
    height: settings.height,
    bitrate: settings.videoBitrate + audio,
    extension: settings.container,
    bytes: estimateOutputBytes(settings, durationSeconds),
    estimated: true,
  });
}

/** Avalia o arquivo realmente gerado, com bitrate e tamanho medidos. */
export function evaluateResult(result: ExportResult): ComplianceReport {
  return evaluate({
    width: result.width,
    height: result.height,
    bitrate: result.bitrate,
    extension: result.extension,
    bytes: result.size,
  });
}
