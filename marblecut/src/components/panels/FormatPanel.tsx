'use client';

import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { ASPECT_PRESETS } from '@/lib/presets';
import { evaluateSource } from '@/lib/compliance';
import { formatBitrate, formatBytes, formatDuration, ratioLabel } from '@/lib/format';
import { ColorField, Hint, Panel, Segmented, Slider, Stat, cx } from '../ui';
import { ComplianceCard } from '../ComplianceCard';
import type { FitMode } from '@/lib/types';

const FIT_OPTIONS: { value: FitMode; label: string; title: string }[] = [
  { value: 'cover', label: 'Preencher', title: 'Amplia até cobrir o quadro, cortando as sobras' },
  { value: 'blur', label: 'Fundo desfocado', title: 'Vídeo inteiro visível sobre um fundo borrado' },
  { value: 'contain', label: 'Barras', title: 'Vídeo inteiro visível com barras sólidas' },
];

export function FormatPanel() {
  const source = useEditor((s) => s.source);
  const framing = useEditor((s) => s.framing);
  const exportSettings = useEditor((s) => s.exportSettings);
  const setFraming = useEditor((s) => s.setFraming);
  const applyAspect = useEditor((s) => s.applyAspect);

  const currentAspect = ratioLabel(exportSettings.width, exportSettings.height);
  const sourceReport = useMemo(() => (source ? evaluateSource(source) : null), [source]);

  return (
    <div className="space-y-4">
      <Panel title="Proporção da saída">
        <div className="grid grid-cols-4 gap-1.5">
          {ASPECT_PRESETS.map((preset) => {
            const active = currentAspect === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.hint}
                onClick={() => applyAspect(preset.w, preset.h)}
                className={cx(
                  'rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-soft',
                  active
                    ? 'border-accent bg-accent/15 text-accent-soft'
                    : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600 hover:text-ink-100',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <Hint>
          O envio de criativo exige 9:16. Trocar a proporção aqui muda a resolução de saída na aba
          Exportar.
        </Hint>
      </Panel>

      <Panel
        title="Enquadramento"
        action={
          <button
            type="button"
            onClick={() => setFraming({ zoom: 1, offsetX: 0, offsetY: 0 })}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-500 transition-colors hover:text-accent-soft"
          >
            <RotateCcw size={11} />
            centralizar
          </button>
        }
      >
        <Segmented
          label="Como encaixar o vídeo"
          options={FIT_OPTIONS}
          value={framing.fit}
          onChange={(fit) => setFraming({ fit })}
        />
        <Slider
          label="Zoom"
          value={framing.zoom}
          min={1}
          max={3}
          step={0.01}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(zoom) => setFraming({ zoom })}
          onReset={() => setFraming({ zoom: 1 })}
        />
        <Slider
          label="Posição horizontal"
          value={framing.offsetX}
          min={-1}
          max={1}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(offsetX) => setFraming({ offsetX })}
          onReset={() => setFraming({ offsetX: 0 })}
        />
        <Slider
          label="Posição vertical"
          value={framing.offsetY}
          min={-1}
          max={1}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(offsetY) => setFraming({ offsetY })}
          onReset={() => setFraming({ offsetY: 0 })}
        />
        <ColorField
          label="Cor do fundo"
          value={framing.background}
          onChange={(background) => setFraming({ background })}
        />
        <Hint>Também dá para arrastar direto no preview para reposicionar.</Hint>
      </Panel>

      {source && (
        <Panel title="Arquivo de origem">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Resolução" value={`${source.width}×${source.height}`} />
            <Stat label="Proporção" value={ratioLabel(source.width, source.height)} />
            <Stat label="Duração" value={formatDuration(source.duration)} />
            <Stat label="Taxa de quadros" value={source.frameRate ? `${source.frameRate.toFixed(1)} fps` : '—'} />
            <Stat label="Taxa de bits" value={formatBitrate(source.bitrate)} />
            <Stat label="Tamanho" value={formatBytes(source.fileSize)} />
            <Stat label="Codec de vídeo" value={source.videoCodec ?? '—'} />
            <Stat label="Codec de áudio" value={source.audioCodec ?? 'sem áudio'} />
          </div>
        </Panel>
      )}

      {sourceReport && (
        <ComplianceCard
          report={sourceReport}
          title="O arquivo original passaria no envio?"
          subtitle="Checagem do vídeo como ele está hoje, antes de qualquer edição."
        />
      )}
    </div>
  );
}
