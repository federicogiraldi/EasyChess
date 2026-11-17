/**
 * Corso sui finali oltre i matti di base: Re e pedone contro Re (quadrato, opposizione, case chiave,
 * difesa, pedone di Torre) e i due finali di Torre da sapere: Lucena (vincere) e Philidor (pattare).
 * Le posizioni di Re e pedone si giocano contro la tabella esatta (kpk.ts); le linee di Torre sono
 * controllate con Stockfish e si giocano a memoria.
 */
import type { Highlight } from '../model/types';
import type { MateCourseDef, MateLesson } from './mateCourse';

const GREEN = 'rgba(21, 128, 61, 0.75)';
const RED = 'rgba(185, 28, 28, 0.75)';
const BLUE = 'rgba(37, 99, 235, 0.7)';
const AREA = 'rgba(37, 99, 235, 0.35)';
const KEY = 'rgba(21, 128, 61, 0.45)';

function area(files: string, ranks: string, color = AREA): Highlight[] {
  const out: Highlight[] = [];
  for (const f of files) for (const r of ranks) out.push({ square: f + r, color });
  return out;
}

export const ENDGAME_LESSONS: MateLesson[] = [
  {
    id: 'quadrato',
    title: 'La regola del quadrato',
    icon: 'pawn',
    steps: [
      {
        kind: 'read',
        fen: '7K/8/8/8/P7/8/8/4k3 b - - 0 1',
        orientation: 'black',
        highlights: area('abcde', '45678'),
        text:
          'Un pedone corre verso la promozione e il suo Re è lontano: il Re nemico riesce a prenderlo? Non serve contare le mosse, basta il **quadrato**.\n\nDisegna un quadrato che ha come lato la strada del pedone fino alla promozione: qui da a4 ad a8, cioè cinque case, quindi il quadrato va da a4 a e8.\n\n- Se il Re nemico **può entrare nel quadrato** con la sua mossa, prende il pedone;\n- se **resta fuori**, il pedone promuove.\n\nQui tocca al Nero: dal e1 non può entrare nel quadrato (la casa più vicina, d2 o e2, è ancora sotto). Il pedone promuove.',
      },
      {
        kind: 'quiz',
        fen: '7K/8/8/8/P7/8/5k2/8 b - - 0 1',
        orientation: 'black',
        highlights: area('abcde', '45678'),
        question: 'Tocca al Nero. Il Re riesce a prendere il pedone?',
        text: 'Il Re nero è in f2. Il quadrato del pedone va da a4 a e8.',
        options: [
          { text: 'No: il pedone promuove', correct: true, explain: 'Esatto: dopo ...Ke3 il Re è ancora fuori dal quadrato (sotto la quarta traversa) e il pedone corre più veloce.' },
          { text: 'Sì: con ...Ke3 entra nel quadrato', explain: 'No: e3 è sulla terza traversa, il quadrato parte dalla quarta. Il Re resta fuori.' },
          { text: 'Dipende da dove va il Re bianco', explain: 'Il Re bianco è in h8, troppo lontano per aiutare o per disturbare: decide solo il quadrato.' },
        ],
      },
      {
        kind: 'kpk',
        fen: '7K/8/8/8/P7/4k3/8/8 b - - 0 1',
        goal: 'draw',
        moves: 6,
        text: 'Ora il Re nero è in e3: **entra nel quadrato e prendi il pedone.** Giochi tu col Nero.',
      },
    ],
  },
  {
    id: 'opposizione',
    title: "L'opposizione",
    icon: 'king',
    steps: [
      {
        kind: 'read',
        fen: '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1',
        highlights: [{ square: 'e5', color: RED }, { square: 'e4', color: BLUE }, { square: 'e6', color: BLUE }],
        text:
          "Nei finali di Re e pedone i Re si fronteggiano spesso così: **sulla stessa colonna, con una casa in mezzo**. Nessuno dei due può avanzare, perché la casa in mezzo è controllata da entrambi.\n\nChi deve muovere è costretto a **cedere il passo**: si dice che l'altro **ha l'opposizione**.\n\nQui tocca al Nero: il Bianco ha l'opposizione. Il Re nero deve spostarsi di lato e il Re bianco passa avanti.",
      },
      {
        kind: 'quiz',
        fen: '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1',
        question: 'Stessa posizione, ma tocca al Bianco. Come finisce con il gioco perfetto?',
        text: 'Ora è il Bianco a dover muovere.',
        options: [
          { text: 'Patta', correct: true, explain: 'Esatto: ora l\'opposizione ce l\'ha il Nero. Il Re bianco non riesce a passare e il pedone da solo non basta.' },
          { text: 'Vince il Bianco', explain: 'No: con il tratto il Bianco perde l\'opposizione. Il Nero tiene il suo Re davanti al pedone e patta.' },
          { text: 'Vince il Nero', explain: 'Il Nero non ha pedoni: al massimo può pattare.' },
        ],
      },
      {
        kind: 'kpk',
        fen: '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1',
        goal: 'win',
        text: 'Tocca al Nero, quindi l\'opposizione è tua. **Vinci col Bianco: porta il Re avanti e promuovi.** Quando i Re si fronteggiano, fai in modo che sia il Nero a dover muovere.',
      },
      {
        kind: 'quiz',
        fen: '4k3/4P3/4K3/8/8/8/8/8 b - - 0 1',
        question: 'Tocca al Nero. Che cosa succede?',
        text: 'Il pedone è in settima, il Re nero lo blocca e il Re bianco lo protegge.',
        options: [
          { text: 'Stallo: è patta', correct: true, explain: 'Esatto: il Re nero non è sotto scacco ma non ha mosse. Per questo il Re bianco deve arrivare **davanti** al pedone, non dietro.' },
          { text: 'Il Nero perde', explain: 'Il Nero non ha mosse ma non è sotto scacco: è stallo, quindi patta.' },
          { text: 'Il Nero mangia il pedone', explain: 'No: il pedone è protetto dal Re bianco.' },
        ],
      },
    ],
  },
  {
    id: 'case-chiave',
    title: 'Le case chiave',
    icon: 'pawn',
    steps: [
      {
        kind: 'read',
        fen: '8/8/8/8/3P4/8/8/K6k w - - 0 1',
        highlights: area('cde', '6', KEY),
        text:
          'Per ogni pedone ci sono delle **case chiave**: se il tuo Re ci arriva, il pedone promuove qualunque cosa faccia il Re nemico.\n\nPer un pedone che non è ancora alla quinta traversa, le case chiave sono le tre **due traverse davanti** al pedone: qui, con il pedone in d4, sono **c6, d6 ed e6**.\n\nIl piano quindi non è spingere il pedone, ma **portare il Re davanti**. Il pedone avanza dopo.',
      },
      {
        kind: 'kpk',
        fen: '8/8/3k4/8/8/3K4/3P4/8 w - - 0 1',
        goal: 'win',
        text: 'Vinci col Bianco. **Prima il Re**: portalo davanti al pedone e usa l\'opposizione per raggiungere le case chiave. Il pedone lo spingi quando il Re gli apre la strada.',
      },
      {
        kind: 'kpk',
        fen: '8/8/8/2k5/8/4K3/4P3/8 w - - 0 1',
        goal: 'win',
        text: 'Un\'altra: vinci col Bianco. Se il contatore sale vuol dire che hai perso tempo; se la posizione diventa patta te lo dico subito.',
      },
    ],
  },
  {
    id: 'difesa',
    title: 'Difendersi col Re davanti',
    icon: 'king',
    steps: [
      {
        kind: 'read',
        fen: '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1',
        orientation: 'black',
        highlights: [{ square: 'e6', color: BLUE }, { square: 'e5', color: RED }],
        text:
          'Ora sei tu a difendere, col Nero. La regola è semplice:\n\n- tieni il Re **davanti al pedone**, sulla sua colonna;\n- quando il Re bianco ti si mette di fronte, **prendi tu l\'opposizione**;\n- se devi indietreggiare, vai **dritto indietro** (non di lato): così, quando il Re bianco avanza, puoi rimetterti di fronte.\n\nVicino alla promozione, attento allo **stallo**: è il tuo alleato.',
      },
      {
        kind: 'kpk',
        fen: '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1',
        goal: 'draw',
        moves: 10,
        text: '**Patta col Nero.** Muove prima il Bianco, che cercherà di farti sbagliare. Resisti 10 mosse (o prendi il pedone).',
      },
      {
        kind: 'kpk',
        fen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
        goal: 'draw',
        moves: 10,
        text: 'Un\'altra difesa: il pedone è ancora indietro. **Patta col Nero**, resistendo 10 mosse.',
      },
    ],
  },
  {
    id: 'pedone-torre',
    title: 'Il pedone di Torre',
    icon: 'pawn',
    steps: [
      {
        kind: 'read',
        fen: 'k7/8/K7/P7/8/8/8/8 w - - 0 1',
        highlights: [{ square: 'a8', color: GREEN }],
        text:
          "Il pedone di Torre (colonna a o h) è un'eccezione: se il Re nemico arriva nell'**angolo di promozione**, non lo si caccia più. Il Re bianco può solo chiuderlo, e a quel punto è stallo.\n\nQui il Bianco ha il Re in sesta davanti al pedone (che con un altro pedone vincerebbe sempre), ma è **patta**.\n\nChi difende contro un pedone di Torre ha un solo obiettivo: **correre nell'angolo**.",
      },
      {
        kind: 'kpk',
        fen: '8/8/8/8/k7/8/P7/2K5 w - - 0 1',
        goal: 'draw',
        moves: 10,
        text: '**Patta col Nero**: porta il Re verso l\'angolo a8 (o resta davanti al pedone) e resisti 10 mosse.',
      },
    ],
  },
  {
    id: 'lucena',
    title: 'Torre: la posizione di Lucena',
    icon: 'rook',
    steps: [
      {
        kind: 'read',
        fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
        highlights: [{ square: 'c1', color: GREEN }, { square: 'b8', color: BLUE }],
        text:
          "Il finale di Torre e pedone contro Torre più importante da sapere vincere. Il pedone è in settima, il tuo Re è davanti al pedone e il Re nero è **tagliato** dalla tua Torre sulla colonna c.\n\nIl problema: il Re bianco vuole uscire per lasciar promuovere il pedone, ma la Torre nera gli dà scacco da lontano.\n\nLa soluzione si chiama **costruire il ponte**:\n\n- allontana ancora il Re nero con uno scacco;\n- porta la Torre in **quarta traversa**;\n- esci col Re e avvicinati alla Torre nera a zig-zag;\n- quando arrivano gli scacchi, la Torre in quarta si mette in mezzo: è il **ponte**.",
      },
      {
        kind: 'quiz',
        fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
        question: 'Qual è la prima mossa?',
        text: 'Il Re nero è vicino e la Torre nera controlla la colonna a.',
        options: [
          { text: 'Rd1+, per allontanare il Re nero', correct: true, explain: 'Esatto: il Re nero deve allontanarsi di un\'altra colonna, così poi il tuo Re potrà uscire.' },
          { text: "Rh1, una mossa d'attesa", explain: 'Anche il Nero aspetta: il Re bianco resta chiuso in b8 (c7 e c8 sono controllate dal Re nero) e non fai progressi.' },
          { text: 'Rc8, per proteggere la casa di promozione', explain: 'La Torre in c8 diventa passiva e il Re bianco resta chiuso in b8: così non fai progressi.' },
        ],
      },
      {
        kind: 'line',
        fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
        moves: ['Rd1+', 'Ke7', 'Rd4', 'Ra1', 'Kc7', 'Rc1+', 'Kb6', 'Rb1+', 'Kc6', 'Rc1+', 'Kb5', 'Rb1+', 'Rb4'],
        notes: [
          'Il Re nero si allontana.',
          undefined,
          'La Torre va in quarta traversa: sarà il ponte.',
          'La Torre nera aspetta.',
          'Il Re esce: ora il pedone può promuovere.',
          'Gli scacchi iniziano.',
          undefined,
          undefined,
          'Il Re si avvicina alla Torre nera.',
          undefined,
          undefined,
          undefined,
          'Il ponte! Gli scacchi sono finiti e il pedone promuove.',
        ],
        text: '**Gioca la posizione di Lucena col Bianco**: scacco, Torre in quarta, Re fuori e ponte. Il Nero risponde da solo.',
      },
    ],
  },
  {
    id: 'philidor',
    title: 'Torre: la difesa di Philidor',
    icon: 'rook',
    steps: [
      {
        kind: 'read',
        fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1',
        orientation: 'black',
        highlights: area('abcdefgh', '6'),
        text:
          "Ora sei tu a difendere un finale di Torre con un pedone in meno. Il Re nero è davanti al pedone: con la **difesa di Philidor** è patta.\n\n- Tieni la Torre sulla **sesta traversa** (la terza dal tuo lato): il Re bianco non può avanzare, perché riceverebbe scacco.\n- Quando il pedone avanza in sesta, la Torre va **in fondo** (prima traversa) e dà scacco **da dietro**: il Re bianco non ha più ripari davanti al pedone.",
      },
      {
        kind: 'quiz',
        fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1',
        orientation: 'black',
        question: 'Finché il pedone resta in quinta, qual è il piano del Nero?',
        text: 'Il Re nero è già davanti al pedone.',
        options: [
          { text: 'Tenere la Torre in sesta traversa', correct: true, explain: 'Esatto: finché il pedone non arriva in sesta, la Torre tiene la sesta e il Re bianco non può avanzare senza ricevere scacco.' },
          { text: 'Mettere la Torre in e6, davanti al pedone', explain: 'No: in e6 la Torre è attaccata dal Re bianco e la perdi.' },
          { text: 'Allontanare il Re dal pedone', explain: 'No: il Re deve restare davanti al pedone, sulla casa di promozione. È lui che ferma il pedone.' },
        ],
      },
      {
        kind: 'line',
        fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1',
        moves: ['Rh6|Rg6', 'e6', 'Rh1|Rg1', 'Kd6', 'Rd1+', 'Ke5', 'Re1+', 'Kd6', 'Rd1+'],
        notes: [
          'Resti in sesta: il Re bianco non può avanzare.',
          'Il pedone avanza in sesta…',
          '…e la Torre va subito in fondo.',
          undefined,
          'Scacco da dietro.',
          undefined,
          'Il Re bianco non ha ripari: gli scacchi non finiscono più. È patta.',
        ],
        text: '**Difenditi col Nero** con la difesa di Philidor: Torre in sesta, poi in fondo e scacchi da dietro.',
      },
    ],
  },
];

export const ENDGAME_COURSE: MateCourseDef = {
  id: 'endgames',
  title: 'Finali di pedoni e torri',
  storageKey: 'endgames:progress',
  lessons: ENDGAME_LESSONS,
};
