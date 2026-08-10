import type { Clip } from './types';
import { clamp, uid } from './format';

/** Um clipe já posicionado na linha do tempo de saída. */
export type Segment = {
  clip: Clip;
  /** Duração de saída do clipe (já dividida pela velocidade). */
  outDuration: number;
  outStart: number;
  outEnd: number;
};

export type Timeline = {
  segments: Segment[];
  duration: number;
};

export const MIN_CLIP_DURATION = 0.05;

export function makeClip(start: number, end: number): Clip {
  return {
    id: uid(),
    start,
    end,
    speed: 1,
    volume: 1,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
  };
}

export function clipOutDuration(clip: Clip): number {
  return Math.max(0, (clip.end - clip.start) / clip.speed);
}

export function buildTimeline(clips: Clip[]): Timeline {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const clip of clips) {
    const outDuration = clipOutDuration(clip);
    segments.push({ clip, outDuration, outStart: cursor, outEnd: cursor + outDuration });
    cursor += outDuration;
  }
  return { segments, duration: cursor };
}

/**
 * Converte um instante da linha do tempo de saída no ponto correspondente do
 * vídeo de origem. Retorna null quando o tempo cai fora da linha do tempo.
 */
export function locate(timeline: Timeline, outTime: number): { segment: Segment; sourceTime: number } | null {
  if (timeline.segments.length === 0) return null;
  const t = clamp(outTime, 0, Math.max(0, timeline.duration - 1e-6));
  for (const segment of timeline.segments) {
    if (t < segment.outEnd || segment === timeline.segments[timeline.segments.length - 1]) {
      const offset = (t - segment.outStart) * segment.clip.speed;
      const sourceTime = clamp(segment.clip.start + offset, segment.clip.start, segment.clip.end);
      return { segment, sourceTime };
    }
  }
  return null;
}

/**
 * Divide o clipe que contém `outTime` em dois. Retorna a lista original quando
 * o corte cairia rente demais a uma das pontas.
 */
export function splitAt(clips: Clip[], outTime: number): Clip[] {
  const timeline = buildTimeline(clips);
  const found = locate(timeline, outTime);
  if (!found) return clips;

  const { segment, sourceTime } = found;
  const { clip } = segment;
  if (sourceTime - clip.start < MIN_CLIP_DURATION || clip.end - sourceTime < MIN_CLIP_DURATION) {
    return clips;
  }

  const left: Clip = { ...clip, end: sourceTime, fadeOut: 0 };
  const right: Clip = { ...clip, id: uid(), start: sourceTime, fadeIn: 0 };
  const index = clips.indexOf(clip);
  return [...clips.slice(0, index), left, right, ...clips.slice(index + 1)];
}

export function moveClip(clips: Clip[], id: string, direction: -1 | 1): Clip[] {
  const index = clips.findIndex((c) => c.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= clips.length) return clips;
  const next = [...clips];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Início do clipe na linha do tempo de saída, útil para reposicionar o cursor. */
export function outStartOf(clips: Clip[], id: string): number {
  const { segments } = buildTimeline(clips);
  return segments.find((s) => s.clip.id === id)?.outStart ?? 0;
}
