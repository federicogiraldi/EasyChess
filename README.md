# ♞ EasyChess

App locale per imparare le aperture di scacchi linea per linea. Repertorio incluso:

- **Caro-Kann** (col Nero): 24 linee, corso di 9 lezioni;
- **Difesa Slava** (col Nero, contro 1.d4 e i sistemi come Londra e Colle): 15 linee, corso di 8 lezioni;
- **Gambetto di Donna Rifiutato** (col Nero, 2...e6 contro 1.d4 d5 2.c4): 11 linee, corso di 5 lezioni;
- **Sistema Londra** (col Bianco): 14 linee, corso di 7 lezioni;
- **Attacco Indiano di Re** (col Bianco, 1.Nf3 o da 1.e4 con d3): 13 linee, corso di 7 lezioni;
- **Gambetto di Donna** (col Bianco, 1.d4 d5 2.c4): 18 linee, corso di 6 lezioni;
- **Gambetto Scozzese** (col Bianco, 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Bc4): 10 linee, corso di 5 lezioni;
- **Attacco Fried Liver** (col Bianco, Due Cavalli con 4.Ng5): 9 linee, corso di 6 lezioni.

## Online

**https://federicogiraldi.github.io/EasyChess/** — funziona da qualsiasi dispositivo (PC, telefono, tablet), si può installare come app e dopo la prima visita funziona offline. Ogni merge su `main` viene testato e pubblicato automaticamente (`.github/workflows/deploy.yml`).

### Su iPhone e iPad

1. Apri **https://federicogiraldi.github.io/EasyChess/** in **Safari**.
2. Tocca **Condividi** (il quadrato con la freccia) → **Aggiungi alla schermata Home**.
3. Apri EasyChess dall'icona: è a schermo intero come un'app, e dopo la prima apertura funziona anche **offline** (Stockfish compreso).

L'interfaccia è adattata al touch: tocca un pezzo e poi la casa (oppure trascinalo), schede scorrevoli su iPhone, scacchiera che sta sempre nello schermo anche in orizzontale, margini per notch e barra Home. Su iPhone Stockfish analizza un po' meno in profondità per rispondere più in fretta e consumare meno batteria.

Per portare i progressi dal PC: **💾 Esporta progressi** sul PC → manda il file all'iPhone (AirDrop, iCloud Drive, mail) → **📂 Ripristina progressi** nell'app. Sull'iPhone/iPad "Esporta" apre il foglio di condivisione (Salva su File, AirDrop…). Nota: Safari e l'app sulla schermata Home hanno progressi separati, usa sempre l'icona.

I progressi sono salvati nel browser e sono separati per indirizzo: per portarli dalla versione locale a quella online (o tra dispositivi) usa **💾 Esporta progressi** e **📂 Ripristina progressi** in home.

## Avvio dal desktop

Doppio clic sul collegamento **EasyChess** sul desktop: apre la versione online in una **finestra dedicata** (modalità app di Chrome/Edge) in meno di un secondo. Non servono Node né un server, e dopo la prima apertura funziona anche **offline** grazie al service worker.

Per ricreare il collegamento (nuovo PC, collegamento cancellato): tasto destro su `scripts/crea-collegamento.ps1` → *Esegui con PowerShell*. In alternativa apri il sito in Chrome/Edge e scegli *Installa EasyChess* dal menu.

### Versione locale (per lo sviluppo)

