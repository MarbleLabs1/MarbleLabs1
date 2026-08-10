'use client';

import { create } from 'zustand';
import type {
  Adjustments,
  Clip,
  ExportSettings,
  Framing,
  SourceInfo,
  TextAlign,
  TextOverlay,
} from './types';
import {
  DEFAULT_EXPORT,
  DEFAULT_FRAMING,
  EXPORT_PRESETS,
  NEUTRAL_ADJUSTMENTS,
  evenize,
} from './presets';
import { buildTimeline, makeClip, moveClip, splitAt, type Timeline } from './timeline';
import { clamp, uid } from './format';

/** A parte do estado que entra no histórico de desfazer. */
type Doc = {
  clips: Clip[];
  framing: Framing;
  adjustments: Adjustments;
  overlays: TextOverlay[];
  exportSettings: ExportSettings;
};

type Transient = {
  file: File | null;
  source: SourceInfo | null;
  objectUrl: string | null;
  currentTime: number;
  playing: boolean;
  selectedClipId: string | null;
  selectedOverlayId: string | null;
  past: Doc[];
  future: Doc[];
};

type Actions = {
  loadProject: (file: File, source: SourceInfo, objectUrl: string) => void;
  closeProject: () => void;

  seek: (time: number) => void;
  setPlaying: (playing: boolean) => void;

  selectClip: (id: string | null) => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  splitAtPlayhead: () => void;
  removeClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  nudgeClip: (id: string, direction: -1 | 1) => void;

  setFraming: (patch: Partial<Framing>) => void;
  setAdjustments: (patch: Partial<Adjustments>) => void;
  applyLook: (values: Adjustments) => void;

  addOverlay: () => void;
  updateOverlay: (id: string, patch: Partial<TextOverlay>) => void;
  removeOverlay: (id: string) => void;
  selectOverlay: (id: string | null) => void;

  setExportSettings: (patch: Partial<ExportSettings>) => void;
  applyAspect: (aspectW: number, aspectH: number) => void;

  undo: () => void;
  redo: () => void;
  resetEdits: () => void;

  timeline: () => Timeline;
  duration: () => number;
};

export type EditorStore = Doc & Transient & Actions;

const MAX_HISTORY = 60;

const emptyDoc = (): Doc => ({
  clips: [],
  framing: { ...DEFAULT_FRAMING },
  adjustments: { ...NEUTRAL_ADJUSTMENTS },
  overlays: [],
  exportSettings: { ...DEFAULT_EXPORT },
});

function snapshot(state: Doc): Doc {
  return {
    clips: state.clips.map((c) => ({ ...c })),
    framing: { ...state.framing },
    adjustments: { ...state.adjustments },
    overlays: state.overlays.map((o) => ({ ...o })),
    exportSettings: { ...state.exportSettings },
  };
}

/** Mudanças contínuas (arrastar um slider) viram um único passo de desfazer. */
const COALESCE_WINDOW_MS = 600;

