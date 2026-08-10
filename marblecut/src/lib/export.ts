import {
  AudioBufferSink,
  AudioBufferSource,
  BufferTarget,
  canEncodeVideo,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSampleSink,
  WebMOutputFormat,
  type AudioCodec,
  type InputAudioTrack,
  type OutputFormat,
  type VideoCodec,
  type VideoSample,
} from 'mediabunny';

import { createInput } from './media';
import { buildTimeline, type Segment } from './timeline';
import { drawFrame, type FrameSource, type RenderState } from './render';
import { clamp, withExtension } from './format';
import { evenize } from './presets';
import type {
  Adjustments,
  Clip,
  ExportProgress,
  ExportResult,
  ExportSettings,
  Framing,
  TextOverlay,
} from './types';

export class ExportCanceledError extends Error {
  constructor() {
    super('Exportação cancelada.');
    this.name = 'ExportCanceledError';
  }
}

export type ExportOptions = {
  file: File;
  clips: Clip[];
  framing: Framing;
  adjustments: Adjustments;
  overlays: TextOverlay[];
  settings: ExportSettings;
  onProgress: (progress: ExportProgress) => void;
  signal?: AbortSignal;
};

/** Pesos das fases para a barra de progresso somar 100% de ponta a ponta. */
const PHASE_WEIGHTS = { audio: 0.18, video: 0.78, finalize: 0.04 };

const VIDEO_CODEC_PREFERENCE: Record<ExportSettings['container'], VideoCodec[]> = {
  mp4: ['avc', 'hevc', 'av1', 'vp9'],
  mov: ['avc', 'hevc', 'av1', 'vp9'],
  webm: ['vp9', 'av1', 'vp8'],
};

const AUDIO_CODEC_PREFERENCE: Record<ExportSettings['container'], AudioCodec[]> = {
  mp4: ['aac', 'opus'],
  mov: ['aac', 'opus'],
  webm: ['opus', 'vorbis'],
};

function makeFormat(container: ExportSettings['container']): OutputFormat {
  // 'in-memory' põe o índice do MP4 no início do arquivo, então o vídeo começa
  // a tocar sem baixar tudo — é o que players e uploads esperam.
  if (container === 'mp4') return new Mp4OutputFormat({ fastStart: 'in-memory' });
  if (container === 'mov') return new MovOutputFormat({ fastStart: 'in-memory' });
  return new WebMOutputFormat();
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ExportCanceledError();
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Renderiza a trilha de áudio inteira de uma vez: cada clipe entra num
 * OfflineAudioContext na posição de saída correta, com velocidade, volume e
 * fades aplicados. Retorna null quando não há áudio audível.
 */
async function renderAudio(
  audioTrack: InputAudioTrack,
  segments: Segment[],
  totalDuration: number,
  signal?: AbortSignal,
): Promise<AudioBuffer | null> {
  const audible = segments.filter((s) => !s.clip.muted && s.clip.volume > 0 && s.outDuration > 0);
  if (audible.length === 0 || totalDuration <= 0) return null;

  const sampleRate = await audioTrack.getSampleRate();
  // AAC e Opus são universalmente suportados em estéreo; acima disso o suporte
  // de encoder varia por navegador.
  const channels = Math.min(2, await audioTrack.getNumberOfChannels());
  const frames = Math.ceil(totalDuration * sampleRate);
  if (frames <= 0) return null;

  const offline = new OfflineAudioContext(channels, frames, sampleRate);
  const sink = new AudioBufferSink(audioTrack);
  let scheduledAnything = false;

  for (const segment of audible) {
    throwIfAborted(signal);
    const { clip } = segment;
    const sourceDuration = clip.end - clip.start;
    const segmentFrames = Math.ceil(sourceDuration * sampleRate);
    if (segmentFrames <= 0) continue;

    const segmentBuffer = offline.createBuffer(channels, segmentFrames, sampleRate);
    let wroteSamples = false;

    for await (const wrapped of sink.buffers(clip.start, clip.end)) {
      throwIfAborted(signal);
      let sourceOffset = 0;
      let destOffset = Math.round((wrapped.timestamp - clip.start) * sampleRate);
      if (destOffset < 0) {
        sourceOffset = -destOffset;
        destOffset = 0;
      }
      const count = Math.min(wrapped.buffer.length - sourceOffset, segmentFrames - destOffset);
      if (count <= 0) continue;

      for (let ch = 0; ch < channels; ch++) {
        const sourceChannel = Math.min(ch, wrapped.buffer.numberOfChannels - 1);
        const data = wrapped.buffer.getChannelData(sourceChannel);
        segmentBuffer
          .getChannelData(ch)
          .set(data.subarray(sourceOffset, sourceOffset + count), destOffset);
      }
      wroteSamples = true;
    }

    if (!wroteSamples) continue;

    const node = offline.createBufferSource();
    node.buffer = segmentBuffer;
    // A velocidade do clipe é aplicada aqui: o buffer inteiro é comprimido ou
    // esticado para caber exatamente na duração de saída do segmento.
    node.playbackRate.value = clip.speed;

    const gain = offline.createGain();
    const volume = clamp(clip.volume, 0, 2);
    const fadeIn = clamp(clip.fadeIn, 0, segment.outDuration / 2);
    const fadeOut = clamp(clip.fadeOut, 0, segment.outDuration / 2);

    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, segment.outStart);
      gain.gain.linearRampToValueAtTime(volume, segment.outStart + fadeIn);
    } else {
      gain.gain.setValueAtTime(volume, segment.outStart);
    }
    if (fadeOut > 0) {
      gain.gain.setValueAtTime(volume, Math.max(segment.outStart, segment.outEnd - fadeOut));
      gain.gain.linearRampToValueAtTime(0, segment.outEnd);
    }

    node.connect(gain).connect(offline.destination);
    node.start(segment.outStart);
    node.stop(segment.outEnd);
    scheduledAnything = true;
  }

  if (!scheduledAnything) return null;
  return offline.startRendering();
}

