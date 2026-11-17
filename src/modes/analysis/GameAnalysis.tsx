import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import type { Arrow, Opening } from '../../model/types';
import { matchRepertoire, resultText, TIME_CLASS, type AnalyzedGame } from '../../core/analysis';
import { buildPliesFrom } from '../../core/simulation';
import { SIM_QUALITY } from '../../core/quality';
import { accuracyOf, errorMarks, qualitiesOf, winCurve } from '../../core/review';
import { findInBook, lineNameOf, nextMoves, pathFromRoot } from '../../core/tree';
import { sanFromUci } from '../../engine/simEngine';
import { engine } from '../../engine/stockfish';
import { Board } from '../../components/Board';
import { EvalBar } from '../../components/Explanation';
import { EvalGraph } from '../../components/EvalGraph';
import { KeyMoments, QualityMoves, ReviewMove, ReviewNav, ReviewSummary } from '../../components/ReviewParts';
import { useMoveKeys, usePositionEvals } from '../../components/useReview';

const BEST_ARROW = 'rgba(37, 99, 235, 0.8)';

export type OpenMode = (openingId: string, mode: 'lab' | 'sim', moves: string[]) => void;

/** Analisi di una partita: Stockfish valuta ogni posizione, poi precisione, errori e confronto col repertorio. */
export function GameAnalysis({
  game,
  openings,
  onChange,
  onBack,
  onOpenMode,
}: {
  game: AnalyzedGame;
  openings: Opening[];
  onChange: (g: AnalyzedGame) => void;
  onBack: () => void;
  onOpenMode: OpenMode;
}) {
  const myWhite = game.myWhite;
  const match = useMemo(() => matchRepertoire(openings, game, myWhite), [openings, game, myWhite]);
  const plies = useMemo(() => buildPliesFrom(game.startFen, game.moves, match?.opening.root), [game, match]);
  const fens = useMemo(() => [game.startFen, ...plies.map((p) => p.fenAfter)], [game.startFen, plies]);
  // Valuta tutte le posizioni, in ordine (Stockfish ne fa una alla volta).
  const evals = usePositionEvals(fens);
  const [cursor, setCursor] = useState(0);
  useEffect(() => () => engine.cancelAll(), []);

  const qualities = qualitiesOf(plies, fens, evals);
  const analyzed = fens.filter((f) => evals[f]).length;
  const ready = analyzed === fens.length;
  const accuracy = (white: boolean) => accuracyOf(plies, fens, evals, white);

  // Analisi completa: salva nell'archivio con la precisione.
  useEffect(() => {
    if (!ready) return;
    onChange({ ...game, openingId: match?.opening.id, accuracy: { white: accuracy(true), black: accuracy(false) }, analyzedAt: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, myWhite]);

  useMoveKeys(true, plies.length, setCursor);

  const shownFen = fens[cursor];
  const shownEval = evals[shownFen];
  const ply = cursor > 0 ? plies[cursor - 1] : undefined;
  const q = cursor > 0 ? qualities[cursor - 1] : undefined;
  const arrows: Arrow[] = [];
  const marks: Record<string, string> = {};
  if (ply && q) marks[ply.uci.slice(2, 4)] = SIM_QUALITY[q].color + '66';
  if (ply && q && q !== 'libro' && q !== 'migliore') {
    const best = evals[fens[cursor - 1]]?.best;
    if (best) arrows.push({ from: best.slice(0, 2), to: best.slice(2, 4), color: BEST_ARROW });
  }

  // Confronto con il repertorio: chi è uscito dalla teoria, e dove.
  const firstOut = plies.findIndex((p) => !p.book);
  const deviation = match && firstOut >= 0 ? plies[firstOut] : undefined;
  const deviationByMe = deviation && myWhite !== undefined && deviation.white === myWhite;
  const bookBefore = deviation && match ? findInBook(match.opening.root, deviation.fenBefore) : undefined;
  const expectedThere = bookBefore ? nextMoves(bookBefore) : [];
  const lineName = match && bookBefore ? lineNameOf(pathFromRoot(bookBefore)) : undefined;
  const moveNo = (i: number) => `${Math.floor(i / 2) + 1}${plies[i].white ? '.' : '...'}${plies[i].san}`;
  const meName = myWhite === undefined ? undefined : myWhite ? game.white : game.black;
  const oppName = myWhite === undefined ? undefined : myWhite ? game.black : game.white;

  return (
    <div className="layout two sim">
      <div className="board-col">
        <EvalBar scoreWhite={shownEval?.scoreWhite} mateWhite={shownEval?.mateWhite} />
        <Board
          fen={shownFen}
          orientation={myWhite === false ? 'black' : 'white'}
          arrows={arrows}
          marks={marks}
          badge={ply && q ? { square: ply.uci.slice(2, 4), quality: q } : undefined}
          lastMove={ply ? { from: ply.uci.slice(0, 2), to: ply.uci.slice(2, 4) } : undefined}
        />
        <ReviewNav last={plies.length} setCursor={setCursor}>
          <button onClick={onBack}><Icon name="arrowLeft" /> Le mie partite</button>
        </ReviewNav>
      </div>

      <div className="side">
        <div className="analysis-head">
          <div>
            <strong>
              <Icon name="white" /> {game.white}
              {game.whiteElo ? ` (${game.whiteElo})` : ''} – <Icon name="black" /> {game.black}
              {game.blackElo ? ` (${game.blackElo})` : ''}
            </strong>
            <div className="muted small">
              {[game.date && new Date(game.date).toLocaleDateString('it-IT'), game.timeClass && (TIME_CLASS[game.timeClass] ?? game.timeClass), game.openingName].filter(Boolean).join(' · ')}
              {game.url && (
                <>
                  {' · '}
                  <a href={game.url} target="_blank" rel="noreferrer">
                    apri su chess.com
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="seg" role="group" aria-label="Con che colore giocavi">
            <span className="muted small">Io ero:</span>
            <button className={myWhite === true ? 'active' : ''} onClick={() => onChange({ ...game, myWhite: true })}>
              <Icon name="white" /> Bianco
            </button>
            <button className={myWhite === false ? 'active' : ''} onClick={() => onChange({ ...game, myWhite: false })}>
              <Icon name="black" /> Nero
            </button>
          </div>
        </div>

        {myWhite === undefined && (
          <p className="feedback">Con che colore giocavi? Sceglilo qui sopra: serve per la tua precisione e per il confronto col repertorio.</p>
        )}

        {match && (
          <div className={`book-status ${deviationByMe ? 'out' : 'in'}`}>
            {!deviation ? (
              <><Icon name="inBook" /> Tutta la partita è nel tuo repertorio ({match.opening.name}).</>
            ) : deviationByMe ? (
              <>
                <Icon name="outOfBook" /> {match.opening.name}
                {lineName ? ` — ${lineName}` : ''}: sei uscito dal repertorio con <strong>{moveNo(firstOut)}</strong>
                {expectedThere.length > 0 && <> (prevedeva {expectedThere.map((n) => n.san).join(' o ')})</>}.
              </>
            ) : (
              <>
                <Icon name="inBook" /> {match.opening.name}
                {lineName ? ` — ${lineName}` : ''}: hai seguito il repertorio; l'avversario ne è uscito con <strong>{moveNo(firstOut)}</strong>.
              </>
            )}
            <div className="controls book-actions">
              {deviation && <button onClick={() => setCursor(firstOut + 1)}>Vai alla mossa</button>}
              <button onClick={() => onOpenMode(match.opening.id, 'lab', game.moves.slice(0, firstOut === -1 ? plies.length : firstOut))}>
                <Icon name="lab" /> Laboratorio da qui
              </button>
              <button onClick={() => onOpenMode(match.opening.id, 'sim', game.moves.slice(0, firstOut === -1 ? plies.length : firstOut))}>
                <Icon name="sim" /> Rigioca da qui
              </button>
            </div>
          </div>
        )}

        <ReviewSummary
          result={resultText(game)}
          meLabel={meName ? `${meName} (tu)` : game.white}
          oppLabel={oppName ?? game.black}
          meAcc={ready ? accuracy(myWhite ?? true) : undefined}
          oppAcc={ready ? accuracy(!(myWhite ?? true)) : undefined}
          progress={`${analyzed}/${fens.length}`}
          ready={ready}
          plies={plies}
          qualities={qualities}
          myWhite={myWhite ?? true}
        />
        {!ready && (
          <div className="progress" aria-label="Avanzamento dell'analisi">
            <div className="bar" style={{ width: `${(analyzed / fens.length) * 100}%` }} />
          </div>
        )}

        <EvalGraph
          values={winCurve(fens, evals)}
          cursor={cursor}
          onSelect={setCursor}
          marks={errorMarks(qualities)}
        />

        <QualityMoves plies={plies} qualities={qualities} startFen={game.startFen} cursor={cursor} onSelect={setCursor} bookTitle="Repertorio" />

        {ply && (
          <ReviewMove
            ply={ply}
            index={cursor - 1}
            quality={q}
            before={evals[fens[cursor - 1]]}
            mine={myWhite === undefined ? true : ply.white === myWhite}
            expected={(() => {
              const n = match ? findInBook(match.opening.root, ply.fenBefore) : undefined;
              return n ? nextMoves(n) : [];
            })()}
          />
        )}
        {ply && !q && <p className="muted small">Stockfish sta ancora analizzando questa mossa…</p>}
        {!ply && evals[fens[0]]?.best && (
          <p className="muted small">Posizione iniziale · Stockfish giocherebbe {sanFromUci(fens[0], evals[fens[0]].best!)}.</p>
        )}

        {ready && <KeyMoments plies={plies} qualities={qualities} myWhite={myWhite ?? true} onSelect={setCursor} />}
      </div>
    </div>
  );
}
