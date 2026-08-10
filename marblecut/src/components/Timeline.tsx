'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Scissors, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { buildTimeline, MIN_CLIP_DURATION } from '@/lib/timeline';
import { clamp, formatTime } from '@/lib/format';
import { Button, IconButton, cx } from './ui';

type DragState =
  | { kind: 'scrub' }
  | { kind: 'trim'; clipId: string; edge: 'start' | 'end'; originX: number; origin: number; speed: number };

export function Timeline() {
  const clips = useEditor((s) => s.clips);
  const currentTime = useEditor((s) => s.currentTime);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const sourceDuration = useEditor((s) => s.source?.duration ?? 0);
  const seek = useEditor((s) => s.seek);
  const setPlaying = useEditor((s) => s.setPlaying);
  const selectClip = useEditor((s) => s.selectClip);
  const updateClip = useEditor((s) => s.updateClip);
  const splitAtPlayhead = useEditor((s) => s.splitAtPlayhead);
  const removeClip = useEditor((s) => s.removeClip);
  const duplicateClip = useEditor((s) => s.duplicateClip);
  const nudgeClip = useEditor((s) => s.nudgeClip);

  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const timeline = useMemo(() => buildTimeline(clips), [clips]);
  const contentWidth = Math.max(viewportWidth * zoom, 1);
  const pxPerSecond = timeline.duration > 0 ? contentWidth / timeline.duration : 0;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(element);
    setViewportWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const timeAtClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || pxPerSecond <= 0) return 0;
      const rect = track.getBoundingClientRect();
      return clamp((clientX - rect.left) / pxPerSecond, 0, timeline.duration);
    },
    [pxPerSecond, timeline.duration],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === 'scrub') {
        seek(timeAtClientX(event.clientX));
        return;
      }

      // O arraste acontece em tempo de saída; a velocidade do clipe converte
      // esse deslocamento no tempo do vídeo de origem.
      const deltaSeconds = ((event.clientX - drag.originX) / pxPerSecond) * drag.speed;
      const clip = useEditor.getState().clips.find((c) => c.id === drag.clipId);
      if (!clip) return;

      if (drag.edge === 'start') {
        const next = clamp(drag.origin + deltaSeconds, 0, clip.end - MIN_CLIP_DURATION);
        updateClip(clip.id, { start: next });
      } else {
        const next = clamp(drag.origin + deltaSeconds, clip.start + MIN_CLIP_DURATION, sourceDuration);
        updateClip(clip.id, { end: next });
      }
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [pxPerSecond, seek, sourceDuration, timeAtClientX, updateClip]);

  const ticks = useMemo(() => {
    if (timeline.duration <= 0 || pxPerSecond <= 0) return [];
    // Escolhe o menor passo "redondo" que mantém pelo menos 70 px entre marcas.
    const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const stepSeconds = candidates.find((c) => c * pxPerSecond >= 70) ?? candidates[candidates.length - 1];
    const result: { time: number; label: string }[] = [];
    for (let t = 0; t <= timeline.duration + 1e-6; t += stepSeconds) {
      // Com passo abaixo de 1 s, o rótulo em mm:ss repetiria; os décimos separam as marcas.
      const label = stepSeconds < 1 ? `${t.toFixed(1)}s` : formatTime(t, false);
      result.push({ time: t, label });
    }
    return result;
  }, [pxPerSecond, timeline.duration]);

  const selected = clips.find((c) => c.id === selectedClipId) ?? null;

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-ink-800 bg-ink-900/70 p-3">
      <header className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={splitAtPlayhead} title="Dividir no cursor (S)">
          <Scissors size={14} />
          Dividir
        </Button>
        <Button
          size="sm"
          onClick={() => selected && duplicateClip(selected.id)}
          disabled={!selected}
          title="Duplicar clipe"
        >
          <Copy size={14} />
          Duplicar
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => selected && removeClip(selected.id)}
          disabled={!selected || clips.length <= 1}
          title="Excluir clipe (Delete)"
        >
          <Trash2 size={14} />
          Excluir
        </Button>

        <div className="mx-1 h-5 w-px bg-ink-700" />

        <IconButton
          title="Mover clipe para a esquerda"
          disabled={!selected}
          onClick={() => selected && nudgeClip(selected.id, -1)}
        >
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton
          title="Mover clipe para a direita"
          disabled={!selected}
          onClick={() => selected && nudgeClip(selected.id, 1)}
        >
          <ChevronRight size={16} />
        </IconButton>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-ink-500">
            {clips.length} {clips.length === 1 ? 'clipe' : 'clipes'} · {formatTime(timeline.duration)}
          </span>
          <IconButton title="Menos zoom" onClick={() => setZoom((z) => clamp(z / 1.6, 1, 16))}>
            <ZoomOut size={16} />
          </IconButton>
          <IconButton title="Mais zoom" onClick={() => setZoom((z) => clamp(z * 1.6, 1, 16))}>
            <ZoomIn size={16} />
          </IconButton>
        </div>
      </header>

      <div ref={viewportRef} className="overflow-x-auto overflow-y-hidden pb-1">
        <div style={{ width: contentWidth }}>
          {/* Régua */}
          <div className="relative h-5 select-none">
            {ticks.map((tick) => (
              <span
                key={tick.time}
                className="absolute top-0 -translate-x-1/2 font-mono text-[10px] tabular-nums text-ink-600"
                style={{ left: tick.time * pxPerSecond }}
              >
                {tick.label}
              </span>
            ))}
          </div>

          {/* Trilha */}
          <div
            ref={trackRef}
            onPointerDown={(e) => {
              if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.scrub) return;
              setPlaying(false);
              dragRef.current = { kind: 'scrub' };
              seek(timeAtClientX(e.clientX));
            }}
            className="relative h-20 touch-none rounded-xl bg-ink-850"
          >
            <div data-scrub className="absolute inset-0 rounded-xl" />

            {timeline.segments.map((segment) => {
              const { clip } = segment;
              const isSelected = clip.id === selectedClipId;
              const left = segment.outStart * pxPerSecond;
              const width = Math.max(6, segment.outDuration * pxPerSecond);
              return (
                <div
                  key={clip.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    selectClip(clip.id);
                  }}
                  className={cx(
                    'group absolute inset-y-1 overflow-hidden rounded-lg border transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/20 ring-1 ring-accent/50'
                      : 'border-ink-600 bg-ink-700/70 hover:border-ink-500',
                  )}
                  style={{ left, width }}
                >
                  <div className="pointer-events-none flex h-full flex-col justify-between p-1.5">
                    <span className="truncate font-mono text-[10px] tabular-nums text-ink-200">
                      {formatTime(clip.start, false)} → {formatTime(clip.end, false)}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {clip.speed !== 1 && (
                        <span className="rounded bg-ink-900/80 px-1 text-[9px] text-accent-soft">
                          {clip.speed}×
                        </span>
                      )}
                      {(clip.muted || clip.volume === 0) && (
                        <span className="rounded bg-ink-900/80 px-1 text-[9px] text-ink-400">mudo</span>
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label="Ajustar início do clipe"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      selectClip(clip.id);
                      dragRef.current = {
                        kind: 'trim',
                        clipId: clip.id,
                        edge: 'start',
                        originX: e.clientX,
                        origin: clip.start,
                        speed: clip.speed,
                      };
                    }}
                    className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize bg-ink-100/10 hover:bg-accent/60"
                  />
                  <button
                    type="button"
                    aria-label="Ajustar fim do clipe"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      selectClip(clip.id);
                      dragRef.current = {
                        kind: 'trim',
                        clipId: clip.id,
                        edge: 'end',
                        originX: e.clientX,
                        origin: clip.end,
                        speed: clip.speed,
                      };
                    }}
                    className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize bg-ink-100/10 hover:bg-accent/60"
                  />
                </div>
              );
            })}

            {/* Cursor de reprodução */}
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-accent-soft"
              style={{ left: currentTime * pxPerSecond }}
            >
              <span className="absolute -top-1 -left-[5px] h-2.5 w-2.5 rounded-full bg-accent-soft shadow" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
