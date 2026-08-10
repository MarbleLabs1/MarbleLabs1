'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crop, Film, Palette, Redo2, RotateCcw, Share2, Type, Undo2, X } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { buildTimeline } from '@/lib/timeline';
import { clamp, formatBytes } from '@/lib/format';
import { Preview } from './Preview';
import { Timeline } from './Timeline';
import { FormatPanel } from './panels/FormatPanel';
import { ClipPanel } from './panels/ClipPanel';
import { TextPanel } from './panels/TextPanel';
import { LookPanel } from './panels/LookPanel';
import { ExportPanel } from './panels/ExportPanel';
import { IconButton, cx } from './ui';

const TABS = [
  { id: 'format', label: 'Formato', icon: Crop, Panel: FormatPanel },
  { id: 'clip', label: 'Clipe', icon: Film, Panel: ClipPanel },
  { id: 'text', label: 'Texto', icon: Type, Panel: TextPanel },
  { id: 'look', label: 'Cor', icon: Palette, Panel: LookPanel },
  { id: 'export', label: 'Exportar', icon: Share2, Panel: ExportPanel },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function Editor() {
  const source = useEditor((s) => s.source);
  const clips = useEditor((s) => s.clips);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const resetEdits = useEditor((s) => s.resetEdits);
  const closeProject = useEditor((s) => s.closeProject);

  const [tab, setTab] = useState<TabId>('format');
  const duration = useMemo(() => buildTimeline(clips).duration, [clips]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Atalhos nunca roubam teclas de quem está digitando.
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      const store = useEditor.getState();
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        store.redo();
        return;
      }
      if (mod) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          store.setPlaying(!store.playing);
          break;
        case 's':
        case 'S':
          event.preventDefault();
          store.splitAtPlayhead();
          break;
        case 'Delete':
        case 'Backspace':
          if (store.selectedClipId) {
            event.preventDefault();
            store.removeClip(store.selectedClipId);
          }
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          event.preventDefault();
          const step = event.shiftKey ? 1 : 0.1;
          const delta = event.key === 'ArrowLeft' ? -step : step;
          store.setPlaying(false);
          store.seek(clamp(store.currentTime + delta, 0, duration));
          break;
        }
        case 'Home':
          event.preventDefault();
          store.seek(0);
          break;
        case 'End':
          event.preventDefault();
          store.seek(duration);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [duration]);

  const ActivePanel = TABS.find((t) => t.id === tab)?.Panel ?? FormatPanel;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-900/80 px-4 py-2.5">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs font-bold text-white">
            M
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-ink-100 sm:block">
            MarbleCut
          </span>
        </span>

        <div className="mx-1 h-5 w-px bg-ink-700" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-ink-200">{source?.fileName}</p>
          <p className="truncate text-[10px] text-ink-500">
            {source ? `${source.width}×${source.height} · ${formatBytes(source.fileSize)}` : ''}
          </p>
        </div>

        <IconButton title="Desfazer (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton title="Refazer (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 size={16} />
        </IconButton>
        <IconButton title="Descartar todas as edições" onClick={resetEdits}>
          <RotateCcw size={16} />
        </IconButton>
        <IconButton title="Fechar e abrir outro vídeo" onClick={closeProject}>
          <X size={16} />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <Preview />
          <Timeline />
        </main>

        <aside className="flex w-full shrink-0 flex-col border-t border-ink-800 bg-ink-950/60 lg:w-[380px] lg:border-t-0 lg:border-l">
          <nav className="flex shrink-0 gap-1 border-b border-ink-800 p-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id}
                className={cx(
                  'flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-soft',
                  tab === id
                    ? 'bg-accent/15 text-accent-soft'
                    : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100',
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <ActivePanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
