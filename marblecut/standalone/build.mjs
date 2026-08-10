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

const html = `<title>MarbleCut — Editor de vídeo online</title>
<style>${escapeForInlineTag(css)}</style>
<div id="root"></div>
<script>${escapeForInlineTag(js)}</script>
`;

await writeFile(OUT_FILE, html);
const { size } = await stat(OUT_FILE);
console.log(`✓ ${OUT_FILE} — ${(size / 1024 / 1024).toFixed(2)} MB`);
