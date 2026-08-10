'use client';

import { useMemo } from 'react';
import { Plus, Trash2, Type } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { buildTimeline } from '@/lib/timeline';
import { clamp, formatTime } from '@/lib/format';
import { Button, ColorField, Hint, Panel, Segmented, Slider, cx } from '../ui';
import type { TextAlign } from '@/lib/types';

const WEIGHTS: { value: string; label: string }[] = [
  { value: '400', label: 'Leve' },
  { value: '600', label: 'Médio' },
  { value: '800', label: 'Forte' },
];

const ALIGNS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Esquerda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Direita' },
];

const BACKGROUNDS = [
  { value: '', label: 'Sem faixa' },
  { value: 'rgba(0,0,0,0.55)', label: 'Escura' },
  { value: 'rgba(255,255,255,0.9)', label: 'Clara' },
  { value: '#6d5cff', label: 'Destaque' },
];

export function TextPanel() {
  const overlays = useEditor((s) => s.overlays);
  const selectedOverlayId = useEditor((s) => s.selectedOverlayId);
  const clips = useEditor((s) => s.clips);
  const currentTime = useEditor((s) => s.currentTime);
  const addOverlay = useEditor((s) => s.addOverlay);
  const updateOverlay = useEditor((s) => s.updateOverlay);
  const removeOverlay = useEditor((s) => s.removeOverlay);
  const selectOverlay = useEditor((s) => s.selectOverlay);
  const seek = useEditor((s) => s.seek);

  const duration = useMemo(() => buildTimeline(clips).duration, [clips]);
  const overlay = overlays.find((o) => o.id === selectedOverlayId) ?? null;

  return (
    <div className="space-y-4">
      <Panel
        title="Textos"
        action={
          <Button size="sm" variant="primary" onClick={addOverlay}>
            <Plus size={13} />
            Adicionar
          </Button>
        }
      >
        {overlays.length === 0 ? (
          <Hint>
            Nenhum texto ainda. O texto entra e sai no intervalo que você definir e é gravado no vídeo
            exportado.
          </Hint>
        ) : (
          <ul className="space-y-1.5">
            {overlays.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectOverlay(item.id);
                    seek(item.start);
                  }}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                    item.id === selectedOverlayId
                      ? 'border-accent bg-accent/10'
                      : 'border-ink-700 bg-ink-850 hover:border-ink-600',
                  )}
                >
                  <Type size={13} className="shrink-0 text-ink-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-ink-100">
                      {item.text.split('\n')[0] || 'Texto vazio'}
                    </span>
                    <span className="block font-mono text-[10px] tabular-nums text-ink-500">
                      {formatTime(item.start, false)} → {formatTime(item.end, false)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {overlay && (
        <>
          <Panel
            title="Conteúdo"
            action={
              <button
                type="button"
                onClick={() => removeOverlay(overlay.id)}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-bad/80 transition-colors hover:text-bad"
              >
                <Trash2 size={11} />
                excluir
              </button>
            }
          >
            <textarea
              value={overlay.text}
              rows={3}
              onChange={(e) => updateOverlay(overlay.id, { text: e.target.value })}
              placeholder="Digite o texto. Enter cria uma nova linha."
              className="w-full resize-y rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-600 focus:border-accent/60"
            />
            <Segmented
              label="Peso"
              options={WEIGHTS}
              value={String(overlay.weight)}
              onChange={(value) =>
                updateOverlay(overlay.id, { weight: Number(value) as 400 | 600 | 800 })
              }
            />
            <Segmented
              label="Alinhamento"
              options={ALIGNS}
              value={overlay.align}
              onChange={(align) => updateOverlay(overlay.id, { align })}
            />
          </Panel>

          <Panel title="Aparência">
            <Slider
              label="Tamanho"
              value={overlay.size}
              min={0.02}
              max={0.2}
              step={0.002}
              format={(v) => `${Math.round(v * 100)}% da altura`}
              onChange={(size) => updateOverlay(overlay.id, { size })}
            />
            <ColorField
              label="Cor do texto"
              value={overlay.color}
              onChange={(color) => updateOverlay(overlay.id, { color })}
            />
            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-300">Faixa de fundo</span>
              <div className="grid grid-cols-4 gap-1.5">
                {BACKGROUNDS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => updateOverlay(overlay.id, { background: option.value })}
                    className={cx(
                      'rounded-lg border px-1 py-1.5 text-[10px] font-medium transition-colors',
                      overlay.background === option.value
                        ? 'border-accent bg-accent/15 text-accent-soft'
                        : 'border-ink-700 bg-ink-850 text-ink-300 hover:text-ink-100',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <Slider
              label="Contorno"
              value={overlay.stroke}
              min={0}
              max={16}
              step={0.5}
              format={(v) => `${v.toFixed(1)} px`}
              onChange={(stroke) => updateOverlay(overlay.id, { stroke })}
              onReset={() => updateOverlay(overlay.id, { stroke: 0 })}
            />
            {overlay.stroke > 0 && (
              <ColorField
                label="Cor do contorno"
                value={overlay.strokeColor}
                onChange={(strokeColor) => updateOverlay(overlay.id, { strokeColor })}
              />
            )}
          </Panel>

          <Panel title="Posição e tempo">
            <Slider
              label="Horizontal"
              value={overlay.x}
              min={0}
              max={1}
              step={0.005}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(x) => updateOverlay(overlay.id, { x })}
            />
            <Slider
              label="Vertical"
              value={overlay.y}
              min={0}
              max={1}
              step={0.005}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(y) => updateOverlay(overlay.id, { y })}
            />
            <Slider
              label="Aparece em"
              value={overlay.start}
              min={0}
              max={Math.max(0, duration - 0.1)}
              step={0.05}
              format={formatTime}
              onChange={(start) =>
                updateOverlay(overlay.id, {
                  start,
                  end: Math.max(overlay.end, start + 0.1),
                })
              }
            />
            <Slider
              label="Some em"
              value={overlay.end}
              min={0}
              max={duration}
              step={0.05}
              format={formatTime}
              onChange={(end) => updateOverlay(overlay.id, { end: Math.max(end, overlay.start + 0.1) })}
            />
            <Button
              size="sm"
              onClick={() =>
                updateOverlay(overlay.id, {
                  start: clamp(currentTime, 0, Math.max(0, duration - 0.2)),
                  end: clamp(currentTime + (overlay.end - overlay.start), 0.2, duration),
                })
              }
            >
              Mover para o cursor
            </Button>
          </Panel>
        </>
      )}
    </div>
  );
}