Per provare aperture nuove prima di pubblicarle: `scripts/crea-collegamento.ps1 -Locale` crea **EasyChess (locale)**, che lancia `EasyChess.vbs` → `scripts/avvia.ps1`:
1. installa le dipendenze la prima volta (serve [Node.js](https://nodejs.org));
2. ricompila se hai aggiunto o modificato un'apertura (in questo caso l'avvio richiede 10-20 secondi);
3. avvia in background un server locale su `http://localhost:5317` (per fermarlo: `scripts/ferma.ps1`);
4. apre la finestra dedicata.

### App installabile e offline

EasyChess è una **PWA** (`vite-plugin-pwa`), come LearnWeb: un service worker mette in cache l'app e Stockfish (~7,5 MB), quindi funziona anche senza internet. Se vuoi, dalla finestra puoi anche installarla (menu del browser → *Installa EasyChess*) per averla nel menu Start con la sua icona.

**Modalità sviluppo:** `EasyChess.bat` (o `npm start`) avvia il server di sviluppo con ricaricamento automatico, nel browser normale.

## Modalità

| Modalità | Cosa fa |
|---|---|
| 🎓 **Corso** | Lezioni guidate passo per passo: spiegazioni, mosse da giocare tu sulla scacchiera e quiz. Se sbagli puoi chiedere "Perché?". A fine lezione puoi allenarti subito su quella linea. |
| 📖 **Esplora** | Navighi l'albero mossa per mossa (frecce ← →, clic sulle mosse o sulle linee a sinistra). Frecce verdi = mosse tue, arancioni = risposte avversarie. Commenti e idee chiave a destra. |
| ♟ **Allenamento** | Giochi tu le tue mosse, l'app risponde con le varie linee dell'avversario (preferendo quelle che conosci meno). Se sbagli ti mostra la mossa giusta e devi giocarla. Puoi limitarti a una sola linea dal menu. Se conosci già la risposta puoi fare la **pre-move** mentre l'avversario muove (anche nel Corso, nel Simulatore e nel Laboratorio); clic su una casa o tasto destro per annullarla. |
| 🔁 **Ripasso** | Ripetizione spaziata: ogni posizione in cui tocca a te è una "flashcard". Le risposte giuste allungano l'intervallo (1 → 3 → ~8 giorni…), gli errori la riportano in coda subito. 10 posizioni nuove per sessione. |
| ❓ **Quiz** | Posizioni a caso da tutto il repertorio: trova la mossa. |
| 🎮 **Simulatore** | Partita contro **Stockfish** al livello Elo che scegli (400–3000, come i bot di chess.com). Finché c'è teoria l'avversario segue il repertorio (una linea scelta o a caso, preferendo quelle che conosci meno); quando la linea finisce gioca l'engine. Ogni tua mossa riceve un'etichetta (📖 Libro, ★ Migliore, Buona, ?! Imprecisione, ? Errore, ?? Errore grave). Il **coach** suggerisce le mosse (💡: prima il pezzo, poi la freccia, con le 3 migliori e il perché; sulla scacchiera compaiono le **frecce** delle mosse consigliate come nell'engine di chess.com: blu scuro la migliore, poi più chiare, verdi quelle del repertorio) e puoi annullare o riprovare. A fine partita c'è la **revisione**: precisione tua e dell'avversario, conteggio per categoria, grafico della valutazione, momenti chiave con "Riprova da qui", PGN da copiare e storico delle partite. Da Esplora: **🎮 Gioca da qui**, e a fine linea i consigli di Stockfish per continuare. |
| 🔬 **Laboratorio** | Scacchiera libera con **Stockfish**: giochi qualsiasi mossa e ti dice quanto è buona e *perché* un'altra (quella del repertorio o la migliore dell'engine) sarebbe più valida. Può rispondere al posto dell'avversario. Ci arrivi anche da Esplora con "Prova altre mosse da qui". |

### 📊 Analisi delle tue partite

Dalla home, **Analizza le mie partite**:

- **Da chess.com**: scrivi il tuo nome utente e le partite pubbliche si caricano da sole, mese per mese (API pubblica di chess.com, serve internet).
- **Da PGN**: incolla il PGN o apri un file (anche con più partite). Dall'app di chess.com: apri la partita → **Condividi** → **PGN** → **Copia**, poi incolla.

Stockfish analizza ogni posizione: precisione tua e dell'avversario, mosse classificate (📖 Libro, ★ Migliore, Buona, ?!, ?, ??), grafico della valutazione, freccia con la mossa migliore, momenti chiave e "Perché … è peggio?" con la variante sulla scacchiera. Se la partita segue un'apertura del tuo repertorio ti dice chi ne è uscito e dove (e cosa prevedeva), con i pulsanti per aprire il Laboratorio o rigiocare da lì contro Stockfish. Le partite analizzate restano in un archivio (ultime 50).

In Allenamento, Ripasso, Quiz e Corso, quando sbagli compare il pulsante **🔬 Perché … è peggio?** con la stessa analisi.

Nella spiegazione, **♟ Mostra … sulla scacchiera** gioca sulla scacchiera tutta la variante consigliata (e **♟ Cosa succede dopo …** quella della tua mossa): la sequenza parte da sola, poi la scorri con ◀ ▶ (o le frecce della tastiera, o cliccando le mosse) e con **↩ Torna alla posizione** (o Esc) ritrovi la partita dove l'avevi lasciata. Funziona in tutte le modalità.

### 🧩 Problemi

Dalla home, **Risolvi problemi**: quasi 100.000 problemi di tattica senza limiti giornalieri, presi dal [database pubblico di Lichess](https://database.lichess.org/#puzzles) (licenza CC0) e inclusi nell'app, quindi funzionano anche offline.

- **🎯 Misti**: problemi vicini al tuo punteggio (parte da 1500 e si assesta in fretta nei primi problemi), con la difficoltà regolabile.
- **🏷 Per tema**: forchette, inchiodature, matti in 2, finali di torri…
- **🔁 Errori**: i problemi sbagliati tornano finché non li risolvi al primo colpo (non contano per il punteggio).

Il 💡 suggerimento evidenzia il pezzo da muovere (il problema non conta per il punteggio), 👀 mostra la soluzione, e dopo una mossa sbagliata Stockfish spiega perché era peggio. All'ultima mossa vale anche un matto diverso da quello previsto. La banca si rigenera con `scripts/build-puzzles.mjs` (istruzioni nel file).

### Come nascono le spiegazioni

Tutto gira offline. Nel Simulatore l'avversario usa un secondo Stockfish con la forza limitata (`UCI_Elo` da 1320 in su; sotto, Skill Level 0 e ogni tanto una mossa più debole scelta apposta), separato da quello che analizza a piena forza. La precisione usa la stessa formula di Lichess (perdita di probabilità di vittoria a ogni mossa). Stockfish 17 (versione "lite", dentro il browser) valuta le mosse con la **stessa profondità su qualsiasi dispositivo** (18 per spiegare una mossa, 16 per la revisione delle partite e la barra di valutazione): su telefono l'analisi richiede qualche secondo in più (una barra mostra l'avanzamento), ma la precisione è la stessa del PC; le spiegazioni sono ricavate da regole scacchistiche: materiale perso lungo la variante, pezzi lasciati in presa o minacce ignorate, arrocco perso, donna uscita troppo presto, pezzo mosso due volte, alfiere chiuso dai propri pedoni, spinte che indeboliscono il re, attacco al centro e alla base della catena. A questo si aggiunge il commento del repertorio sulla mossa giusta, e la risposta migliore dell'avversario viene spiegata (cosa attacca, cosa minaccia).

Sotto il commento di ogni mossa (Esplora, Allenamento, Ripasso, Quiz) c'è anche **🔍 Cosa fa questa mossa**: una spiegazione automatica che riconosce sviluppo e controllo del centro, catene di pedoni e rotture, inchiodature, attacchi doppi, pressione su f7/f2, sacrifici, colonne aperte, mosse profilattiche (h3/a3), fianchetti e preparazione dell'arrocco.

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
