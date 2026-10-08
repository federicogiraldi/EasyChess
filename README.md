# ♞ EasyChess

App locale per imparare le aperture di scacchi linea per linea. Repertorio incluso:

- **Caro-Kann** (col Nero): 24 linee, corso di 9 lezioni;
- **Sistema Londra** (col Bianco): 14 linee, corso di 7 lezioni.
- **Attacco Indiano di Re** (col Bianco, 1.Nf3 o da 1.e4 con d3): 13 linee, corso di 7 lezioni.

## Avvio

Doppio clic sul collegamento **EasyChess** sul desktop: l'app si apre in una **finestra dedicata** (modalità app di Chrome/Edge, senza barra degli indirizzi), senza finestre nere.

Il collegamento lancia `EasyChess.vbs` → `scripts/avvia.ps1`, che:
1. installa le dipendenze la prima volta (serve [Node.js](https://nodejs.org));
2. ricompila da solo se hai aggiunto o modificato un'apertura;
3. avvia in background un piccolo server locale su `http://localhost:5317` (resta attivo, è leggerissimo; per fermarlo: `scripts/ferma.ps1`);
4. apre la finestra con il tuo browser predefinito se è Chrome, altrimenti con Edge.

Per ricreare il collegamento (nuovo PC, collegamento cancellato): tasto destro su `scripts/crea-collegamento.ps1` → *Esegui con PowerShell*. Le icone si rigenerano con `scripts/genera-icone.ps1`.

### App installabile e offline

EasyChess è una **PWA** (`vite-plugin-pwa`), come LearnWeb: un service worker mette in cache l'app e Stockfish (~7,5 MB), quindi funziona anche senza internet. Se vuoi, dalla finestra puoi anche installarla (menu del browser → *Installa EasyChess*) per averla nel menu Start con la sua icona.

**Modalità sviluppo:** `EasyChess.bat` (o `npm start`) avvia il server di sviluppo con ricaricamento automatico, nel browser normale.

## Modalità

| Modalità | Cosa fa |
|---|---|
| 🎓 **Corso** | Lezioni guidate passo per passo: spiegazioni, mosse da giocare tu sulla scacchiera e quiz. Se sbagli puoi chiedere "Perché?". A fine lezione puoi allenarti subito su quella linea. |
| 📖 **Esplora** | Navighi l'albero mossa per mossa (frecce ← →, clic sulle mosse o sulle linee a sinistra). Frecce verdi = mosse tue, arancioni = risposte avversarie. Commenti e idee chiave a destra. |
| ♟ **Allenamento** | Giochi tu le tue mosse, l'app risponde con le varie linee dell'avversario (preferendo quelle che conosci meno). Se sbagli ti mostra la mossa giusta e devi giocarla. Puoi limitarti a una sola linea dal menu. |
| 🔁 **Ripasso** | Ripetizione spaziata: ogni posizione in cui tocca a te è una "flashcard". Le risposte giuste allungano l'intervallo (1 → 3 → ~8 giorni…), gli errori la riportano in coda subito. 10 posizioni nuove per sessione. |
| ❓ **Quiz** | Posizioni a caso da tutto il repertorio: trova la mossa. |
| 🔬 **Laboratorio** | Scacchiera libera con **Stockfish**: giochi qualsiasi mossa e ti dice quanto è buona e *perché* un'altra (quella del repertorio o la migliore dell'engine) sarebbe più valida. Può rispondere al posto dell'avversario. Ci arrivi anche da Esplora con "Prova altre mosse da qui". |

In Allenamento, Ripasso, Quiz e Corso, quando sbagli compare il pulsante **🔬 Perché … è peggio?** con la stessa analisi.

### Come nascono le spiegazioni

Tutto gira offline. Stockfish 17 (versione "lite", dentro il browser) valuta le mosse; le spiegazioni sono ricavate da regole scacchistiche: materiale perso lungo la variante, pezzi lasciati in presa o minacce ignorate, arrocco perso, donna uscita troppo presto, pezzo mosso due volte, alfiere chiuso dai propri pedoni, spinte che indeboliscono il re, attacco al centro e alla base della catena. A questo si aggiunge il commento del repertorio sulla mossa giusta.

Allenamento, Ripasso e Quiz aggiornano tutti gli stessi progressi (salvati nel browser). Dalla home puoi **esportare/ripristinare i progressi** in un file JSON.

## Aggiungere un'apertura

Ogni apertura è **un file `.pgn` in `src/openings/`**: l'app lo trova da sola, senza toccare il codice.

1. Crea il file, es. `src/openings/londra.pgn`, con questi header:
   ```
   [Opening "Sistema Londra"]
   [Id "londra"]
   [Color "white"]
   [Description "Sistema solido per il Bianco con d4, Bf4, e3, c3."]
   ```
   `Color` è il colore con cui **tu** giochi l'apertura (`white` o `black`).
2. Scrivi le linee in PGN. Due modi, anche mescolati:
   - **varianti annidate**: `1. d4 d5 2. Bf4 Nf6 (2... c5 3. e3) 3. e3 *`
   - **una linea per "partita"**, separate da `*`: le mosse in comune vengono fuse automaticamente.
3. Esegui `npm run validate`: controlla che tutte le mosse siano legali e ti dice esattamente dove c'è un errore. (Anche l'app mostra un riquadro rosso per un file non valido.)

