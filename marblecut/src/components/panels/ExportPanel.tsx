'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Sparkles, Square, Wand2 } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { EXPORT_PRESETS } from '@/lib/presets';
import { estimateOutputBytes, evaluatePlan, evaluateResult } from '@/lib/compliance';
import { exportVideo, ExportCanceledError } from '@/lib/export';
import { buildTimeline } from '@/lib/timeline';
import { formatBitrate, formatBytes, formatDuration } from '@/lib/format';
import { probeEncoders, type EncoderSupport } from '@/lib/capabilities';
import type { ExportProgress, ExportResult } from '@/lib/types';
import { Button, Hint, NumberField, Panel, Segmented, Slider, Stat, cx } from '../ui';
import { ComplianceCard } from '../ComplianceCard';

const IDLE: ExportProgress = { phase: 'idle', progress: 0, message: '' };

export function ExportPanel() {
  const file = useEditor((s) => s.file);
  const clips = useEditor((s) => s.clips);
  const framing = useEditor((s) => s.framing);
  const adjustments = useEditor((s) => s.adjustments);
  const overlays = useEditor((s) => s.overlays);
  const settings = useEditor((s) => s.exportSettings);
  const hasAudio = useEditor((s) => s.source?.hasAudio ?? false);
  const setExportSettings = useEditor((s) => s.setExportSettings);
  const setPlaying = useEditor((s) => s.setPlaying);

  const [progress, setProgress] = useState<ExportProgress>(IDLE);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const [encoders, setEncoders] = useState<EncoderSupport | null>(null);

  const duration = useMemo(() => buildTimeline(clips).duration, [clips]);
  const planReport = useMemo(() => evaluatePlan(settings, duration), [settings, duration]);
  const resultReport = useMemo(() => (result ? evaluateResult(result) : null), [result]);
  const estimatedBytes = estimateOutputBytes(settings, duration);

  const running = progress.phase !== 'idle' && progress.phase !== 'done' && progress.phase !== 'error';

  useEffect(() => {
    let active = true;
    probeEncoders(settings.width, settings.height).then((support) => {
      if (active) setEncoders(support);
    });
    return () => {
      active = false;
    };
  }, [settings.width, settings.height]);

  // Object URLs de resultados anteriores são liberados ao serem substituídos.
  useEffect(() => {
    const previous = resultUrlRef.current;
    resultUrlRef.current = result?.url ?? null;
    if (previous && previous !== result?.url) URL.revokeObjectURL(previous);
  }, [result]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  const activePresetId = EXPORT_PRESETS.find(
    (p) =>
      p.settings.width === settings.width &&
      p.settings.height === settings.height &&
      p.settings.videoBitrate === settings.videoBitrate,
  )?.id;

  const run = useCallback(async () => {
    if (!file) return;
    setPlaying(false);
    setError(null);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const output = await exportVideo({
        file,
        clips,
        framing,
        adjustments,
        overlays,
        settings,
        onProgress: setProgress,
        signal: controller.signal,
      });
      setResult(output);
    } catch (err) {
      if (err instanceof ExportCanceledError || controller.signal.aborted) {
        setProgress({ phase: 'idle', progress: 0, message: '' });
        return;
      }
      setError(err instanceof Error ? err.message : 'Falha inesperada ao exportar.');
      setProgress({ phase: 'error', progress: 0, message: '' });
    } finally {
      abortRef.current = null;
    }
  }, [adjustments, clips, file, framing, overlays, settings, setPlaying]);

  const autoFix = () => {
    const preset = EXPORT_PRESETS.find((p) => p.compliant);
    if (preset) setExportSettings({ ...preset.settings, container: 'mp4' });
  };

  return (
    <div className="space-y-4">
      <Panel title="Predefinições">
        <div className="space-y-1.5">
          {EXPORT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setExportSettings(preset.settings)}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                preset.id === activePresetId
                  ? 'border-accent bg-accent/10'
                  : 'border-ink-700 bg-ink-850 hover:border-ink-600',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-ink-100">{preset.label}</span>
                <span className="block text-[11px] text-ink-500">{preset.sublabel}</span>
              </span>
              {preset.compliant && (
                <span className="shrink-0 rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ok">
                  9:16
                </span>
              )}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Ajuste manual">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Largura"
            value={settings.width}
            min={64}
            max={4096}
            step={2}
            suffix="px"
            onChange={(width) => setExportSettings({ width })}
          />
          <NumberField
            label="Altura"
            value={settings.height}
            min={64}
            max={4096}
            step={2}
            suffix="px"
            onChange={(height) => setExportSettings({ height })}
          />
        </div>

        <Slider
          label="Taxa de bits do vídeo"
          value={settings.videoBitrate / 1_000_000}
          min={0.3}
          max={20}
          step={0.1}
          format={(v) => `${v.toFixed(1)} Mbps`}
          onChange={(mbps) => setExportSettings({ videoBitrate: Math.round(mbps * 1_000_000) })}
        />
        <Slider
          label="Quadros por segundo"
          value={settings.frameRate}
          min={12}
          max={60}
          step={1}
          format={(v) => `${Math.round(v)} fps`}
          onChange={(frameRate) => setExportSettings({ frameRate: Math.round(frameRate) })}
        />

        <Segmented
          label="Container"
          options={[
            { value: 'mp4', label: 'MP4' },
            { value: 'mov', label: 'MOV' },
            { value: 'webm', label: 'WebM' },
          ]}
          value={settings.container}
          onChange={(container) => setExportSettings({ container })}
        />

        <Segmented
          label="Modo de taxa de bits"
          options={[
            { value: 'cbr', label: 'Constante', title: 'Mantém a taxa perto do alvo o tempo todo' },
            { value: 'vbr', label: 'Variável', title: 'Economiza espaço nas cenas paradas' },
          ]}
          value={settings.constantBitrate ? 'cbr' : 'vbr'}
          onChange={(value) => setExportSettings({ constantBitrate: value === 'cbr' })}
        />
        {settings.constantBitrate && (
          <Hint>
            Em modo variável, um vídeo com pouco movimento pode sair bem abaixo do alvo e ficar
            debaixo do piso de 516 kbps. O modo constante evita isso.
          </Hint>
        )}

        {hasAudio && (
          <>
            <Segmented
              label="Áudio"
              options={[
                { value: 'on', label: 'Incluir' },
                { value: 'off', label: 'Sem áudio' },
              ]}
              value={settings.includeAudio ? 'on' : 'off'}
              onChange={(value) => setExportSettings({ includeAudio: value === 'on' })}
            />
            {settings.includeAudio && (
              <Slider
                label="Taxa de bits do áudio"
                value={settings.audioBitrate / 1000}
                min={48}
                max={320}
                step={8}
                format={(v) => `${Math.round(v)} kbps`}
                onChange={(kbps) => setExportSettings({ audioBitrate: Math.round(kbps) * 1000 })}
              />
            )}
          </>
        )}

        <div className="grid grid-cols-3 gap-3 border-t border-ink-800 pt-3">
          <Stat label="Duração" value={formatDuration(duration)} />
          <Stat label="Estimado" value={formatBytes(estimatedBytes)} />
          <Stat
            label="Taxa total"
            value={formatBitrate(settings.videoBitrate + (settings.includeAudio ? settings.audioBitrate : 0))}
          />
        </div>
        <Hint>
          WebM não é aceito no envio de criativo — para esse fluxo, mantenha MP4.
        </Hint>
      </Panel>

      {encoders && !encoders.h264 && settings.container !== 'webm' && (
        <p className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2.5 text-[11px] leading-relaxed text-warn">
          Este navegador não codifica H.264. O arquivo sai como {settings.container.toUpperCase()}{' '}
          válido, mas com vídeo em VP9/AV1 — alguns sistemas de envio recusam mesmo com a extensão
          certa. Para o envio de criativo, exporte pelo Chrome ou Edge.
        </p>
      )}

      <ComplianceCard
        report={planReport}
        title="Como o arquivo vai sair"
        subtitle="Previsão a partir das configurações atuais, antes de codificar."
      />

      {!planReport.ok && (
        <Button variant="primary" size="lg" className="w-full" onClick={autoFix}>
          <Wand2 size={16} />
          Corrigir para o formato exigido
        </Button>
      )}

      <Panel title="Exportar">
        {running ? (
          <div className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-150"
                style={{ width: `${Math.round(progress.progress * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs text-ink-300">
                <Loader2 size={13} className="animate-spin text-accent-soft" />
                {progress.message}
              </span>
              <span className="font-mono text-xs tabular-nums text-ink-400">
                {Math.round(progress.progress * 100)}%
              </span>
            </div>
            <Button
              variant="danger"
              size="sm"
              className="w-full"
              onClick={() => abortRef.current?.abort()}
            >
              <Square size={13} />
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={() => void run()} disabled={!file}>
            <Sparkles size={16} />
            Exportar vídeo
          </Button>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2.5 text-xs text-bad">
            {error}
          </p>
        )}
      </Panel>

      {result && resultReport && (
        <>
          <Panel title="Arquivo gerado">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Resolução" value={`${result.width}×${result.height}`} />
              <Stat label="Duração" value={formatDuration(result.duration)} />
              <Stat label="Tamanho" value={formatBytes(result.size)} />
              <Stat label="Taxa de bits" value={formatBitrate(result.bitrate)} />
              <Stat label="Codec de vídeo" value={result.videoCodec} />
              <Stat label="Codec de áudio" value={result.audioCodec ?? 'sem áudio'} />
            </div>
            <a
              href={result.url}
              download={result.fileName}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft"
            >
              <Download size={16} />
              Baixar {result.fileName}
            </a>
            <Hint>Codificado em {(result.elapsedMs / 1000).toFixed(1)} s.</Hint>
          </Panel>

          <ComplianceCard
            report={resultReport}
            title="Conferência do arquivo final"
            subtitle="Medido no arquivo que você vai baixar."
          />
        </>
      )}
    </div>
  );
}
