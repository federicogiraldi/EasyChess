import { useState } from 'react';
import { Icon } from '../components/Icon';
import type { Opening } from '../model/types';
import { detectMyColor, loadLibrary, loadUsername, removeFromLibrary, saveToLibrary, saveUsername, type AnalyzedGame, type ImportedGame } from '../core/analysis';
import { engine } from '../engine/stockfish';
import { RepertoireGaps } from '../components/RepertoireGaps';
import { ChessComImport, Library, PgnImport } from './analysis/ImportPanels';
import { GameAnalysis, type OpenMode } from './analysis/GameAnalysis';
import './simulator.css';
import './analysis.css';

interface Props {
  openings: Opening[];
  /** Apre il Laboratorio / il Simulatore di un'apertura del repertorio da questa sequenza di mosse. */
  onOpenMode: OpenMode;
}

/** Analisi: importa le tue partite (chess.com o PGN) e analizzale con Stockfish. */
export function Analysis({ openings, onOpenMode }: Props) {
  const [game, setGame] = useState<AnalyzedGame | null>(null);
  const [library, setLibrary] = useState<AnalyzedGame[]>(loadLibrary);
  const [username, setUsername] = useState(loadUsername);

  const open = (g: ImportedGame | AnalyzedGame) => {
    const saved = library.find((x) => x.id === g.id);
    const myWhite = saved?.myWhite ?? ('myWhite' in g ? g.myWhite : undefined) ?? detectMyColor(g, username);
    setGame({ ...g, ...saved, myWhite });
    window.scrollTo({ top: 0 });
  };

  if (game) {
    return (
      <GameAnalysis
        key={game.id}
        game={game}
        openings={openings}
        onChange={(g) => {
          setGame(g);
          setLibrary(saveToLibrary(g));
        }}
        onBack={() => {
          engine.cancelAll();
          setGame(null);
        }}
        onOpenMode={onOpenMode}
      />
    );
  }

  return (
    <div className="analysis-home">
      <section className="hero">
        <h1><Icon name="analysis" /> Analisi delle partite</h1>
        <p className="muted">
          Carica le tue partite di chess.com (o qualsiasi PGN) e Stockfish le analizza: precisione, errori, mosse migliori e il
          confronto con il tuo repertorio.
        </p>
      </section>
      <div className="analysis-grid">
        <ChessComImport
          username={username}
          onUsername={(u) => {
            setUsername(u);
            saveUsername(u);
          }}
          library={library}
          onOpen={open}
        />
        <PgnImport onOpen={open} />
      </div>
      <RepertoireGaps openings={openings} library={library} username={username} onOpenLab={(id, moves) => onOpenMode(id, 'lab', moves)} />
      <Library
        games={library}
        onOpen={open}
        onRemove={(id) => setLibrary(removeFromLibrary(id))}
      />
    </div>
  );
}