Ricarica la pagina e la nuova apertura compare in home.

**Scorciatoia:** crea uno *Studio* su Lichess, esportalo in PGN (Condividi → Scarica PGN) e salvalo in `src/openings/`. Ogni capitolo diventa una linea con il suo nome, e il colore viene preso dall'orientamento dello studio. In alternativa usa **➕ Importa apertura** dalla home (resta salvata solo in quel browser).

### Comandi nei commenti

Dentro un commento `{ ... }` puoi usare:

| Comando | Effetto |
|---|---|
| `[%line Variante d'Avanzata]` | Dà un nome alla linea che parte da questa mossa (compare nell'albero e nel menu dell'Allenamento) |
| `[%key Spinta di rottura ...c5]` | Aggiunge un'idea chiave (💡) mostrata sotto il commento |
| `[%cal Gc7c5,Rd5e4]` | Frecce (G verde, R rosso, Y giallo, B blu) — stesso formato di Lichess |
| `[%csl Gd5]` | Evidenzia una casa |

Il resto del testo del commento è la spiegazione mostrata in Esplora e dopo ogni mossa in Allenamento.

Le **trasposizioni** sono gestite da sole: se una linea finisce in una posizione che esiste altrove nell'albero (es. `2.Nc3 d5 3.d4` = `2.d4 d5 3.Nc3`), l'app prosegue da lì.

## Scrivere un corso guidato

Accanto al PGN crea `src/openings/<stesso-nome>.course.md` (es. `londra.course.md`). Formato:

```
# Titolo della lezione
line: Nome di una linea del PGN       (facoltativo: "Allenati su questa linea")

Testo del primo passo, con **grassetto**, *corsivo* ed elenchi:
- punto uno
- punto due
moves: 1. d4 d5 2. Bf4                (posizione da mostrare, dall'inizio)
arrows: Gc2c4, Re7e5                  (frecce G/R/Y/B)
marks: Gd5                            (case evidenziate)

---
play: 2... Nf6 3. e3 c5               (le mosse del tuo colore le giochi tu, le altre sono automatiche)
Testo che spiega cosa fare.

---
quiz: Domanda?
* risposta giusta | spiegazione
- risposta sbagliata | spiegazione
```

Le note tra parentesi a destra servono solo a spiegare: non vanno scritte nel file. `---` separa i passi; ogni passo parte dalla posizione in cui è finito il precedente (salvo `moves:`). Anche i corsi sono controllati da `npm run validate`.

## Per sviluppatori

```
src/
  openings/        file .pgn + loader (import.meta.glob) + test di validazione
  core/            pgnToTree (parser PGN con varianti), course (parser corsi), tree, srs, progress, training
  engine/          stockfish (worker UCI), judge (valutazione mosse), reasons (spiegazioni a regole)
  modes/           Course, Explore, Drill, Review, Quiz (PositionTrainer), Lab
  components/      Board (react-chessboard), MoveList, CommentPanel, LineTree, OpeningPicker
```

- `npm test` — test di parser, albero, SRS e validazione delle aperture
- `npm run typecheck` — controllo dei tipi TypeScript
- Stockfish viene copiato da `node_modules/stockfish` in `public/engine/` a ogni `npm install` (`scripts/copy-engine.mjs`). Licenza GPL: vedi `public/engine/COPYING-stockfish.txt`.
