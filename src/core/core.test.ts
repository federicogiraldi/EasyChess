import { describe, expect, it } from 'vitest';
import { parseOpening, PgnError } from './pgnToTree';
import { cardPositions, formatPath, lineNameOf, nextMoves, pathFromRoot } from './tree';
import { grade, isMastered, MAX_INTERVAL } from './srs';

const BLACK_PGN = `
[Opening "Test Nero"]
[Color "black"]
[Id "test-black"]

{ Intro } 1. e4 c6 { [%line Base] Prepara d5 [%key Idea A] [%cal Gd7d5] }
2. d4 ( 2. Nc3 d5 3. d4 { traspone } ) 2... d5 3. Nc3 dxe4 4. Nxe4 *

1. e4 c6 2. d4 d5 3. e5 { [%line Avanzata] } Bf5 *
`;

describe('parseOpening', () => {
  const op = parseOpening(BLACK_PGN, 'fallback');

  it('legge gli header', () => {
    expect(op.id).toBe('test-black');
    expect(op.name).toBe('Test Nero');
    expect(op.color).toBe('black');
    expect(op.root.comment).toBe('Intro');
  });

  it('fonde le partite con mosse in comune e gestisce le varianti', () => {
    const e4 = op.root.children[0];
    expect(op.root.children).toHaveLength(1);
    const c6 = e4.children[0];
    expect(c6.children.map((c) => c.san)).toEqual(['d4', 'Nc3']);
    const d5 = c6.children[0].children[0];
    expect(d5.children.map((c) => c.san)).toEqual(['Nc3', 'e5']);
  });

  it('estrae comandi dai commenti', () => {
    const c6 = op.root.children[0].children[0];
    expect(c6.comment).toBe('Prepara d5');
    expect(c6.lineName).toBe('Base');
    expect(c6.keyIdeas).toEqual(['Idea A']);
    expect(c6.arrows).toEqual([{ from: 'd7', to: 'd5', color: expect.any(String) }]);
  });

  it('marca le mosse del lato studiato', () => {
    const e4 = op.root.children[0];
    expect(e4.isUserMove).toBe(false);
    expect(e4.children[0].isUserMove).toBe(true);
  });

  it('collega le trasposizioni', () => {
    const viaNc3 = op.root.children[0].children[0].children[1].children[0].children[0]; // 2.Nc3 d5 3.d4
    expect(viaNc3.san).toBe('d4');
    expect(viaNc3.transposesTo).toBeDefined();
    expect(nextMoves(viaNc3).map((c) => c.san)).toEqual(['dxe4']); // = 2.d4 d5 3.Nc3
  });

  it('crea una card per ogni posizione in cui tocca a me', () => {
    const keys = cardPositions(op).map((c) => formatPath(pathFromRoot(c.node)));
    expect(keys).toEqual(['1.e4', '1.e4 c6 2.d4', '1.e4 c6 2.d4 d5 3.Nc3', '1.e4 c6 2.d4 d5 3.e5', '1.e4 c6 2.Nc3']);
  });

  it('trova il nome della linea lungo il percorso', () => {
    const e5 = op.root.children[0].children[0].children[0].children[0].children[1];
    expect(lineNameOf(pathFromRoot(e5))).toBe('Avanzata');
  });

  it('segnala mosse illegali con la posizione', () => {
    expect(() => parseOpening('1. e4 e5 2. Ke3 *', 'x')).toThrow(PgnError);
    expect(() => parseOpening('1. e4 e5 2. Ke3 *', 'x')).toThrow(/Ke3.*1\.e4 e5/);
  });
});

describe('arrocco scritto con gli zeri', () => {
  const sans = (pgn: string) => {
    const out: string[] = [];
    let n = parseOpening(pgn, 'z').root;
    while (n.children.length) {
      n = n.children[0];
      out.push(n.san);
    }
    return out;
  };

  it('legge 0-0 e 0-0-0 come O-O e O-O-O', () => {
    expect(sans('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. 0-0 Nxe4 *')).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'O-O', 'Nxe4']);
    expect(sans('1. d4 d5 2. Nc3 Nc6 3. Bf4 Bf5 4. Qd2 Qd7 5. 0-0-0+ 0-0-0 0-1')).toEqual([
      'd4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7', 'O-O-O', 'O-O-O',
    ]);
  });
});

describe('colore bianco', () => {
  it('le mosse del Bianco sono mie', () => {
    const op = parseOpening('[Color "white"]\n1. e4 e5 2. Nf3 *', 'w');
    expect(op.root.children[0].isUserMove).toBe(true);
    expect(cardPositions(op).map((c) => c.node.ply)).toEqual([0, 2]);
  });

  it('usa Orientation di Lichess se manca Color', () => {
    expect(parseOpening('[Orientation "black"]\n1. e4 c6 *', 'x').color).toBe('black');
  });
});

describe('srs', () => {
  it('allunga gli intervalli e azzera dopo un errore', () => {
    let s = grade(undefined, true, 0);
    expect(s.interval).toBe(1);
    s = grade(s, true, s.due);
    expect(s.interval).toBe(3);
    expect(isMastered(s)).toBe(true);
    s = grade(s, true, s.due);
    expect(s.interval).toBeGreaterThan(3);
    const now = s.due;
    s = grade(s, false, now);
    expect(s.interval).toBe(0);
    expect(s.due).toBe(now);
    expect(isMastered(s)).toBe(false);
  });

  it("una risposta giusta prima della scadenza non allunga l'intervallo", () => {
    const first = grade(undefined, true, 0);
    let s = first;
    for (let i = 0; i < 20; i++) s = grade(s, true, 1000 * i);
    expect(s.interval).toBe(first.interval);
    expect(s.due).toBe(first.due);
    expect(s.seen).toBe(21);
    expect(s.correct).toBe(21);
  });

  it("l'intervallo ha un tetto", () => {
    let s = grade(undefined, true, 0);
    for (let i = 0; i < 40; i++) s = grade(s, true, s.due);
    expect(s.interval).toBe(MAX_INTERVAL);
    expect(Number.isFinite(new Date(s.due).getTime())).toBe(true);
  });
});
