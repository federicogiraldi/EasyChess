// Copia Stockfish (build "lite single-threaded") in public/engine, dove il browser lo carica come Web Worker.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const src = 'node_modules/stockfish/src';
const dest = 'public/engine';
const files = readdirSync(src);
const js = files.find((f) => /^stockfish-.*-lite-single-.*\.js$/.test(f));
if (!js) throw new Error('Build lite-single di Stockfish non trovata in ' + src);

mkdirSync(dest, { recursive: true });
copyFileSync(join(src, js), join(dest, 'stockfish.js'));
copyFileSync(join(src, js.replace(/\.js$/, '.wasm')), join(dest, 'stockfish.wasm'));
copyFileSync('node_modules/stockfish/Copying.txt', join(dest, 'COPYING-stockfish.txt'));
console.log(`Stockfish copiato in ${dest} (${js})`);
