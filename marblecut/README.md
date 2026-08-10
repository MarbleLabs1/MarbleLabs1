# MarbleCut — editor de vídeo online

Editor de vídeo que roda inteiro no navegador. Você solta qualquer vídeo, corta,
enquadra em 9:16, escreve por cima e exporta em MP4 — sem upload, sem fila de
processamento e sem servidor tocando no arquivo.

Foi construído com um alvo concreto: gerar criativos que passem nos requisitos de
envio de plataformas de anúncio (proporção 9:16, mínimo 540×960, taxa de bits
acima de 516 kbps, MP4/MOV/MPEG/AVI, até 500 MB). O app confere esses requisitos
em três momentos — no arquivo importado, na previsão da exportação e no arquivo
final medido.

## Stack

| Peça | Escolha |
| --- | --- |
| Framework | Next.js 16 · App Router · Turbopack |
| UI | React 19, Tailwind CSS 4, lucide-react |
| Linguagem | TypeScript 7 |
| Estado | Zustand 5 |
| Mídia | [mediabunny](https://mediabunny.dev) sobre WebCodecs |

Decodificação, composição e codificação usam **WebCodecs**, com aceleração por
hardware quando o navegador oferece. Não há `ffmpeg.wasm` nem backend: o custo de
inicialização é próximo de zero e a codificação roda em velocidade de máquina, não
em tempo real.

## Rodando

```bash
cd marblecut
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm run start   # produção
npm run typecheck                # tsc --noEmit
```

## O que dá para fazer

**Corte e ritmo** — linha do tempo com múltiplos clipes, aparar arrastando as
pontas, dividir no cursor, duplicar, reordenar e excluir. Velocidade de 0,25× a 4×
por clipe, com o áudio acompanhando.

**Enquadramento** — proporções 9:16, 1:1, 4:5 e 16:9. Três modos de encaixe:
preencher (corta as sobras), fundo desfocado (mantém o vídeo inteiro visível) e
barras sólidas. Zoom e reposicionamento por arraste direto no preview.

**Texto** — quantas camadas quiser, cada uma com sua janela de tempo, tamanho
relativo à altura do quadro, faixa de fundo, contorno e alinhamento.

**Cor** — estilos prontos (Vívido, Cinema, P&B, Quente…) e ajuste fino de brilho,
contraste, saturação, sépia, preto e branco e desfoque.

**Áudio** — volume por clipe até 200%, mudo, fades de entrada e saída.

**Exportação** — MP4, MOV ou WebM; resolução, taxa de bits e fps ajustáveis; modo
de taxa constante para não ficar abaixo do piso exigido; e o arquivo final medido
de verdade antes de você baixar.

Atalhos: `espaço` toca/pausa · `S` divide · `←`/`→` avança 0,1 s (com `Shift`,
1 s) · `Delete` remove o clipe · `Ctrl/⌘+Z` desfaz.

## Como funciona a exportação

1. A linha do tempo vira uma lista de segmentos com tempo de entrada, saída e
   velocidade.
2. Para cada segmento, os quadros são pedidos ao decodificador nos timestamps
   exatos da origem (`VideoSampleSink.samplesAtTimestamps`).
3. Cada quadro é composto num canvas do tamanho da saída pela **mesma função que
   desenha o preview** (`src/lib/render.ts`) — o que você vê é o que sai.
4. O áudio de todos os clipes é montado num `OfflineAudioContext`, com velocidade,
   volume e fades aplicados, e entregue ao codificador em blocos de 1 segundo.
5. Vídeo e áudio são muxados em MP4 com `fastStart`, de forma que o arquivo começa
   a tocar sem precisar ser baixado inteiro.

## Compatibilidade

Precisa de WebCodecs: **Chrome, Edge e Opera atualizados; Safari 17+**. O Firefox
ainda não expõe `VideoEncoder`, e o app avisa em vez de falhar no meio.

Um detalhe que importa para o envio de criativo: MP4, para essas plataformas,
significa **H.264**. Alguns navegadores — Chromium no Linux sem codecs
proprietários, por exemplo — geram um MP4 válido mas com vídeo em VP9 ou AV1, que
pode ser recusado mesmo com a extensão correta. O app detecta isso antes de você
exportar e avisa, além de mostrar o codec real do arquivo gerado.

## Privacidade

O vídeo é lido por `BlobSource` a partir do arquivo local e nunca sai da máquina.
Não há upload, telemetria de conteúdo nem armazenamento remoto.
