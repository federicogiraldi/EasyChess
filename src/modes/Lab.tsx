import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { Arrow, Opening } from '../model/types';
import { findInBook, lineNameOf, nextMoves, pathFromRoot } from '../core/tree';
import { evaluate, judgeMove, QUALITY_INFO, type Verdict } from '../engine/judge';
import { Board, sanOf } from '../components/Board';
import { EvalBar, ExplanationCard } from '../components/Explanation';

interface Props {
  opening: Opening;
  /** Mosse (SAN) da cui partire, es. la posizione aperta in Esplora. */
  initialMoves?: string[];
}

type Eval = Awaited<ReturnType<typeof evaluate>>;

const BOOK_ARROW = 'rgba(21, 128, 61, 0.6)';
const BEST_ARROW = 'rgba(37, 99, 235, 0.75)';

/**
 * Laboratorio: scacchiera libera con Stockfish. Ogni mossa viene giudicata e spiegata,
 * confrontandola con il repertorio quando la posizione è "da libro".
 */
export function Lab({ opening, initialMoves = [] }: Props) {
  const [moves, setMoves] = useState<string[]>(initialMoves);
  const [cursor, setCursor] = useState(initialMoves.length);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict | 'loading' | Error>>({});
  const [evals, setEvals] = useState<Record<string, Eval>>({});
  const [autoReply, setAutoReply] = useState(true);
  const [showBest, setShowBest] = useState(false);

  // fens[i] = posizione dopo i mosse
  const fens = useMemo(() => {
    const chess = new Chess(opening.root.fen);
    const out = [chess.fen()];
    for (const m of moves) {
      chess.move(m);
      out.push(chess.fen());
    }
    return out;
  }, [moves, opening.root.fen]);

  const fen = fens[cursor];
  const book = findInBook(opening.root, fen);
  const bookMoves = book ? nextMoves(book) : [];
  const myColor = opening.color === 'white' ? 'w' : 'b';
  const sideToMove = fen.split(' ')[1];
  const verdictKey = (i: number) => `${fens[i - 1]}|${moves[i - 1]}`;

  // Valutazione della posizione corrente.
  useEffect(() => {
    if (evals[fen]) return;
    let alive = true;
    evaluate(fen).then((e) => alive && setEvals((s) => ({ ...s, [fen]: e })), () => {});
    return () => {
      alive = false;
    };
  }, [fen, evals]);

  const judge = (i: number, list: string[]) => {
    const before = fens[i] ?? (() => {
      const c = new Chess(opening.root.fen);
      list.slice(0, i).forEach((m) => c.move(m));
      return c.fen();
    })();
    const key = `${before}|${list[i]}`;
    const inBook = findInBook(opening.root, before);
    setVerdicts((v) => ({ ...v, [key]: 'loading' }));
    judgeMove(before, list[i], inBook ? nextMoves(inBook) : []).then(
      (r) => setVerdicts((v) => ({ ...v, [key]: r })),
      (e: Error) => setVerdicts((v) => ({ ...v, [key]: e })),
    );
  };

  const play = (san: string) => {
    const next = [...moves.slice(0, cursor), san];
    setMoves(next);
    setCursor(next.length);
    judge(next.length - 1, next);
  };

  // Risposta automatica dell'avversario: prima il repertorio, poi Stockfish.
  useEffect(() => {
    if (!autoReply || cursor !== moves.length || sideToMove === myColor) return;
    if (new Chess(fen).isGameOver()) return;
    let alive = true;
    const t = setTimeout(async () => {
      let san: string | undefined;
      if (bookMoves.length > 0) san = bookMoves[Math.floor(Math.random() * bookMoves.length)].san;
      else {
        const e = await evaluate(fen);
        if (e.best) san = new Chess(fen).move({ from: e.best.slice(0, 2), to: e.best.slice(2, 4), promotion: e.best[4] ?? 'q' }).san;
      }
      if (alive && san) {
        setMoves((m) => [...m, san]);
        setCursor((c) => c + 1);
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, autoReply, cursor, moves.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setCursor((c) => Math.max(0, c - 1));
      else if (e.key === 'ArrowRight') setCursor((c) => Math.min(moves.length, c + 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length]);

  const onMove = (from: string, to: string) => {
    const san = sanOf(fen, from, to);
    if (!san) return false;
    play(san);
    return true;
  };

  const ev = evals[fen];
  const arrows: Arrow[] = bookMoves.map((c) => ({ from: c.from, to: c.to, color: BOOK_ARROW }));
  if (showBest && ev?.best) arrows.push({ from: ev.best.slice(0, 2), to: ev.best.slice(2, 4), color: BEST_ARROW });

  // Ultima mossa analizzata fino al cursore (di solito la tua, anche se l'avversario ha già risposto).
  let judged = cursor;
  while (judged > 0 && !verdicts[verdictKey(judged)]) judged--;
  const lastVerdict = judged > 0 ? verdicts[verdictKey(judged)] : undefined;
  const lastMove = cursor > 0 ? new Chess(fens[cursor - 1]).move(moves[cursor - 1]) : undefined;

  // Fino a che mossa siamo rimasti nel repertorio?
  let outOfBook = -1;
  for (let i = 0; i < moves.length; i++) {
    const node = findInBook(opening.root, fens[i]);
    if (!node || !nextMoves(node).some((c) => c.san === moves[i])) {
      outOfBook = i;
      break;
    }
  }
  const lineName = book ? lineNameOf(pathFromRoot(book)) : undefined;

  return (
    <div className="layout two">
      <div className="board-col">
        <EvalBar scoreWhite={ev?.scoreWhite} mateWhite={ev?.mateWhite} />
        <Board
          fen={fen}
          orientation={opening.color}
          onMove={onMove}
          arrows={arrows}
          lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : undefined}
        />
        <div className="controls">
          <button onClick={() => setCursor(0)} title="Inizio">⏮</button>
          <button onClick={() => setCursor((c) => Math.max(0, c - 1))} title="Indietro (←)">◀</button>
          <button onClick={() => setCursor((c) => Math.min(moves.length, c + 1))} title="Avanti (→)">▶</button>
          <button
            onClick={() => {
              setMoves(moves.slice(0, Math.max(0, cursor - 1)));
              setCursor(Math.max(0, cursor - 1));
            }}
            disabled={cursor === 0}
          >
            ↶ Annulla mossa
          </button>
          <button
            onClick={() => ev?.best && play(new Chess(fen).move({ from: ev.best.slice(0, 2), to: ev.best.slice(2, 4), promotion: 'q' }).san)}
            disabled={!ev?.best}
          >
            ⚡ Gioca la migliore
          </button>
        </div>
        <div className="controls">
          <label className="toggle-inline">
            <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} /> L'avversario risponde da solo
          </label>
          <label className="toggle-inline">
            <input type="checkbox" checked={showBest} onChange={(e) => setShowBest(e.target.checked)} /> Freccia blu: mossa migliore
          </label>
        </div>
      </div>

      <div className="side">
        <div className="lab-intro muted small">
          Gioca qualsiasi mossa: Stockfish la valuta e ti spiega perché un'altra sarebbe migliore. Frecce verdi = mosse del
          repertorio.
        </div>
        <div className={`book-status ${book && bookMoves.length ? 'in' : 'out'}`}>
          {outOfBook === -1 || outOfBook >= cursor
            ? book && bookMoves.length
              ? `📗 Nel repertorio${lineName ? ` — ${lineName}` : ''}`
              : '📗 Fine della linea del repertorio'
            : `📕 Fuori dal repertorio dalla mossa ${moveText(outOfBook, moves[outOfBook])}`}
        </div>

        <div className="moves">
          {moves.length === 0 && <span className="muted">Posizione iniziale</span>}
          {moves.map((m, i) => {
            const v = verdicts[`${fens[i]}|${m}`];
            const sym = v && v !== 'loading' && !(v instanceof Error) ? QUALITY_INFO[v.quality].symbol : '';
            return (
              <span key={i} className="move-wrap">
                {i % 2 === 0 && <span className="move-num">{i / 2 + 1}.</span>}
                <button className={`move ${i + 1 === cursor ? 'active' : ''} ${sym.includes('?') ? 'bad' : ''}`} onClick={() => setCursor(i + 1)}>
                  {m}
                  {sym}
                </button>
              </span>
            );
          })}
        </div>

        {judged > 0 && judged < cursor && (
          <p className="muted small">
            Risposta: {moves.slice(judged, cursor).map((m, k) => moveText(judged + k, m)).join(' ')} · analisi della mossa {moveText(judged - 1, moves[judged - 1])}:
          </p>
        )}
        {lastVerdict === 'loading' && <p className="muted small">Stockfish sta analizzando {moves[judged - 1]}…</p>}
        {lastVerdict instanceof Error && <p className="muted small">Analisi non disponibile: {lastVerdict.message}</p>}
        {lastVerdict && lastVerdict !== 'loading' && !(lastVerdict instanceof Error) && <ExplanationCard verdict={lastVerdict} />}
        {judged < cursor && cursor > 0 && (
          <button className="why" onClick={() => judge(cursor - 1, moves)}>
            🔬 Analizza {moves[cursor - 1]}
          </button>
        )}
        {ev && <p className="muted small">Linea di Stockfish: {ev.line}</p>}
      </div>
    </div>
  );
}

function moveText(i: number, san: string) {
  const n = Math.floor(i / 2) + 1;
  return i % 2 === 0 ? `${n}.${san}` : `${n}...${san}`;
}
