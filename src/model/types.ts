export type Side = 'white' | 'black';

export interface Arrow {
  from: string;
  to: string;
  color: string;
}

export interface Highlight {
  square: string;
  color: string;
}

/** Una posizione dell'albero, raggiunta giocando `san` dal nodo padre. */
export interface OpeningNode {
  /** Percorso di mosse dalla radice, es. "e4 c6 d4". Vuoto per la radice. */
  id: string;
  san: string;
  from: string;
  to: string;
  fen: string;
  ply: number;
  /** true se la mossa che porta qui è giocata dal lato che sto studiando. */
  isUserMove: boolean;
  comment?: string;
  /** Nome della linea che parte da questo nodo (da [%line ...] o ChapterName). */
  lineName?: string;
  keyIdeas: string[];
  arrows: Arrow[];
  highlights: Highlight[];
  children: OpeningNode[];
  parent: OpeningNode | null;
  /** Se la linea finisce qui ma la posizione continua altrove nell'albero. */
  transposesTo?: OpeningNode;
}

export interface Opening {
  /** Corso guidato, se esiste un file <id>.course.md. */
  course?: import('../core/course').Course;
  id: string;
  name: string;
  color: Side;
  description: string;
  root: OpeningNode;
  source: 'builtin' | 'imported';
}