export const useEditor = create<EditorStore>((set, get) => {
  let lastKey = '';
  let lastAt = 0;

  /**
   * Aplica uma mudança gravando o estado anterior no histórico. Chamadas
   * seguidas com a mesma `key` dentro da janela de coalescência reaproveitam o
   * snapshot já gravado, então arrastar um controle não gera dezenas de passos.
   */
  const commit = (patch: Partial<Doc>, key?: string) =>
    set((state) => {
      const now = Date.now();
      const merge = key !== undefined && key === lastKey && now - lastAt < COALESCE_WINDOW_MS;
      lastKey = key ?? '';
      lastAt = now;
      if (merge) return patch;
      return {
        ...patch,
        past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
        future: [],
      };
    });

  return {
    ...emptyDoc(),
    file: null,
    source: null,
    objectUrl: null,
    currentTime: 0,
    playing: false,
    selectedClipId: null,
    selectedOverlayId: null,
    past: [],
    future: [],

    loadProject: (file, source, objectUrl) => {
      const clip = makeClip(0, source.duration);
      const sourceAspect = source.height > 0 ? source.width / source.height : 1;
      const preset =
        EXPORT_PRESETS.find((p) => p.compliant) ?? EXPORT_PRESETS[0];
      const targetAspect = preset.settings.width / preset.settings.height;

      // Recortar um vídeo horizontal para 9:16 joga fora quase todo o quadro;
      // o fundo desfocado preserva a imagem inteira e ainda preenche a tela.
      const aspectGap = Math.max(sourceAspect / targetAspect, targetAspect / sourceAspect);
      const fit = aspectGap > 1.35 ? 'blur' : 'cover';

      const frameRate = source.frameRate
        ? clamp(Math.round(source.frameRate), 15, 60)
        : preset.settings.frameRate;

      set({
        file,
        source,
        objectUrl,
        clips: [clip],
        framing: { ...DEFAULT_FRAMING, fit },
        adjustments: { ...NEUTRAL_ADJUSTMENTS },
        overlays: [],
        exportSettings: { ...DEFAULT_EXPORT, ...preset.settings, frameRate, includeAudio: source.hasAudio },
        currentTime: 0,
        playing: false,
        selectedClipId: clip.id,
        selectedOverlayId: null,
        past: [],
        future: [],
      });
    },

    closeProject: () => {
      const { objectUrl } = get();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      set({
        ...emptyDoc(),
        file: null,
        source: null,
        objectUrl: null,
        currentTime: 0,
        playing: false,
        selectedClipId: null,
        selectedOverlayId: null,
        past: [],
        future: [],
      });
    },

    seek: (time) => set({ currentTime: Math.max(0, time) }),
    setPlaying: (playing) => set({ playing }),

    selectClip: (id) => set({ selectedClipId: id }),

    updateClip: (id, patch) =>
      commit(
        { clips: get().clips.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip)) },
        `clip:${id}:${Object.keys(patch).join()}`,
      ),

    splitAtPlayhead: () => {
      const { clips, currentTime } = get();
      const next = splitAt(clips, currentTime);
      if (next !== clips) commit({ clips: next });
    },

    removeClip: (id) => {
      const { clips } = get();
      if (clips.length <= 1) return;
      const next = clips.filter((clip) => clip.id !== id);
      commit({ clips: next });
      if (get().selectedClipId === id) set({ selectedClipId: next[0]?.id ?? null });
    },

    duplicateClip: (id) => {
      const { clips } = get();
      const index = clips.findIndex((clip) => clip.id === id);
      if (index === -1) return;
      const copy: Clip = { ...clips[index], id: uid() };
      commit({ clips: [...clips.slice(0, index + 1), copy, ...clips.slice(index + 1)] });
    },

    nudgeClip: (id, direction) => {
      const next = moveClip(get().clips, id, direction);
      if (next !== get().clips) commit({ clips: next });
    },

    setFraming: (patch) =>
      commit({ framing: { ...get().framing, ...patch } }, `framing:${Object.keys(patch).join()}`),

    setAdjustments: (patch) =>
      commit(
        { adjustments: { ...get().adjustments, ...patch } },
        `adjustments:${Object.keys(patch).join()}`,
      ),

    applyLook: (values) => commit({ adjustments: { ...values } }),

    addOverlay: () => {
      const { overlays, currentTime } = get();
      const duration = buildTimeline(get().clips).duration;
      const overlay: TextOverlay = {
        id: uid(),
        text: 'Seu texto aqui',
        x: 0.5,
        y: 0.82,
        size: 0.062,
        color: '#ffffff',
        background: 'rgba(0,0,0,0.55)',
        align: 'center' as TextAlign,
        weight: 800,
        stroke: 0,
        strokeColor: '#000000',
        start: clamp(currentTime, 0, Math.max(0, duration - 0.5)),
        end: clamp(currentTime + 3, 0.5, duration || currentTime + 3),
      };
      commit({ overlays: [...overlays, overlay] });
      set({ selectedOverlayId: overlay.id });
    },

    updateOverlay: (id, patch) =>
      commit(
        { overlays: get().overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)) },
        `overlay:${id}:${Object.keys(patch).join()}`,
      ),

    removeOverlay: (id) => {
      commit({ overlays: get().overlays.filter((o) => o.id !== id) });
      if (get().selectedOverlayId === id) set({ selectedOverlayId: null });
    },

    selectOverlay: (id) => set({ selectedOverlayId: id }),

    setExportSettings: (patch) => {
      const next = { ...get().exportSettings, ...patch };
      next.width = evenize(next.width);
      next.height = evenize(next.height);
      commit({ exportSettings: next }, `export:${Object.keys(patch).join()}`);
    },

    applyAspect: (aspectW, aspectH) => {
      const current = get().exportSettings;
      // Mantém o lado maior e recalcula o outro, então trocar a proporção não
      // derruba a resolução para baixo do mínimo exigido.
      const longSide = Math.max(current.width, current.height);
      const width = aspectW >= aspectH ? longSide : Math.round((longSide * aspectW) / aspectH);
      const height = aspectH >= aspectW ? longSide : Math.round((longSide * aspectH) / aspectW);
      commit({
        exportSettings: { ...current, width: evenize(width), height: evenize(height) },
      });
    },

    undo: () => {
      const { past } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      set((state) => ({
        ...previous,
        past: past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, MAX_HISTORY),
      }));
    },

    redo: () => {
      const { future } = get();
      if (future.length === 0) return;
      const next = future[0];
      set((state) => ({
        ...next,
        past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
        future: future.slice(1),
      }));
    },

    resetEdits: () => {
      const { source } = get();
      if (!source) return;
      const clip = makeClip(0, source.duration);
      commit({
        clips: [clip],
        framing: { ...DEFAULT_FRAMING },
        adjustments: { ...NEUTRAL_ADJUSTMENTS },
        overlays: [],
      });
      set({ selectedClipId: clip.id, selectedOverlayId: null, currentTime: 0 });
    },

    timeline: () => buildTimeline(get().clips),
    duration: () => buildTimeline(get().clips).duration,
  };
});
