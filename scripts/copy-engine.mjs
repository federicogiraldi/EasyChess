// Copia Stockfish in public/, dove il browser lo carica come Web Worker:
// - public/engine: build "lite single-threaded" (~7 MB, nel repository e nella cache offline);
// - public/engine-full: build completa single-threaded (~80 MB in 6 parti), per la precisione "Massima".
//   Non è nel repository (.gitignore): si rigenera a ogni npm install / npm ci, anche nella build di GitHub Pages.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const src = 'node_modules/stockfish/src';
const files = readdirSync(src);

const lite = files.find((f) => /^stockfish-.*-lite-single-.*\.js$/.test(f));
if (!lite) throw new Error('Build lite-single di Stockfish non trovata in ' + src);
mkdirSync('public/engine', { recursive: true });
copyFileSync(join(src, lite), 'public/engine/stockfish.js');
copyFileSync(join(src, lite.replace(/\.js$/, '.wasm')), 'public/engine/stockfish.wasm');
copyFileSync('node_modules/stockfish/Copying.txt', 'public/engine/COPYING-stockfish.txt');

const full = files.find((f) => /^stockfish-[\d.]+-single-[0-9a-f]+\.js$/.test(f));
if (!full) throw new Error('Build completa single di Stockfish non trovata in ' + src);
mkdirSync('public/engine-full', { recursive: true });
copyFileSync(join(src, full), 'public/engine-full/stockfish.js');
const base = full.replace(/\.js$/, '');
const parts = files.filter((f) => f.startsWith(base + '-part-'));
for (const p of parts) copyFileSync(join(src, p), join('public/engine-full', p.replace(base, 'stockfish')));
copyFileSync('node_modules/stockfish/Copying.txt', 'public/engine-full/COPYING-stockfish.txt');

console.log(`Stockfish copiato in public/engine (${lite}) e public/engine-full (${full}, ${parts.length} parti)`);
