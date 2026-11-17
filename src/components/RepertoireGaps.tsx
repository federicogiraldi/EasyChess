import { useMemo, useState, type ReactNode } from 'react';
import { Chess } from 'chess.js';
import type { Arrow, Opening } from '../model/types';
import { detectMyColor, fetchArchives, fetchMonth, STANDARD_FEN, type AnalyzedGame, type ImportedGame } from '../core/analysis';
import { findGaps, formatMoves, type Gap } from '../core/gaps';
import { getCard, markForReview, useProgress } from '../core/progress';
import { isDue } from '../core/srs';
import { Board } from './Board';
import { Icon } from './Icon';

const MONTHS = 3;
const SHOW = 6;
const PLAYED = 'rgba(185, 28, 28, 0.75)';
const BOOK = 'rgba(21, 128, 61, 0.8)';

interface Props {
  openings: Opening[];
  library: AnalyzedGame[];
  username: string;
  onOpenLab: (openingId: string, moves: string[]) => void;
}

/** Dove il repertorio non ti ha aiutato: mosse dell'avversario non coperte e mosse tue fuori dal repertorio. */
export function RepertoireGaps({ openings, library, username, onOpenLab }: Props) {
  const [recent, setRecent] = useState<ImportedGame[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | string>('idle');
  useProgress();

  const report = useMemo(
    () =>
      findGaps(openings, [
        ...library.map((g) => ({ game: g as ImportedGame, myWhite: g.myWhite })),
        ...recent.map((g) => ({ game: g, myWhite: detectMyColor(g, username) })),
      ]),
    [openings, library, recent, username],
  );

  const loadRecent = async () => {
    setState('loading');
    try {
      const archives = (await fetchArchives(username)).slice(0, MONTHS);
      const months = await Promise.all(archives.map((a) => fetchMonth(a)));
      setRecent(months.flat());
      setState('idle');
    } catch (e) {
      setState(e instanceof Error ? e.message : String(e));
    }
  };

  const toReview = report.deviations.filter((g) => g.cardKey && !isDue(getCard(g.cardKey)));

  return (
    <section className="sim-card gaps">
      <div className="gaps-head">
        <div>
          <h3><Icon name="search" /> Buchi del repertorio</h3>
          <p className="small muted">
            {report.checked === 0
              ? 'Analizza qualche partita (o carica le ultime da chess.com) e qui trovi dove il tuo repertorio non ti ha aiutato.'
              : `Su ${report.checked} ${report.checked === 1 ? 'partita' : 'partite'} col tuo colore: ${report.covered} ${report.covered === 1 ? 'segue' : 'seguono'} il repertorio fino alla fine della linea.`}
          </p>
        </div>
        {username && (
          <button onClick={() => void loadRecent()} disabled={state === 'loading'}>
            <Icon name="sync" className={state === 'loading' ? 'spin' : undefined} />{' '}
            {recent.length ? `Ricarica gli ultimi ${MONTHS} mesi` : `Controlla gli ultimi ${MONTHS} mesi su chess.com`}
          </button>
        )}
      </div>
      {state === 'loading' && <p className="muted small">Carico le partite di {username}…</p>}
      {state !== 'idle' && state !== 'loading' && <p className="error-text small">{state}</p>}
      {recent.length > 0 && state === 'idle' && <p className="muted small">Incluse {recent.length} partite degli ultimi {MONTHS} mesi da chess.com.</p>}

      {report.uncovered.length > 0 && (
        <GapList
          title="Mosse dell'avversario che il repertorio non copre"
          hint="Qui l'avversario ha giocato qualcosa che nessuna tua apertura prevede: vale la pena prepararsi."
          gaps={report.uncovered}
          render={(g) => (
            <button onClick={() => onOpenLab(g.openingId, [...g.moves, g.move])}>
              <Icon name="lab" /> Studia nel Laboratorio
            </button>
          )}
        />
      )}

      {report.deviations.length > 0 && (
        <GapList
          title="Dove esci tu dal repertorio"
          hint="Il repertorio prevedeva un'altra mossa: rimetti queste posizioni nel ripasso."
          gaps={report.deviations}
          extra={
            toReview.length > 1 && (
              <button className="primary" onClick={() => markForReview(toReview.map((g) => g.cardKey!))}>
                <Icon name="review" /> Metti tutte nel ripasso ({toReview.length})
              </button>
            )
          }
          render={(g) =>
            g.cardKey && isDue(getCard(g.cardKey)) ? (
              <span className="op-done small"><Icon name="check" /> Nel ripasso di oggi</span>
            ) : (
              <button onClick={() => g.cardKey && markForReview([g.cardKey])}>
                <Icon name="review" /> Ripassa questa posizione
              </button>
            )
          }
        />
      )}

      {report.checked > 0 && report.uncovered.length === 0 && report.deviations.length === 0 && (
        <p className="feedback ok"><Icon name="check" /> Nessun buco: in queste partite il repertorio ti ha accompagnato fino alla fine delle linee.</p>
      )}
    </section>
  );
}

function GapList({ title, hint, gaps, render, extra }: { title: string; hint: string; gaps: Gap[]; render: (g: Gap) => ReactNode; extra?: ReactNode }) {
  const [all, setAll] = useState(false);
  const shown = all ? gaps : gaps.slice(0, SHOW);
  return (
    <div className="gap-group">
      <div className="gap-group-head">
        <div>
          <h4>{title}</h4>
          <p className="small muted">{hint}</p>
        </div>
        {extra}
      </div>
      <ul className="gap-list">
        {shown.map((g) => (
          <GapRow key={`${g.kind}|${g.moves.join(' ')}|${g.move}`} gap={g} action={render(g)} />
        ))}
      </ul>
      {gaps.length > SHOW && (
        <button className="link" onClick={() => setAll(!all)}>
          {all ? 'Mostra meno' : `Mostra tutti (${gaps.length})`}
        </button>
      )}
    </div>
  );
}

function GapRow({ gap, action }: { gap: Gap; action: ReactNode }) {
  const [open, setOpen] = useState(false);
  const board = useMemo(() => {
    const chess = new Chess(STANDARD_FEN);
    for (const m of gap.moves) chess.move(m);
    const fen = chess.fen();
    const arrows: Arrow[] = [];
    const played = new Chess(fen).move(gap.move);
    arrows.push({ from: played.from, to: played.to, color: PLAYED });
    for (const san of gap.expected) {
      const m = new Chess(fen).move(san);
      arrows.push({ from: m.from, to: m.to, color: BOOK });
    }
    return { fen, arrows };
  }, [gap]);

  const before = formatMoves(gap.moves);
  // Dopo le mosse precedenti la mossa del Nero non ripete il numero ("2.Nf3 d6", non "2.Nf3 2...d6").
  const move = before && gap.moves.length % 2 === 1 ? gap.move : formatMoves([gap.move], gap.moves.length);
  const expected = gap.expected.map((m) => formatMoves([m], gap.moves.length)).join(' o ');

  return (
    <li className="gap-row">
      <div className="gap-main">
        <span className="gap-moves">
          {before && <span className="muted">{before} </span>}
          <strong className={gap.kind === 'uncovered' ? 'gap-opp' : 'gap-mine'}>{move}</strong>
        </span>
        <span className="small muted">
          {gap.myWhite ? 'col Bianco' : 'col Nero'} · {gap.openingName}
          {gap.lineName ? ` — ${gap.lineName}` : ''}
        </span>
        <span className="small">
          {gap.kind === 'deviation' ? <>Il repertorio prevede <strong>{expected}</strong>. </> : null}
          <strong>{gap.games} {gap.games === 1 ? 'partita' : 'partite'}</strong>
          {gap.lost > 0 && <span className="gap-lost"> · {gap.lost} {gap.lost === 1 ? 'persa' : 'perse'}</span>}
        </span>
        <div className="actions">
          {action}
          <button onClick={() => setOpen(!open)} aria-expanded={open}>
            <Icon name="eye" /> {open ? 'Nascondi' : 'Vedi la posizione'}
          </button>
        </div>
      </div>
      {open && (
        <div className="gap-board">
          <Board fen={board.fen} orientation={gap.myWhite ? 'white' : 'black'} arrows={board.arrows} />
          <p className="small muted">
            <span className="gap-legend played" /> giocata nella partita
            {gap.expected.length > 0 && (
              <>
                {' '}· <span className="gap-legend book" /> repertorio
              </>
            )}
          </p>
        </div>
      )}
    </li>
  );
}
