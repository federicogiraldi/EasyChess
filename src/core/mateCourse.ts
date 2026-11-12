/**
 * Mini-corso "Come dare matto": Re + Donna e Re + Torre contro Re, senza fare stallo.
 * Ogni lezione è una serie di passi: spiegazione, quiz su una posizione, matto in una mossa,
 * e partite vere contro il Re nero (che si difende al meglio, vedi endgame.ts).
 */
import { Chess } from 'chess.js';
import type { Arrow, Highlight } from '../model/types';
import type { Piece } from './endgame';

const GREEN = 'rgba(21, 128, 61, 0.75)';
const RED = 'rgba(185, 28, 28, 0.75)';
const BLUE = 'rgba(37, 99, 235, 0.7)';
const BOX = 'rgba(37, 99, 235, 0.55)';

export type MateStep =
  | { kind: 'read'; text: string; fen: string; arrows?: Arrow[]; highlights?: Highlight[] }
  | {
      kind: 'quiz';
      text: string;
      fen: string;
      question: string;
      options: { text: string; correct?: boolean; explain: string }[];
      arrows?: Arrow[];
    }
  /** Trova il matto in una mossa (va bene qualunque matto). */
  | { kind: 'mate1'; text: string; fen: string }
  /** Gioca fino al matto contro il Re nero. `fen` fissa, oppure posizione casuale con matto tra min e max mosse. */
  | { kind: 'play'; text: string; piece: Piece; fen?: string; min?: number; max?: number };

export interface MateLesson {
  id: string;
  title: string;
  piece?: Piece;
  steps: MateStep[];
}

/** Riquadro di case (per disegnare la "scatola" in cui è chiuso il Re). */
function box(files: string, ranks: string, color = BOX): Highlight[] {
  const out: Highlight[] = [];
  for (const f of files) for (const r of ranks) out.push({ square: f + r, color });
  return out;
}

