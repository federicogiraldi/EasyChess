// Costruisce la banca problemi in public/puzzles/ partendo dal database pubblico di Lichess (licenza CC0).
// Uso (Python 3.14+ ha zstd di serie; quello di Node si ferma al primo frame del file):
//   curl -s https://database.lichess.org/lichess_db_puzzle.csv.zst \
//     | python -c "import sys, shutil; from compression import zstd; shutil.copyfileobj(zstd.ZstdFile(sys.stdin.buffer), sys.stdout.buffer)" \
//     | node scripts/build-puzzles.mjs [totale=100000]
// Il file (~300 MB compressi) viene letto in streaming: non resta niente su disco a parte il risultato.
import { createInterface } from 'node:readline';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const TOTAL = Number(process.argv[2] ?? 100000);
const OUT = new URL('../public/puzzles/', import.meta.url);

// Fasce di punteggio da 100 punti: sotto 600 e da 2800 in su finiscono nelle fasce estreme.
const MIN = 600;
const MAX = 2800;
const bucketOf = (r) => Math.max(MIN - 100, Math.min(MAX, Math.floor(r / 100) * 100));
const BUCKETS = [];
for (let b = MIN - 100; b <= MAX; b += 100) BUCKETS.push(b);
const PER_BUCKET = Math.ceil(TOTAL / BUCKETS.length);

// Solo problemi collaudati: votati bene, giocati da molti, con un punteggio stabile.
const good = (f) => Number(f.popularity) >= 80 && Number(f.plays) >= 300 && Number(f.deviation) <= 90;

// Temi che non aiutano a scegliere (lunghezza, livello dei giocatori originali).
const SKIP_THEMES = new Set(['master', 'masterVsMaster', 'superGM', 'short', 'long', 'veryLong', 'oneMove']);

// Campionamento a "serbatoio" con seme fisso: lo stesso database produce sempre la stessa banca.
let seed = 20261109;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const reservoirs = new Map(BUCKETS.map((b) => [b, { seen: 0, items: [] }]));

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

let n = 0;
for await (const line of lines) {
  if (n++ === 0) continue; // intestazione
  if (n % 500000 === 0) console.log(`${n} righe lette…`);
  const [id, fen, moves, rating, deviation, popularity, plays, themes] = line.split(',');
  if (!good({ deviation, popularity, plays })) continue;
  const r = reservoirs.get(bucketOf(Number(rating)));
  r.seen++;
  const item = { id, fen, moves, rating: Number(rating), themes: themes.split(' ').filter((t) => t && !SKIP_THEMES.has(t)) };
  if (r.items.length < PER_BUCKET) r.items.push(item);
  else {
    const j = Math.floor(rand() * r.seen);
    if (j < PER_BUCKET) r.items[j] = item;
  }
}

const kept = [...reservoirs.values()].reduce((s, r) => s + r.items.length, 0);
if (kept < TOTAL * 0.9) throw new Error(`solo ${kept} problemi raccolti: banca non aggiornata`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const themeIndex = new Map();
const themeCode = (t) => {
  if (!themeIndex.has(t)) themeIndex.set(t, themeIndex.size);
  return themeIndex.get(t).toString(36);
};

const buckets = [];
for (const b of BUCKETS) {
  const items = reservoirs.get(b).items.sort((x, y) => x.rating - y.rating);
  // Una riga per problema: id, FEN, mosse UCI, punteggio, temi (indici base 36 separati da punto).
  const text = items.map((p) => [p.id, p.fen, p.moves, p.rating, p.themes.map(themeCode).join('.')].join('\t')).join('\n');
  writeFileSync(new URL(`p${b}.txt`, OUT), text + '\n');
  buckets.push({ rating: b, count: items.length });
  console.log(`fascia ${b}: ${items.length} problemi (su ${reservoirs.get(b).seen} idonei)`);
}

const themeCounts = {};
for (const b of BUCKETS) for (const p of reservoirs.get(b).items) for (const t of p.themes) themeCounts[t] = (themeCounts[t] ?? 0) + 1;
writeFileSync(
  new URL('index.json', OUT),
  JSON.stringify({ source: 'Lichess puzzle database (CC0)', built: new Date().toISOString().slice(0, 10), buckets, themes: [...themeIndex.keys()], themeCounts }),
);
console.log(`Fatto: ${buckets.reduce((s, b) => s + b.count, 0)} problemi.`);