/** Fatia o áudio renderizado em blocos para o encoder receber trabalho em ritmo constante. */
function sliceAudio(buffer: AudioBuffer, start: number, length: number): AudioBuffer {
  const slice = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length,
    sampleRate: buffer.sampleRate,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    slice.getChannelData(ch).set(buffer.getChannelData(ch).subarray(start, start + length));
  }
  return slice;
}

export async function exportVideo(options: ExportOptions): Promise<ExportResult> {
  const { file, clips, framing, adjustments, overlays, settings, onProgress, signal } = options;
  const startedAt = performance.now();

  const width = evenize(settings.width);
  const height = evenize(settings.height);
  const fps = clamp(settings.frameRate, 1, 120);

  const timeline = buildTimeline(clips.filter((c) => c.end > c.start));
  if (timeline.segments.length === 0 || timeline.duration <= 0) {
    throw new Error('Não há nada para exportar — a linha do tempo está vazia.');
  }

  onProgress({ phase: 'preparing', progress: 0, message: 'Preparando codificadores…' });

  const input = createInput(file);
  const output = new Output({ format: makeFormat(settings.container), target: new BufferTarget() });

  try {
    throwIfAborted(signal);

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error('O arquivo de origem não tem faixa de vídeo.');

    const supportedVideo = output.format.getSupportedVideoCodecs();
    const videoCodec = await getFirstEncodableVideoCodec(
      VIDEO_CODEC_PREFERENCE[settings.container].filter((c) => supportedVideo.includes(c)),
      { width, height },
    );
    if (!videoCodec) {
      throw new Error(
        'Seu navegador não tem codificador de vídeo compatível. Use o Chrome ou o Edge atualizados.',
      );
    }

    // Nem todo par navegador/codec aceita taxa constante; sem essa verificação o
    // encoder falharia ao ser configurado.
    const bitrateMode: 'constant' | 'variable' =
      settings.constantBitrate &&
      (await canEncodeVideo(videoCodec, {
        width,
        height,
        bitrate: settings.videoBitrate,
        bitrateMode: 'constant',
      }))
        ? 'constant'
        : 'variable';

    const audioTrack = settings.includeAudio ? await input.getPrimaryAudioTrack() : null;
    const usableAudioTrack = audioTrack && (await audioTrack.canDecode()) ? audioTrack : null;

    let audioCodec: AudioCodec | null = null;
    if (usableAudioTrack) {
      const supportedAudio = output.format.getSupportedAudioCodecs();
      audioCodec = await getFirstEncodableAudioCodec(
        AUDIO_CODEC_PREFERENCE[settings.container].filter((c) => supportedAudio.includes(c)),
        {
          numberOfChannels: Math.min(2, await usableAudioTrack.getNumberOfChannels()),
          sampleRate: await usableAudioTrack.getSampleRate(),
        },
      );
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | null;
    if (!ctx) throw new Error('Não foi possível criar o contexto de desenho 2D.');

    const videoSource = new CanvasSource(canvas, {
      codec: videoCodec,
      bitrate: settings.videoBitrate,
      bitrateMode,
      // Um keyframe a cada 2 s mantém o arquivo navegável sem inflar o tamanho.
      keyFrameInterval: 2,
      sizeChangeBehavior: 'deny',
    });
    output.addVideoTrack(videoSource, { frameRate: fps });

    let audioSource: AudioBufferSource | null = null;
    if (usableAudioTrack && audioCodec) {
      audioSource = new AudioBufferSource({
        codec: audioCodec,
        bitrate: new Quality({ bitrate: settings.audioBitrate }),
      });
      output.addAudioTrack(audioSource);
    }

    await output.start();
    throwIfAborted(signal);

    // ---- Áudio ---------------------------------------------------------
    let audioWeightUsed = 0;
    if (usableAudioTrack && audioSource) {
      onProgress({ phase: 'audio', progress: 0, message: 'Processando áudio…' });
      const rendered = await renderAudio(usableAudioTrack, timeline.segments, timeline.duration, signal);
      if (rendered) {
        const chunkFrames = rendered.sampleRate; // blocos de 1 segundo
        for (let offset = 0; offset < rendered.length; offset += chunkFrames) {
          throwIfAborted(signal);
          const length = Math.min(chunkFrames, rendered.length - offset);
          await audioSource.add(sliceAudio(rendered, offset, length));
          const done = (offset + length) / rendered.length;
          onProgress({
            phase: 'audio',
            progress: done * PHASE_WEIGHTS.audio,
            message: 'Processando áudio…',
          });
        }
      }
      audioSource.close();
      audioWeightUsed = PHASE_WEIGHTS.audio;
    }

    // ---- Vídeo ---------------------------------------------------------
    const sink = new VideoSampleSink(videoTrack);
    const frameDuration = 1 / fps;
    const totalFrames = Math.max(1, Math.round(timeline.duration * fps));
    let framesDone = 0;
    let lastSample: VideoSample | null = null;

    const baseState: Omit<RenderState, 'time'> = { framing, adjustments, overlays };

    for (const segment of timeline.segments) {
      throwIfAborted(signal);
      const { clip } = segment;
      const segmentFrames = Math.max(1, Math.round(segment.outDuration * fps));

      // Timestamps de origem crescentes dentro do segmento — é o que o
      // decodificador precisa para avançar sem voltar atrás.
      const sourceTimestamps: number[] = [];
      for (let i = 0; i < segmentFrames; i++) {
        const sourceTime = clip.start + i * frameDuration * clip.speed;
        sourceTimestamps.push(Math.min(sourceTime, Math.max(clip.start, clip.end - 1e-4)));
      }

      let index = 0;
      for await (const sample of sink.samplesAtTimestamps(sourceTimestamps)) {
        throwIfAborted(signal);
        const outTime = segment.outStart + index * frameDuration;

        // Um timestamp sem quadro novo (fps de saída maior que o da origem)
        // reaproveita o último quadro decodificado, mantendo a cadência
        // constante e permitindo que os textos continuem animando por cima.
        if (sample) {
          lastSample?.close();
          lastSample = sample;
        }

        const current = lastSample;
        const frameSource: FrameSource | null = current
          ? {
              width: current.displayWidth,
              height: current.displayHeight,
              draw: (target, sx, sy, sw, sh, dx, dy, dw, dh) =>
                current.draw(target, sx, sy, sw, sh, dx, dy, dw, dh),
            }
          : null;
        drawFrame(ctx, width, height, frameSource, { ...baseState, time: outTime });

        await videoSource.add(outTime, frameDuration);
        index++;
        framesDone++;
        if (framesDone % 3 === 0 || framesDone === totalFrames) {
          onProgress({
            phase: 'video',
            progress: audioWeightUsed + (framesDone / totalFrames) * PHASE_WEIGHTS.video,
            message: `Codificando vídeo — quadro ${framesDone} de ${totalFrames}`,
          });
        }
      }
    }

    lastSample?.close();
    lastSample = null;
    videoSource.close();
    throwIfAborted(signal);

    onProgress({
      phase: 'finalizing',
      progress: audioWeightUsed + PHASE_WEIGHTS.video,
      message: 'Fechando o arquivo…',
    });
    await output.finalize();

    const buffer = output.target.buffer;
    if (!buffer) throw new Error('A codificação terminou sem produzir dados.');

    const mimeType = await output.getMimeType();
    const blob = new Blob([buffer], { type: mimeType });
    const extension = output.format.fileExtension.replace(/^\./, '');
    const result: ExportResult = {
      url: URL.createObjectURL(blob),
      fileName: withExtension(file.name.replace(/\.[a-z0-9]+$/i, '-editado'), extension),
      size: blob.size,
      duration: timeline.duration,
      width,
      height,
      bitrate: timeline.duration > 0 ? (blob.size * 8) / timeline.duration : 0,
      extension,
      elapsedMs: performance.now() - startedAt,
      videoCodec,
      audioCodec: audioSource ? audioCodec : null,
    };

    onProgress({ phase: 'done', progress: 1, message: 'Pronto.' });
    return result;
  } catch (error) {
    if (output.state === 'started' || output.state === 'pending') {
      await output.cancel().catch(() => {});
    }
    throw error;
  } finally {
    input.dispose();
  }
}
