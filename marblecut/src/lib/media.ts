import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { SourceInfo } from './types';
import { extensionOf } from './format';

/** Abre um arquivo local para leitura. Cada operação cria o seu próprio Input. */
export function createInput(file: File): Input {
  return new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
}

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileError';
  }
}

/**
 * Lê os metadados do arquivo sem decodificar o vídeo inteiro.
 * O bitrate é o do arquivo completo (tamanho ÷ duração), que é a métrica
 * usada pelos formulários de envio.
 */
export async function probeFile(file: File): Promise<SourceInfo> {
  const input = createInput(file);
  try {
    if (!(await input.canRead())) {
      throw new UnsupportedFileError(
        'Não foi possível ler este arquivo. Use MP4, MOV, WebM, MKV, AVI ou MPEG-TS.',
      );
    }

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new UnsupportedFileError('Este arquivo não tem faixa de vídeo.');
    }
    if (!(await videoTrack.canDecode())) {
      const codec = (await videoTrack.getCodec()) ?? 'desconhecido';
      throw new UnsupportedFileError(
        `Seu navegador não consegue decodificar o codec "${codec}". Tente pelo Chrome ou Edge atualizados.`,
      );
    }

    const audioTrack = await input.getPrimaryAudioTrack();
    const [duration, width, height, rotation, videoCodec] = await Promise.all([
      input.computeDuration(),
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      videoTrack.getRotation(),
      videoTrack.getCodec(),
    ]);

    // Amostra uma janela de pacotes em vez do arquivo inteiro — rápido e suficiente
    // para estimar a taxa de quadros.
    let frameRate: number | null = null;
    try {
      const stats = await videoTrack.computePacketStats(120);
      frameRate = stats.averagePacketRate > 0 ? stats.averagePacketRate : null;
    } catch {
      frameRate = null;
    }

    // Só considera a faixa de áudio se o navegador realmente puder decodificá-la.
    const audioDecodable = audioTrack ? await audioTrack.canDecode() : false;

    return {
      fileName: file.name,
      fileSize: file.size,
      extension: extensionOf(file.name),
      mimeType: file.type || (await input.getMimeType().catch(() => '')),
      duration,
      width,
      height,
      frameRate,
      videoCodec,
      audioCodec: audioTrack ? await audioTrack.getCodec() : null,
      hasAudio: audioDecodable,
      bitrate: duration > 0 ? (file.size * 8) / duration : 0,
      rotation,
    };
  } finally {
    input.dispose();
  }
}
