'use client';

import { useCallback, useRef, useState } from 'react';
import { Clapperboard, FileVideo, Loader2, ShieldCheck, Upload, Zap } from 'lucide-react';
import { probeFile, UnsupportedFileError } from '@/lib/media';
import { useEditor } from '@/lib/store';
import { Button, cx } from './ui';

const ACCEPT = 'video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.ts,.mpeg,.mpg';

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: 'Rápido de verdade',
    body: 'Codificação acelerada por hardware via WebCodecs — sem espera de upload nem de fila.',
  },
  {
    icon: ShieldCheck,
    title: 'O vídeo não sai do seu aparelho',
    body: 'Todo o processamento acontece no navegador. Nenhum arquivo é enviado para servidores.',
  },
  {
    icon: Clapperboard,
    title: 'Já sai no formato certo',
    body: 'Preset 9:16 com resolução e taxa de bits dentro dos requisitos de envio de criativo.',
  },
];

export function Dropzone() {
  const loadProject = useEditor((s) => s.loadProject);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const accept = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      try {
        const info = await probeFile(file);
        loadProject(file, info, URL.createObjectURL(file));
      } catch (err) {
        setError(
          err instanceof UnsupportedFileError
            ? err.message
            : 'Não consegui abrir este arquivo. Verifique se é um vídeo válido.',
        );
      } finally {
        setBusy(false);
      }
    },
    [loadProject],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-14">
      <div className="mb-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900 px-3 py-1 text-[11px] font-medium text-ink-300">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          Roda 100% no navegador
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink-100 sm:text-5xl">
          Editor de vídeo online
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-300">
          Solte qualquer vídeo, corte, enquadre em 9:16, escreva por cima e exporte em MP4 dentro dos
          requisitos de envio — resolução, taxa de bits e tamanho conferidos antes de você baixar.
        </p>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void accept(file);
        }}
        className={cx(
          'relative grid place-items-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors',
          dragging ? 'border-accent bg-accent/10' : 'border-ink-700 bg-ink-900/50 hover:border-ink-600',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void accept(file);
            e.target.value = '';
          }}
        />

        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={30} className="animate-spin text-accent-soft" />
            <p className="text-sm text-ink-300">Lendo o vídeo…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-ink-700 bg-ink-850">
              <Upload size={22} className="text-accent-soft" />
            </span>
            <div>
              <p className="text-base font-medium text-ink-100">
                Arraste um vídeo aqui ou escolha do aparelho
              </p>
              <p className="mt-1 text-xs text-ink-500">
                MP4, MOV, WebM, MKV, AVI, MPEG-TS · sem limite de tamanho imposto pelo editor
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={() => inputRef.current?.click()}>
              <FileVideo size={16} />
              Escolher vídeo
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad"
        >
          {error}
        </p>
      )}

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-ink-800 bg-ink-900/50 p-4">
            <Icon size={18} className="text-accent-soft" />
            <h2 className="mt-3 text-sm font-semibold text-ink-100">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">{body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
