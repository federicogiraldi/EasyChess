import { BOARD_THEMES, updateSettings, useSettings, type Settings } from '../core/settings';
import { Icon } from '../components/Icon';
import { playSound, type SoundName } from '../core/sound';
import { Board } from '../components/Board';
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
              <span className="setting-label">Animazione dei pezzi</span>
              <Choice
                label="Animazione dei pezzi"
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
