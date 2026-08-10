/** Modelos de dados do editor. Tudo vive no navegador — nada é enviado a servidores. */

/** Um corte do vídeo de origem, posicionado na linha do tempo de saída. */
export type Clip = {
  id: string;
  /** Ponto de entrada no vídeo de origem, em segundos. */
  start: number;
  /** Ponto de saída no vídeo de origem, em segundos. */
  end: number;
  /** 0.25x a 4x. Afeta duração de saída e o pitch do áudio. */
  speed: number;
  /** 0 a 2 (0 = mudo, 1 = original, 2 = +6 dB). */
  volume: number;
  muted: boolean;
  /** Fade de áudio em segundos, medido na linha do tempo de saída. */
  fadeIn: number;
  fadeOut: number;
};

export type FitMode = 'cover' | 'contain' | 'blur';

/** Como o vídeo de origem é encaixado no quadro de saída. */
export type Framing = {
  fit: FitMode;
  /** Multiplicador de escala aplicado depois do fit (1 = sem zoom). */
  zoom: number;
  /** Deslocamento normalizado (-1 a 1) relativo à sobra de cada eixo. */
  offsetX: number;
  offsetY: number;
  /** Cor das barras / fundo. */
  background: string;
};

export type Adjustments = {
  /** 0 a 2, onde 1 é neutro. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** 0 a 100 (%). */
  sepia: number;
  grayscale: number;
  /** Desfoque em pixels do quadro de saída. */
  blur: number;
};

export type TextAlign = 'left' | 'center' | 'right';

export type TextOverlay = {
  id: string;
  text: string;
  /** Posição normalizada do ponto de ancoragem (0 a 1) no quadro de saída. */
  x: number;
  y: number;
  /** Tamanho da fonte como fração da altura do quadro (0.02 a 0.25). */
  size: number;
  color: string;
  /** Cor da faixa atrás do texto; '' desliga a faixa. */
  background: string;
  align: TextAlign;
  weight: 400 | 600 | 800;
  /** Contorno em pixels do quadro de saída (0 desliga). */
  stroke: number;
  strokeColor: string;
  /** Janela de exibição na linha do tempo de saída, em segundos. */
  start: number;
  end: number;
};

/** Metadados lidos do arquivo importado. */
export type SourceInfo = {
  fileName: string;
  fileSize: number;
  /** Extensão normalizada em minúsculas, sem ponto. */
  extension: string;
  mimeType: string;
  duration: number;
  width: number;
  height: number;
  frameRate: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hasAudio: boolean;
  /** Bitrate médio do arquivo inteiro, em bits por segundo. */
  bitrate: number;
  rotation: number;
};

export type ExportSettings = {
  width: number;
  height: number;
  /** Bitrate de vídeo em bits por segundo. */
  videoBitrate: number;
  frameRate: number;
  /** Bitrate de áudio em bits por segundo. */
  audioBitrate: number;
  includeAudio: boolean;
  container: 'mp4' | 'mov' | 'webm';
  /**
   * Taxa de bits constante. Codificadores em modo variável economizam bits em
   * cenas paradas e podem ficar abaixo do piso exigido no envio; o modo
   * constante mantém a taxa perto do alvo.
   */
  constantBitrate: boolean;
};

export type ExportPhase =
  | 'idle'
  | 'preparing'
  | 'audio'
  | 'video'
  | 'finalizing'
  | 'done'
  | 'error'
  | 'canceled';

export type ExportProgress = {
  phase: ExportPhase;
  /** 0 a 1. */
  progress: number;
  message: string;
};

/** Resultado de uma exportação concluída. */
export type ExportResult = {
  url: string;
  fileName: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  /** Bitrate real medido do arquivo gerado. */
  bitrate: number;
  extension: string;
  elapsedMs: number;
  /** Codecs realmente escolhidos pelo navegador. */
  videoCodec: string;
  audioCodec: string | null;
};
