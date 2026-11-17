import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { checkLessons } from './mateCourse';
import { ENDGAME_LESSONS } from './endgameCourse';
import { probeKpk } from './kpk';

describe('corso sui finali', () => {
  it('posizioni legali e linee giocabili', () => {
    expect(checkLessons(ENDGAME_LESSONS)).toEqual([]);
  });

  for (const lesson of ENDGAME_LESSONS)
    lesson.steps.forEach((step, i) => {
      if (step.kind === 'kpk')
        it(`${lesson.id}#${i}: il risultato con il gioco perfetto è quello richiesto`, () => {
          expect(probeKpk(step.fen)?.result).toBe(step.goal);
        });
      if (step.kind === 'line')
        it(`${lesson.id}#${i}: ogni alternativa permette di continuare la linea`, () => {
          // Per ogni mossa alternativa dell'utente, il resto della linea (mosse principali) resta legale.
          const user = step.fen.split(' ')[1];
          const base = new Chess(step.fen);
          step.moves.forEach((m, j) => {
            const alts = m.split('|');
            if (base.turn() === user)
              for (const alt of alts.slice(1)) {
                const c = new Chess(base.fen());
                // un'alternativa può valere solo su un altro percorso (es. Rg1 dopo Rg6)
                try {
                  c.move(alt);
                } catch {
                  continue;
                }
                for (const rest of step.moves.slice(j + 1)) {
                  const options = rest.split('|');
                  const ok = options.some((o) => {
                    try {
                      new Chess(c.fen()).move(o);
                      return true;
                    } catch {
                      return false;
                    }
                  });
                  expect(ok, `${alt} poi ${rest}`).toBe(true);
                  c.move(options.find((o) => { try { new Chess(c.fen()).move(o); return true; } catch { return false; } })!);
                }
              }
            base.move(alts[0]);
          });
        });
      if (step.kind === 'quiz' && step.fen === '4k3/4P3/4K3/8/8/8/8/8 b - - 0 1')
        it(`${lesson.id}#${i}: lo stallo è davvero stallo`, () => {
          expect(new Chess(step.fen).isStalemate()).toBe(true);
        });
    });
});
