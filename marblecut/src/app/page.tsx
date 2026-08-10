'use client';

import { useEffect, useState } from 'react';
import { useEditor } from '@/lib/store';
import { Dropzone } from '@/components/Dropzone';
import { Editor } from '@/components/Editor';

/** Recursos sem os quais o editor não consegue decodificar nem exportar. */
function missingSupport(): string | null {
  if (typeof window === 'undefined') return null;
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    return 'Este navegador não tem suporte a WebCodecs, necessário para editar e exportar vídeo. Abra pelo Chrome, Edge ou Opera atualizados (no iPhone, o Safari 17+ também funciona).';
  }
  return null;
}

export default function Page() {
  const hasProject = useEditor((s) => s.source !== null);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUnsupported(missingSupport());
    setMounted(true);
  }, []);

  // O primeiro render precisa bater com o HTML do servidor; a checagem de
  // suporte só existe no navegador.
  if (!mounted) return null;

  if (unsupported) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold text-ink-100">Navegador sem suporte</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">{unsupported}</p>
      </main>
    );
  }

  return hasProject ? <Editor /> : <Dropzone />;
}