export const MATE_LESSONS: MateLesson[] = [
  {
    id: 'basi',
    title: 'Matto o stallo?',
    steps: [
      {
        kind: 'read',
        fen: 'k7/1Q6/1K6/8/8/8/8/8 b - - 0 1',
        highlights: [{ square: 'a8', color: RED }],
        text:
          "Il **matto** è quando il Re è sotto scacco e **non ha modo di salvarsi**: non può scappare, non può mangiare chi lo attacca e nessuno può mettersi in mezzo. Hai vinto!\n\nQui la Donna in b7 dà scacco al Re in a8. Il Re non può mangiarla perché è **protetta dal Re bianco**, e tutte le case vicine sono controllate. È matto.",
      },
      {
        kind: 'read',
        fen: 'k7/8/1QK5/8/8/8/8/8 b - - 0 1',
        highlights: [{ square: 'a8', color: BLUE }, { square: 'a7', color: RED }, { square: 'b7', color: RED }, { square: 'b8', color: RED }],
        text:
          "Lo **stallo** è la trappola dei principianti: il Re **non è sotto scacco**, ma tocca a lui e **non ha nessuna mossa legale**. La partita finisce **patta**, anche se hai un pezzo in più!\n\nQui il Nero deve muovere: a7, b7 e b8 sono controllate dalla Donna, ma il Re non è sotto scacco. Stallo: patta. Che peccato!\n\nRegola d'oro: **prima di ogni mossa chiediti \"dopo questa mossa, il Re nero può ancora muoversi?\"** Se non può e non è scacco, è stallo.",
      },
      {
        kind: 'quiz',
        fen: 'k7/1Q6/2K5/8/8/8/8/8 b - - 0 1',
        question: 'Tocca al Nero. Che cos\'è?',
        text: 'Guarda bene la posizione: tocca al Nero muovere.',
        options: [
          { text: 'Matto', correct: true, explain: 'Esatto: la Donna dà scacco e il Re non può mangiarla perché è protetta dal Re in c6.' },
          { text: 'Stallo', explain: 'No: il Re in a8 è sotto scacco della Donna in b7, quindi non può essere stallo.' },
          { text: 'Nessuno dei due', explain: 'Il Re è sotto scacco: può mangiare la Donna? No, la protegge il Re in c6. Può scappare? Prova a contare le case libere.' },
        ],
      },
      {
        kind: 'quiz',
        fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
        question: 'Tocca al Nero. Che cos\'è?',
        text: 'Un altro caso: tocca di nuovo al Nero.',
        options: [
          { text: 'Matto', explain: 'Il Re in h8 non è sotto scacco: la Donna in f7 non lo attacca. Senza scacco non c\'è matto.' },
          { text: 'Stallo', correct: true, explain: 'Proprio così: il Re non è sotto scacco ma g8, h7 e g7 sono tutte controllate. Stallo, patta!' },
          { text: 'Nessuno dei due', explain: 'Prova a cercare una casa libera per il Re: g8? h7? g7? Sono tutte attaccate.' },
        ],
      },
      {
        kind: 'quiz',
        fen: '7k/8/6K1/8/8/8/8/R7 b - - 0 1',
        question: 'Tocca al Nero. Che cos\'è?',
        text: 'Ultimo controllo.',
        options: [
          { text: 'Matto', explain: 'Il Re non è sotto scacco: la Torre in a1 non lo attacca.' },
          { text: 'Stallo', explain: 'Quasi! Ma il Re ha ancora una casa: g8 non è controllata da nessuno.' },
          { text: 'Nessuno dei due', correct: true, explain: 'Giusto: il Re può andare in g8. Il gioco continua.' },
        ],
        arrows: [],
      },
    ],
  },
  {
    id: 'donna-matti',
    title: 'Donna: i matti finali',
    piece: 'q',
    steps: [
      {
        kind: 'read',
        fen: '1k6/1Q6/1K6/8/8/8/8/8 b - - 0 1',
        highlights: [{ square: 'b8', color: RED }],
        text:
          'Con la Donna si dà matto **spingendo il Re nemico sul bordo** della scacchiera. Lì ha meno case per scappare.\n\nLa Donna **da sola non basta**: serve l\'aiuto del tuo Re, che protegge la Donna o controlla le case di fuga. Ecco due matti tipici:\n\n- la Donna davanti al Re nemico, protetta dal tuo Re (come qui);\n- la Donna sul bordo, mentre il tuo Re sta di fronte al Re nemico e gli toglie le case davanti.',
      },
      {
        kind: 'mate1',
        fen: '1k6/8/1K6/8/8/8/8/7Q w - - 0 1',
        text: 'Il tuo Re in b6 toglie al Re nero le case a7, b7 e c7. **Dai matto in una mossa.**',
      },
      {
        kind: 'mate1',
        fen: '4k3/8/4K3/8/8/8/8/Q7 w - - 0 1',
        text: 'I due Re sono uno di fronte all\'altro. **Dai matto in una mossa** usando il bordo.',
      },
      {
        kind: 'mate1',
        fen: 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1',
        text: 'Attenzione, qui c\'è una **trappola di stallo**! Una mossa che sembra fortissima lascia il Re nero senza mosse ma senza scacco. **Trova il matto vero.**',
      },
      {
        kind: 'mate1',
        fen: '7k/8/5K2/8/8/8/6Q1/8 w - - 0 1',
        text: 'Ancora una trappola: **matto in una**, senza fare stallo.',
      },
    ],
  },
  {
    id: 'donna-metodo',
    title: 'Donna: chiudi il Re nella scatola',
    piece: 'q',
    steps: [
      {
        kind: 'read',
        fen: '8/8/8/4k3/8/3Q4/8/4K3 w - - 0 1',
        highlights: [{ square: 'd3', color: GREEN }, ...box('efgh', '45678').filter((h) => !['f5', 'g6', 'h7', 'e4'].includes(h.square))],
        arrows: [{ from: 'e5', to: 'd3', color: GREEN }],
        text:
          'Il metodo più semplice è la **mossa del cavallo**: metti la Donna **a un salto di cavallo** dal Re nemico (qui d3 rispetto a e5).\n\nCosì il Re resta chiuso in una **scatola** (le case in blu) e non può mai avvicinarsi alla Donna.\n\nOgni volta che il Re si muove, **sposta la Donna e rimettila a un salto di cavallo**: la scatola si rimpicciolisce finché il Re finisce sul bordo.',
      },
      {
        kind: 'read',
        fen: '7k/8/8/6Q1/8/8/8/4K3 w - - 0 1',
        highlights: [{ square: 'h8', color: BLUE }, { square: 'h7', color: BLUE }, { square: 'g8', color: RED }],
        text:
          'Quando il Re nemico è nell\'angolo o sul bordo **fermati con la Donna!** Se continui a stringerlo rischi lo **stallo** (prova a immaginare la Donna in g6: il Re non avrebbe più mosse).\n\nOra la Donna lo tiene fermo da sola: è il momento di **portare il tuo Re** vicino. Solo quando il Re arriva si dà matto.\n\nRicapitolando:\n\n- Donna a salto di cavallo, il Re nemico va verso il bordo;\n- arrivato al bordo, lasciagli **sempre almeno due case** per muoversi;\n- porta il tuo Re vicino;\n- matto (con la Donna protetta dal Re, o sul bordo con i Re di fronte).',
      },
      {
        kind: 'play',
        piece: 'q',
        fen: '7k/8/8/6Q1/8/8/8/4K3 w - - 0 1',
        text: 'Proviamo dalla posizione di prima: **porta il Re e dai matto**, senza fare stallo. Il contatore ti dice quante mosse mancano al matto con il gioco perfetto: se scende, stai andando bene.',
      },
      {
        kind: 'play',
        piece: 'q',
        min: 6,
        max: 10,
        text: 'Ora una partita vera: il Re nero è al centro e si difende al meglio. **Chiudilo nella scatola e dai matto.** Se ti blocchi, usa 💡 Suggerimento.',
      },
    ],
  },
  {
    id: 'torre-matti',
    title: 'Torre: i matti finali',
    piece: 'r',
    steps: [
      {
        kind: 'read',
        fen: '3k3R/8/3K4/8/8/8/8/8 b - - 0 1',
        highlights: [{ square: 'd8', color: RED }, { square: 'd6', color: GREEN }],
        text:
          'La Torre è meno forte della Donna, ma basta lo stesso. Il matto con la Torre è quasi sempre così:\n\n- il Re nemico è **sul bordo**;\n- il tuo Re gli sta **di fronte** (stessa colonna, una casa in mezzo): si dice **opposizione**, e gli toglie le tre case davanti;\n- la Torre dà scacco **lungo il bordo**.',
      },
      {
        kind: 'mate1',
        fen: '3k4/8/3K4/8/8/8/8/7R w - - 0 1',
        text: 'I Re sono in opposizione. **Dai matto in una mossa.**',
      },
      {
        kind: 'mate1',
        fen: '6k1/8/6K1/8/8/8/8/R7 w - - 0 1',
        text: '**Matto in una mossa.**',
      },
      {
        kind: 'mate1',
        fen: 'k7/2K5/8/8/8/8/8/1R6 w - - 0 1',
        text: 'Il Re nero è nell\'angolo. Attento allo **stallo**: **dai matto in una mossa.**',
      },
      {
        kind: 'quiz',
        fen: '2k5/8/3K4/8/8/8/8/7R w - - 0 1',
        arrows: [{ from: 'h1', to: 'h8', color: RED }, { from: 'c8', to: 'b7', color: BLUE }],
        question: 'Perché qui Th8+ non è matto?',
        text: 'Il Re nero è in c8 e il tuo in d6: **non sono uno di fronte all\'altro**.',
        options: [
          { text: 'Perché il Re nero scappa in b7', correct: true, explain: 'Esatto: senza opposizione il tuo Re non controlla b7, e il Re nero esce. Per il matto con la Torre i Re devono stare uno di fronte all\'altro.' },
          { text: 'Perché il Re nero mangia la Torre', explain: 'No: la Torre in h8 è lontana dal Re nero.' },
          { text: 'Perché è stallo', explain: 'No: dopo Th8+ il Re è sotto scacco, quindi non è stallo. Il problema è un altro: dove può andare?' },
        ],
      },
    ],
  },
  {
    id: 'torre-metodo',
    title: 'Torre: la scatola e l\'opposizione',
    piece: 'r',
    steps: [
      {
        kind: 'read',
        fen: '8/8/8/3k4/8/8/2R5/4K3 w - - 0 1',
        highlights: [{ square: 'c2', color: GREEN }, ...box('defgh', '345678')],
        text:
          'Anche con la Torre si costruisce una **scatola**: la Torre taglia una colonna (o una traversa) e il Re nemico non può attraversarla. Qui la Torre in c2 lo chiude nelle colonne d-h e sopra la seconda traversa.\n\nIl metodo, passo per passo:\n\n- **taglia** il Re con la Torre;\n- **avvicina il tuo Re** (la Torre da sola non può spingerlo);\n- quando i Re sono **in opposizione**, dai scacco con la Torre: il Re nemico deve arretrare di una fila;\n- se il Re nemico **attacca la Torre**, allontanala sulla stessa linea (dall\'altra parte della scacchiera);\n- se non hai una buona mossa di Re, fai una **mossa d\'attesa** con la Torre, restando sulla sua linea.',
      },
      {
        kind: 'play',
        piece: 'r',
        fen: '3k4/8/4K3/8/8/8/8/7R w - - 0 1',
        text: 'Il Re nero è già sul bordo, ma i Re **non sono in opposizione**: se dai scacco ora, scappa. Trova una **mossa d\'attesa** e dai matto.',
      },
      {
        kind: 'play',
        piece: 'r',
        min: 4,
        max: 7,
        text: 'Ora spingilo tu verso il bordo e dai matto. Se il contatore sale, hai perso un po\' di tempo: nessun problema, continua col metodo.',
      },
      {
        kind: 'play',
        piece: 'r',
        min: 11,
        max: 16,
        text: 'La prova finale: il Re nero è al centro e si difende al meglio. **Dai matto con la Torre.** Ricorda: hai 50 mosse prima che la partita sia patta.',
      },
    ],
  },
  {
    id: 'pratica',
    title: 'Allenamento libero',
    steps: [
      {
        kind: 'play',
        piece: 'q',
        min: 7,
        max: 10,
        text: '**Matto con la Donna** da una posizione casuale. Prova a dare matto senza suggerimenti e vicino al numero di mosse perfetto.',
      },
      {
        kind: 'play',
        piece: 'r',
        min: 10,
        max: 16,
        text: '**Matto con la Torre** da una posizione casuale. Prova a dare matto senza suggerimenti e vicino al numero di mosse perfetto.',
      },
    ],
  },
];

/** Controlla che le posizioni del corso siano legali e coerenti (usato nei test). */
export function checkLessons(): string[] {
  const errors: string[] = [];
  for (const l of MATE_LESSONS)
    l.steps.forEach((s, i) => {
      if (!('fen' in s) || !s.fen) return;
      try {
        new Chess(s.fen);
      } catch (e) {
        errors.push(`${l.id}#${i}: ${e instanceof Error ? e.message : e}`);
      }
    });
  return errors;
}
