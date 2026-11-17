import { useState } from 'react';
import { BOARD_THEMES, updateSettings, useSettings, type Settings } from '../core/settings';
import { Icon } from '../components/Icon';
import { playSound, type SoundName } from '../core/sound';
import { Board } from '../components/Board';
import { engine, getEngineLevel, setEngineLevel, type EngineLevel } from '../engine/stockfish';
import './settings.css';

const PREVIEW_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TRY_SOUNDS: { id: SoundName; label: string }[] = [
  { id: 'move', label: 'Mossa' },
  { id: 'capture', label: 'Cattura' },
  { id: 'check', label: 'Scacco' },
  { id: 'wrong', label: 'Errore' },
  { id: 'success', label: 'Problema risolto' },
];

const ENGINE_TEXT: Record<EngineLevel, string> = {
  fast: 'Risposte in un attimo, ma nelle posizioni tattiche può sbagliare valutazione.',
  balanced: 'Il compromesso di sempre: motore leggero (7 MB) a profondità 18.',
  max: "Stockfish 17.1 completo, con la rete neurale grande, a profondità 20: non si perde un colpo, ma scarica circa 80 MB la prima volta (poi funziona offline) e ogni spiegazione richiede più tempo: qualche secondo sul PC, anche 10–15 secondi su iPad e telefono.",
};

/** Precisione di Stockfish: vale solo per questo dispositivo (il motore completo è un download grosso). */
function EngineSetting() {
  const [level, setLevel] = useState(getEngineLevel);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const choose = (next: EngineLevel) => {
    setLevel(next);
    setEngineLevel(next);
    if (next !== 'max') return setStatus('idle');
    setStatus('loading');
    engine.warmup().then(
      () => setStatus(engine.usingBuild === 'full' ? 'ready' : 'failed'),
      () => setStatus('failed'),
    );
  };
  return (
    <section className="panel-block">
      <h2>Analisi di Stockfish</h2>
      <div className="setting">
        <span className="setting-label">Precisione</span>
        <Choice
          label="Precisione di Stockfish"
          value={level}
          onChange={choose}
          options={[
            { id: 'fast', label: 'Veloce' },
            { id: 'balanced', label: 'Bilanciata' },
            { id: 'max', label: 'Massima' },
          ]}
        />
        <span className="muted small">{ENGINE_TEXT[level]}</span>
        {status === 'loading' && <span className="small"><Icon name="sync" className="spin" /> Scarico e avvio Stockfish completo…</span>}
        {status === 'ready' && <span className="small"><Icon name="check" /> Stockfish completo pronto.</span>}
        {status === 'failed' && (
          <span className="small">
            <Icon name="warning" /> Questo dispositivo non è riuscito ad avviare Stockfish completo (memoria o rete): per ora uso quello leggero alla massima profondità.
          </span>
        )}
        <span className="muted small">Vale per spiegazioni, Laboratorio, analisi delle partite e coach. Si imposta separatamente su ogni dispositivo.</span>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const s = useSettings();
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  return (
    <div className="settings-page">
      <section className="hero">
        <h1>Impostazioni</h1>
        <p className="muted">Si salvano da sole e, se hai fatto l'accesso, valgono su tutti i tuoi dispositivi.</p>
      </section>

      <div className="settings-layout">
        <div className="settings-list">
          <section className="panel-block">
            <h2>Scacchiera</h2>
            <div className="setting">
              <span className="setting-label">Colori</span>
              <div className="board-themes" role="radiogroup" aria-label="Colori della scacchiera">
                {BOARD_THEMES.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={s.boardTheme === t.id}
                    className={`board-theme${s.boardTheme === t.id ? ' active' : ''}`}
                    onClick={() => set({ boardTheme: t.id })}
                  >
                    <span className="swatch" aria-hidden>
                      {[t.light, t.dark, t.dark, t.light].map((c, i) => (
                        <span key={i} style={{ background: c }} />
                      ))}
                    </span>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <label className="setting toggle-row">
              <span>
                <span className="setting-label">Coordinate</span>
                <span className="muted small">Lettere e numeri ai bordi della scacchiera</span>
              </span>
              <input type="checkbox" checked={s.coordinates} onChange={(e) => set({ coordinates: e.target.checked })} />
            </label>
            <div className="setting">
              <span className="setting-label">Animazioni</span>
              <span className="muted small">Pezzi che si muovono, risposte giuste e sbagliate, cambi di pagina. Con "Nessuna" restano ferme anche quelle dell'interfaccia.</span>
              <Choice
                label="Animazioni"
                value={s.animation}
                onChange={(animation) => set({ animation })}
                options={[
                  { id: 'normal', label: 'Normale' },
                  { id: 'fast', label: 'Veloce' },
                  { id: 'off', label: 'Nessuna' },
                ]}
              />
            </div>
          </section>

          <section className="panel-block">
            <h2>Suoni</h2>
            <label className="setting toggle-row">
              <span>
                <span className="setting-label">Suoni attivi</span>
                <span className="muted small">Mosse, catture, scacchi, errori e problemi risolti</span>
              </span>
              <input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} />
            </label>
            <label className={`setting${s.sound ? '' : ' disabled'}`}>
              <span className="setting-label">Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.volume}
                disabled={!s.sound}
                onChange={(e) => set({ volume: Number(e.target.value) })}
                onPointerUp={() => playSound('move')}
                onKeyUp={() => playSound('move')}
              />
            </label>
            <div className="setting">
              <span className="setting-label">Prova</span>
              <div className="actions">
                {TRY_SOUNDS.map((t) => (
                  <button key={t.id} disabled={!s.sound} onClick={() => playSound(t.id)}>
                    <Icon name="sound" /> {t.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <EngineSetting />

          <section className="panel-block">
            <h2>Aspetto</h2>
            <div className="setting">
              <span className="setting-label">Tema</span>
              <Choice
                label="Tema"
                value={s.theme}
                onChange={(theme) => set({ theme })}
                options={[
                  { id: 'auto', label: 'Come il sistema' },
                  { id: 'light', label: 'Chiaro' },
                  { id: 'dark', label: 'Scuro' },
                ]}
              />
            </div>
          </section>
        </div>

        <aside className="settings-preview" aria-label="Anteprima">
          <span className="setting-label">Anteprima</span>
          <Board fen={PREVIEW_FEN} orientation="white" lastMove={{ from: 'f1', to: 'c4' }} arrows={[{ from: 'c4', to: 'f7', color: 'rgba(21, 128, 61, 0.85)' }]} />
        </aside>
      </div>
    </div>
  );
}
