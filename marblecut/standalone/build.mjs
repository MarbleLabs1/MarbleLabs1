/**
 * Empacota o editor num único arquivo HTML, sem nenhuma dependência externa.
 *
 * O app já roda inteiro no cliente, então não há nada de servidor a perder:
 * CSS e JS são embutidos inline e o resultado abre por file://, por um pendrive
 * ou por qualquer hospedagem estática.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const run = promisify(execFile);
const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = `${ROOT}dist-standalone/`;
const OUT_FILE = `${OUT_DIR}marblecut.html`;
const FRAGMENT_FILE = `${OUT_DIR}marblecut.fragment.html`;

/** Impede que um `</script>` dentro de uma string do bundle encerre a tag. */
function escapeForInlineTag(code) {
  return code.replace(/<\/(script|style)/gi, '<\\/$1');
}

await mkdir(OUT_DIR, { recursive: true });

console.log('· compilando CSS…');
await run('npx', [
  '@tailwindcss/cli',
  '--input',
  `${ROOT}standalone/styles.css`,
  '--output',
  `${OUT_DIR}styles.css`,
  '--minify',
]);

console.log('· empacotando JS…');
await build({
  entryPoints: [`${ROOT}standalone/main.tsx`],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  jsx: 'automatic',
  outfile: `${OUT_DIR}bundle.js`,
  tsconfig: `${ROOT}tsconfig.json`,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

const [css, js] = await Promise.all([
  readFile(`${OUT_DIR}styles.css`, 'utf8'),
  readFile(`${OUT_DIR}bundle.js`, 'utf8'),
]);

const inlineCss = `<style>${escapeForInlineTag(css)}</style>`;
const inlineJs = `<script>${escapeForInlineTag(js)}</script>`;
const body = `<div id="root"></div>`;

// Documento completo: é o que abre por file://, pendrive ou hospedagem estática.
// O charset é obrigatório aqui — sem ele os acentos da interface quebram.
const standalone = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#08090c" />
<meta name="description" content="Editor de vídeo que roda no navegador: corta, enquadra em 9:16 e exporta MP4. O vídeo não sai do seu aparelho." />
<title>MarbleCut — Editor de vídeo online</title>
${inlineCss}
</head>
<body>
${body}
${inlineJs}
</body>
</html>
`;

// Fragmento: hospedagens que já fornecem o esqueleto do documento injetam só
// isto, então doctype/html/head/body seriam duplicados.
const fragment = `<title>MarbleCut — Editor de vídeo online</title>
${inlineCss}
${body}
${inlineJs}
`;

await writeFile(OUT_FILE, standalone);
await writeFile(FRAGMENT_FILE, fragment);

for (const file of [OUT_FILE, FRAGMENT_FILE]) {
  const { size } = await stat(file);
  console.log(`✓ ${file} — ${(size / 1024 / 1024).toFixed(2)} MB`);
}
