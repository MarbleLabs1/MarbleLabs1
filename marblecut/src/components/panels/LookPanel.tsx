'use client';

import { useEditor } from '@/lib/store';
import { LOOK_PRESETS, NEUTRAL_ADJUSTMENTS } from '@/lib/presets';
import { Hint, Panel, Slider, cx } from '../ui';

export function LookPanel() {
  const adjustments = useEditor((s) => s.adjustments);
  const setAdjustments = useEditor((s) => s.setAdjustments);
  const applyLook = useEditor((s) => s.applyLook);

  const matchesPreset = (values: typeof adjustments) =>
    (Object.keys(values) as (keyof typeof values)[]).every(
      (key) => Math.abs(values[key] - adjustments[key]) < 1e-6,
    );

  return (
    <div className="space-y-4">
      <Panel title="Estilos prontos">
        <div className="grid grid-cols-3 gap-1.5">
          {LOOK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyLook(preset.values)}
              className={cx(
                'rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors',
                matchesPreset(preset.values)
                  ? 'border-accent bg-accent/15 text-accent-soft'
                  : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600 hover:text-ink-100',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title="Ajuste fino"
        action={
          <button
            type="button"
            onClick={() => applyLook(NEUTRAL_ADJUSTMENTS)}
            className="text-[10px] uppercase tracking-wide text-ink-500 transition-colors hover:text-accent-soft"
          >
            zerar tudo
          </button>
        }
      >
        <Slider
          label="Brilho"
          value={adjustments.brightness}
          min={0.4}
          max={1.8}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(brightness) => setAdjustments({ brightness })}
          onReset={() => setAdjustments({ brightness: 1 })}
        />
        <Slider
          label="Contraste"
          value={adjustments.contrast}
          min={0.4}
          max={2}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(contrast) => setAdjustments({ contrast })}
          onReset={() => setAdjustments({ contrast: 1 })}
        />
        <Slider
          label="Saturação"
          value={adjustments.saturation}
          min={0}
          max={2.5}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(saturation) => setAdjustments({ saturation })}
          onReset={() => setAdjustments({ saturation: 1 })}
        />
        <Slider
          label="Tom sépia"
          value={adjustments.sepia}
          min={0}
          max={100}
          step={1}
          format={(v) => `${Math.round(v)}%`}
          onChange={(sepia) => setAdjustments({ sepia })}
          onReset={() => setAdjustments({ sepia: 0 })}
        />
        <Slider
          label="Preto e branco"
          value={adjustments.grayscale}
          min={0}
          max={100}
          step={1}
          format={(v) => `${Math.round(v)}%`}
          onChange={(grayscale) => setAdjustments({ grayscale })}
          onReset={() => setAdjustments({ grayscale: 0 })}
        />
        <Slider
          label="Desfoque"
          value={adjustments.blur}
          min={0}
          max={24}
          step={0.5}
          format={(v) => `${v.toFixed(1)} px`}
          onChange={(blur) => setAdjustments({ blur })}
          onReset={() => setAdjustments({ blur: 0 })}
        />
        <Hint>Os ajustes valem para o vídeo inteiro e já aparecem no preview exatamente como saem.</Hint>
      </Panel>
    </div>
  );
}
