import { describe, expect, it } from 'vitest';
import { parseOpening } from './pgnToTree';
import { detectMyColor, fromChessCom, matchRepertoire, myOutcome, parseGame, parseGames, resultText, splitPgn } from './analysis';

// Come la esporta chess.com (header, orologio nei commenti, ECOUrl, Link).
const CC_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.11.02"]
[Round "-"]
[White "avversario99"]
[Black "FedeGiraldi"]
[Result "0-1"]
[ECO "B12"]
[ECOUrl "https://www.chess.com/openings/Caro-Kann-Defense-Advance-Variation-3...Bf5"]
[UTCDate "2026.11.02"]
[UTCTime "20:15:03"]
[WhiteElo "1180"]
[BlackElo "1214"]
[TimeControl "600"]
[Termination "FedeGiraldi won by checkmate"]
[Link "https://www.chess.com/game/live/123456789"]

1. e4 {[%clk 0:09:58.1]} 1... c6 {[%clk 0:09:59]} 2. d4 {[%clk 0:09:55]} 2... d5 {[%clk 0:09:57]}
3. e5 {[%clk 0:09:50]} 3... Bf5 {[%clk 0:09:55]} 4. g4 {[%clk 0:09:40]} 4... Be4 {[%clk 0:09:30]}
5. f3 {[%clk 0:09:20]} 5... Bg6 {[%clk 0:09:25]} 0-1
`;

const SECOND = `[Event "Casual"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. f3 e5 2. g4 Qh4# 0-1`;

const REPERTOIRE = parseOpening(
  `[Opening "Caro-Kann"]
[Color "black"]
[Id "ck"]

1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 *`,
  'ck',
);

const WHITE_REP = parseOpening(
  `[Opening "Londra"]
[Color "white"]
[Id "london"]

1. d4 d5 2. Bf4 *`,
  'london',
);

describe('PGN di chess.com', () => {
  const g = parseGame(CC_PGN, 'chess.com');

  it('legge mosse e header, ignorando i tempi', () => {
    expect(g.moves).toEqual(['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'g4', 'Be4', 'f3', 'Bg6']);
    expect(g).toMatchObject({ white: 'avversario99', black: 'FedeGiraldi', whiteElo: '1180', result: '0-1', date: '2026-11-02' });
    expect(g.url).toBe('https://www.chess.com/game/live/123456789');
    expect(g.openingName).toBe('Caro Kann Defense Advance Variation 3...Bf5');
    expect(resultText(g)).toBe('Vince il Nero · FedeGiraldi won by checkmate');
  });

  it('stessa partita, stesso id', () => {
    expect(parseGame(CC_PGN).id).toBe(g.id);
    expect(parseGame(SECOND).id).not.toBe(g.id);
  });

  it('riconosce chi sono (senza maiuscole) e il risultato per me', () => {
    expect(detectMyColor(g, 'fedegiraldi')).toBe(false);
    expect(detectMyColor(g, 'avversario99')).toBe(true);
    expect(detectMyColor(g, 'altro')).toBeUndefined();
    expect(myOutcome(g, false)).toBe('vinta');
    expect(myOutcome(g, true)).toBe('persa');
  });

  it('trova la linea del repertorio e fino a dove arriva', () => {
    expect(matchRepertoire([WHITE_REP, REPERTOIRE], g, false)).toMatchObject({ opening: { id: 'ck' }, bookPlies: 6 });
    // col Bianco la Caro-Kann non è "mia"
    expect(matchRepertoire([WHITE_REP, REPERTOIRE], g, true)).toBeUndefined();
  });
});

describe('più partite e errori', () => {
  it('divide un file con più partite', () => {
    expect(splitPgn(`${CC_PGN}\n\n${SECOND}\n`)).toHaveLength(2);
    expect(splitPgn('1. e4 e5 *')).toHaveLength(1);
  });

  it('segnala le partite non valide senza perdere le altre', () => {
    const { games, errors } = parseGames(`${SECOND}\n\n[Event "x"]\n\n1. e4 e4 *`);
    expect(games).toHaveLength(1);
    expect(errors[0]).toMatch(/^Partita 2:/);
    expect(() => parseGame('[Variant "Chess960"]\n\n1. e4 *')).toThrow(/variante/);
  });
});

describe('API di chess.com', () => {
  it('tiene solo gli scacchi classici, dalla più recente', () => {
    const games = fromChessCom([
      { url: 'https://www.chess.com/game/live/1', pgn: SECOND.replace('[Result', '[Date "2026.10.01"]\n[Result'), rules: 'chess', time_class: 'blitz', white: { username: 'A' }, black: { username: 'B' } },
      { url: 'https://www.chess.com/game/live/2', pgn: CC_PGN, rules: 'chess', time_class: 'rapid', white: { username: 'x' }, black: { username: 'y' } },
      { url: 'https://www.chess.com/game/live/3', pgn: CC_PGN, rules: 'chess960', white: { username: 'x' }, black: { username: 'y' } },
    ]);
    expect(games.map((g) => g.id)).toEqual(['cc-2', 'cc-1']);
    expect(games[0]).toMatchObject({ source: 'chess.com', timeClass: 'rapid' });
  });
});
