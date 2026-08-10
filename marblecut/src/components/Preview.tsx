'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Grid2x2, Move, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { buildTimeline, locate } from '@/lib/timeline';
import { drawFrame, videoElementSource, type RenderState } from '@/lib/render';
import { clamp, formatTime } from '@/lib/format';
import { IconButton, cx } from './ui';

/** Lado maior do canvas de preview. Menor que a saída — o preview não precisa de 1080p. */
const PREVIEW_LONG_SIDE = 720;

/** Margem das guias de área segura (fração da altura) onde a UI dos apps cobre o vídeo. */
const SAFE_MARGIN_TOP = 0.14;
const SAFE_MARGIN_BOTTOM = 0.2;

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(false);

  const objectUrl = useEditor((s) => s.objectUrl);
  const clips = useEditor((s) => s.clips);
  const framing = useEditor((s) => s.framing);
  const adjustments = useEditor((s) => s.adjustments);
  const overlays = useEditor((s) => s.overlays);
  const exportSettings = useEditor((s) => s.exportSettings);
  const currentTime = useEditor((s) => s.currentTime);
  const playing = useEditor((s) => s.playing);
  const seek = useEditor((s) => s.seek);
  const setPlaying = useEditor((s) => s.setPlaying);
  const setFraming = useEditor((s) => s.setFraming);

  const timeline = useMemo(() => buildTimeline(clips), [clips]);

  const { canvasWidth, canvasHeight, scale } = useMemo(() => {
    const { width, height } = exportSettings;
    const factor = PREVIEW_LONG_SIDE / Math.max(width, height);
    const s = Math.min(1, factor);
    return {
      canvasWidth: Math.max(2, Math.round(width * s)),
      canvasHeight: Math.max(2, Math.round(height * s)),
      scale: s,
    };
  }, [exportSettings]);

  // O loop de desenho lê tudo por ref, para não ser recriado a cada tecla digitada.
  const stateRef = useRef({
    timeline,
    framing,
    adjustments,
    overlays,
    playing,
    canvasWidth,
    canvasHeight,
    scale,
    previewMuted,
  });
  stateRef.current = {
    timeline,
    framing,
    adjustments,
    overlays,
    playing,
    canvasWidth,
    canvasHeight,
    scale,
    previewMuted,
  };

  /** Último tempo escrito na store pelo próprio preview — distingue seek externo. */
  const emittedTimeRef = useRef(0);
  const segmentIndexRef = useRef(0);

  const composeState = useCallback(
    (time: number, s: number): RenderState => {
      const st = stateRef.current;
      return {
        framing: st.framing,
        // Desfoque e contorno são medidos em pixels do quadro final; no preview
        // reduzido eles precisam encolher junto para a imagem bater com a saída.
        adjustments: { ...st.adjustments, blur: st.adjustments.blur * s },
        overlays: st.overlays.map((o) => ({ ...o, stroke: o.stroke * s })),
        time,
      };
    },
    [],
  );

  // Loop de renderização e sincronia de reprodução.
  useEffect(() => {
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const st = stateRef.current;
      const segments = st.timeline.segments;
      let time = useEditor.getState().currentTime;

      if (video && st.playing && segments.length > 0) {
        const index = clamp(segmentIndexRef.current, 0, segments.length - 1);
        const segment = segments[index];
        const { clip } = segment;

        if (video.currentTime >= clip.end - 1e-3) {
          const next = segments[index + 1];
          if (next) {
            segmentIndexRef.current = index + 1;
            video.currentTime = next.clip.start;
            time = next.outStart;
          } else {
            setPlaying(false);
            video.pause();
            time = st.timeline.duration;
          }
        } else {
          time = segment.outStart + (video.currentTime - clip.start) / clip.speed;
        }

        time = clamp(time, 0, st.timeline.duration);
        emittedTimeRef.current = time;
        seek(time);

        const targetRate = clamp(clip.speed, 0.25, 4);
        if (Math.abs(video.playbackRate - targetRate) > 1e-3) video.playbackRate = targetRate;
        // O elemento <video> não passa de 100% de volume; acima disso o ganho
        // só aparece no arquivo exportado.
        const targetVolume = st.previewMuted ? 0 : clamp(clip.volume, 0, 1);
        if (Math.abs(video.volume - targetVolume) > 1e-3) video.volume = targetVolume;
        if (video.muted !== (clip.muted || st.previewMuted)) {
          video.muted = clip.muted || st.previewMuted;
        }
      }

      const source = video && video.readyState >= 2 ? videoElementSource(video) : null;
      drawFrame(ctx, st.canvasWidth, st.canvasHeight, source, composeState(time, st.scale));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [composeState, seek, setPlaying]);

  // Seek externo (linha do tempo, atalhos, painéis) → posiciona o <video>.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || timeline.segments.length === 0) return;
    if (Math.abs(currentTime - emittedTimeRef.current) < 0.03) return;

    const found = locate(timeline, currentTime);
    if (!found) return;
    segmentIndexRef.current = timeline.segments.indexOf(found.segment);
    emittedTimeRef.current = currentTime;
    if (Math.abs(video.currentTime - found.sourceTime) > 0.03) {
      video.currentTime = found.sourceTime;
    }
  }, [currentTime, timeline]);

  // Play/pause segue a store; ao dar play do fim, recomeça do início.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!playing) {
      video.pause();
      return;
    }
    const state = useEditor.getState();
    const atEnd = state.currentTime >= timeline.duration - 0.05;
    const startAt = atEnd ? 0 : state.currentTime;
    const found = locate(timeline, startAt);
    if (!found) {
      setPlaying(false);
      return;
    }
    segmentIndexRef.current = timeline.segments.indexOf(found.segment);
    emittedTimeRef.current = startAt;
    seek(startAt);
    video.currentTime = found.sourceTime;
    void video.play().catch(() => setPlaying(false));
  }, [playing, timeline, seek, setPlaying]);

  // Arrastar sobre o preview reposiciona o enquadramento.
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const canPan = framing.fit !== 'contain' || framing.zoom > 1;

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canPan) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, offsetX: framing.offsetX, offsetY: framing.offsetY };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // Metade do quadro percorre toda a faixa de deslocamento (-1 a 1).
    const dx = ((e.clientX - drag.x) / rect.width) * 2;
    const dy = ((e.clientY - drag.y) / rect.height) * 2;
    setFraming({
      offsetX: clamp(drag.offsetX + dx, -1, 1),
      offsetY: clamp(drag.offsetY + dy, -1, 1),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const step = (delta: number) => {
    setPlaying(false);
    seek(clamp(currentTime + delta, 0, timeline.duration));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-ink-800 bg-[radial-gradient(circle_at_50%_0%,#171a23,#08090c)] p-4">
        <div className="relative flex h-full max-h-full items-center justify-center">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{ aspectRatio: `${exportSettings.width} / ${exportSettings.height}` }}
            className={cx(
              'max-h-[58vh] max-w-full rounded-xl bg-black object-contain shadow-2xl shadow-black/60 ring-1 ring-ink-700',
              canPan ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-default',
            )}
          />

          {showSafeArea && (
            <div className="pointer-events-none absolute inset-0 rounded-xl">
              <div
                className="absolute inset-x-0 top-0 border-b border-dashed border-warn/50 bg-warn/5"
                style={{ height: `${SAFE_MARGIN_TOP * 100}%` }}
              />
              <div
                className="absolute inset-x-0 bottom-0 border-t border-dashed border-warn/50 bg-warn/5"
                style={{ height: `${SAFE_MARGIN_BOTTOM * 100}%` }}
              />
            </div>
          )}

          {!ready && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-ink-950/70 text-xs text-ink-400">
              carregando vídeo…
            </div>
          )}
        </div>

        {canPan && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-ink-700 bg-ink-900/85 px-2.5 py-1 text-[10px] text-ink-400">
            <Move size={10} className="mr-1 inline align-[-1px]" />
            arraste para reenquadrar
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-ink-800 bg-ink-900/70 px-3 py-2">
        <IconButton title="Voltar 1 segundo" onClick={() => step(-1)}>
          <SkipBack size={16} />
        </IconButton>
        <IconButton
          title={playing ? 'Pausar (espaço)' : 'Reproduzir (espaço)'}
          active={playing}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </IconButton>
        <IconButton title="Avançar 1 segundo" onClick={() => step(1)}>
          <SkipForward size={16} />
        </IconButton>

        <span className="ml-1 font-mono text-xs tabular-nums text-ink-300">
          {formatTime(currentTime)}
          <span className="text-ink-600"> / {formatTime(timeline.duration)}</span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          <IconButton
            title="Guias de área segura"
            active={showSafeArea}
            onClick={() => setShowSafeArea((v) => !v)}
          >
            <Grid2x2 size={16} />
          </IconButton>
          <IconButton
            title={previewMuted ? 'Ativar som do preview' : 'Silenciar preview'}
            active={previewMuted}
            onClick={() => setPreviewMuted((v) => !v)}
          >
            {previewMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </IconButton>
        </div>
      </div>

      {objectUrl && (
        <video
          ref={videoRef}
          src={objectUrl}
          playsInline
          preload="auto"
          className="hidden"
          onLoadedData={() => setReady(true)}
          onEnded={() => setPlaying(false)}
        />
      )}
    </div>
  );
}
