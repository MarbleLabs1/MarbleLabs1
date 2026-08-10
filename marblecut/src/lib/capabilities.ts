import { canEncodeAudio, canEncodeVideo } from 'mediabunny';

export type EncoderSupport = {
  /** H.264 — na prática é o que "MP4" significa para sistemas de envio de criativo. */
  h264: boolean;
  /** AAC — o par de áudio esperado num MP4. */
  aac: boolean;
};

/**
 * Descobre se o navegador consegue gerar um MP4 no padrão que os formulários de
 * envio esperam. Chromium sem codecs proprietários (comum no Linux) e alguns
 * navegadores alternativos codificam MP4 só com VP9/AV1, que muitos sistemas
 * recusam mesmo o container estando correto.
 */
export async function probeEncoders(width: number, height: number): Promise<EncoderSupport> {
  const [h264, aac] = await Promise.all([
    canEncodeVideo('avc', { width, height }).catch(() => false),
    canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48000 }).catch(() => false),
  ]);
  return { h264, aac };
}
