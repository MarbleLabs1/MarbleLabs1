import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MarbleCut — Editor de vídeo online',
  description:
    'Corte, enquadre em 9:16, escreva por cima e exporte em MP4 direto no navegador. O vídeo nunca sai do seu aparelho.',
};

export const viewport: Viewport = {
  themeColor: '#08090c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
