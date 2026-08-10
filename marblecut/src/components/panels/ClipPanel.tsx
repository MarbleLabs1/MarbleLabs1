'use client';

import { useMemo } from 'react';
import { useEditor } from '@/lib/store';
import { buildTimeline, clipOutDuration, MIN_CLIP_DURATION } from '@/lib/timeline';
import { clamp, formatTime } from '@/lib/format';
import { Button, Hint, Panel, Segmented, Slider, Stat, cx } from '../ui';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function ClipPanel() {
  const clips = useEditor((s) => s.clips);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const currentTime = useEditor((s) => s.currentTime);
  const sourceDuration = useEditor((s) => s.source?.duration ?? 0);
  const hasAudio = useEditor((s) => s.source?.hasAudio ?? false);
  const updateClip = useEditor((s) => s.updateClip);
  const selectClip = useEditor((s) => s.selectClip);
  const seek = useEditor((s) => s.seek);

  const timeline = useMemo(() => buildTimeline(clips), [clips]);
  const clip = clips.find((c) => c.id === selectedClipId) ?? null;
  const segment = timeline.segments.find((s) => s.clip.id === selectedClipId) ?? null;

  if (!clip || !segment) {
    return (
      <Panel title="Clipe">
        <Hint>Selecione um clipe na linha do tempo para ajustar corte, velocidade e áudio.</Hint>
      </Panel>
    );
  }

  /** Converte o cursor (tempo de saída) no ponto correspondente da origem. */
  const playheadInSource = clamp(
    clip.start + (currentTime - segment.outStart) * clip.speed,
    clip.start,
    clip.end,
  );
  const playheadInsideClip = currentTime >= segment.outStart && currentTime <= segment.outEnd;

  return (
    <div className="space-y-4">
      <Panel title="Clipes">
        <div className="flex flex-wrap gap-1.5">
          {timeline.segments.map((s, index) => (
            <button
              key={s.clip.id}
              type="button"
              onClick={() => {
                selectClip(s.clip.id);
                seek(s.outStart);
              }}
              className={cx(
                'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                s.clip.id === selectedClipId
                  ? 'border-accent bg-accent/15 text-accent-soft'
                  : 'border-ink-700 bg-ink-850 text-ink-300 hover:text-ink-100',
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Corte">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Entrada" value={formatTime(clip.start)} />
          <Stat label="Saída" value={formatTime(clip.end)} />
          <Stat label="Na linha final" value={formatTime(clipOutDuration(clip))} />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={!playheadInsideClip || playheadInSource >= clip.end - MIN_CLIP_DURATION}
            onClick={() => updateClip(clip.id, { start: playheadInSource })}
            title="Usa a posição do cursor como novo início"
          >
            Início aqui
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={!playheadInsideClip || playheadInSource <= clip.start + MIN_CLIP_DURATION}
            onClick={() => updateClip(clip.id, { end: playheadInSource })}
            title="Usa a posição do cursor como novo fim"
          >
            Fim aqui
          </Button>
        </div>

        <Slider
          label="Início no vídeo original"
          value={clip.start}
          min={0}
          max={Math.max(0, clip.end - MIN_CLIP_DURATION)}
          step={0.01}
          format={formatTime}
          onChange={(start) => updateClip(clip.id, { start })}
        />
        <Slider
          label="Fim no vídeo original"
          value={clip.end}
          min={Math.min(sourceDuration, clip.start + MIN_CLIP_DURATION)}
          max={sourceDuration}
          step={0.01}
          format={formatTime}
          onChange={(end) => updateClip(clip.id, { end })}
        />
        <Hint>As pontas do bloco na linha do tempo fazem o mesmo ajuste por arraste.</Hint>
      </Panel>

      <Panel title="Velocidade">
        <div className="grid grid-cols-6 gap-1.5">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => updateClip(clip.id, { speed })}
              className={cx(
                'rounded-lg border py-1.5 text-[11px] font-medium transition-colors',
                clip.speed === speed
                  ? 'border-accent bg-accent/15 text-accent-soft'
                  : 'border-ink-700 bg-ink-850 text-ink-300 hover:text-ink-100',
              )}
            >
              {speed}×
            </button>
          ))}
        </div>
        <Slider
          label="Ajuste fino"
          value={clip.speed}
          min={0.25}
          max={4}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(speed) => updateClip(clip.id, { speed })}
          onReset={() => updateClip(clip.id, { speed: 1 })}
        />
      </Panel>

      <Panel title="Áudio do clipe">
        {hasAudio ? (
          <>
            <Segmented
              label="Som"
              options={[
                { value: 'on', label: 'Ativo' },
                { value: 'off', label: 'Mudo' },
              ]}
              value={clip.muted ? 'off' : 'on'}
              onChange={(value) => updateClip(clip.id, { muted: value === 'off' })}
            />
            <Slider
              label="Volume"
              value={clip.volume}
              min={0}
              max={2}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(volume) => updateClip(clip.id, { volume })}
              onReset={() => updateClip(clip.id, { volume: 1 })}
            />
            <Slider
              label="Fade de entrada"
              value={clip.fadeIn}
              min={0}
              max={Math.max(0.1, segment.outDuration / 2)}
              step={0.05}
              format={(v) => `${v.toFixed(2)} s`}
              onChange={(fadeIn) => updateClip(clip.id, { fadeIn })}
              onReset={() => updateClip(clip.id, { fadeIn: 0 })}
            />
            <Slider
              label="Fade de saída"
              value={clip.fadeOut}
              min={0}
              max={Math.max(0.1, segment.outDuration / 2)}
              step={0.05}
              format={(v) => `${v.toFixed(2)} s`}
              onChange={(fadeOut) => updateClip(clip.id, { fadeOut })}
              onReset={() => updateClip(clip.id, { fadeOut: 0 })}
            />
            <Hint>
              O preview toca no máximo 100% de volume. Valores acima disso aparecem só no arquivo
              exportado.
            </Hint>
          </>
        ) : (
          <Hint>O vídeo de origem não tem faixa de áudio utilizável.</Hint>
        )}
      </Panel>
    </div>
  );
}
