import { useState, type FormEvent } from 'react';
import { signIn, signOut, signUp, syncNow, useSync, type SyncStatus } from '../core/sync';

const STATUS: Record<SyncStatus, string> = {
  off: '',
  syncing: '⟳ Sincronizzo…',
  ok: '✓ Sincronizzato',
  offline: '⏸ Offline: sincronizzo appena torna la rete',
  error: '⚠ Sincronizzazione non riuscita, riprovo più tardi',
};

/** Pulsante account nella barra in alto + finestra di accesso. */
export function Account() {
  const { session, status } = useSync();
  const [open, setOpen] = useState(false);
  const email = session?.user.email;

  return (
    <>
      <button className="account-btn" onClick={() => setOpen(true)} title={email ?? 'Accedi per sincronizzare i progressi'}>
        {session ? (
          <>
            <span className="avatar">{email?.[0]?.toUpperCase() ?? '?'}</span>
            {status === 'syncing' ? '⟳' : status === 'offline' ? '⏸' : status === 'error' ? '⚠' : ''}
          </>
        ) : (
          '👤 Accedi'
        )}
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close link" onClick={() => setOpen(false)} aria-label="Chiudi">
              ✕
            </button>
            {session ? <SignedIn email={email ?? ''} status={status} onDone={() => setOpen(false)} /> : <SignInForm onDone={() => setOpen(false)} />}
          </div>
        </div>
      )}
    </>
  );
}

function SignedIn({ email, status, onDone }: { email: string; status: SyncStatus; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <h2>Il tuo account</h2>
      <p>
        Accesso fatto come <strong>{email}</strong>.
      </p>
      <p className="muted small">
        I progressi si salvano sempre su questo dispositivo e si sincronizzano con l'account quando c'è internet: puoi
        giocare anche offline. {STATUS[status]}
      </p>
      <div className="actions">
        <button className="primary" disabled={busy || status === 'syncing'} onClick={() => void syncNow()}>
          ⟳ Sincronizza ora
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut();
            setBusy(false);
            onDone();
          }}
        >
          Esci
        </button>
      </div>
    </>
  );
}

function SignInForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (res === null) onDone();
    else if (res === 'confirm') setMsg('Account creato: apri la mail di conferma, poi torna qui e accedi.');
    else setMsg(res);
  };

  return (
    <form onSubmit={submit} className="auth-form">
      <h2>{mode === 'in' ? 'Accedi' : 'Crea un account'}</h2>
      <p className="muted small">
        Con un account i progressi sono uguali su tutti i tuoi dispositivi (iPad, telefono, PC). L'app funziona anche
        senza: i dati di questo dispositivo vengono uniti all'account al primo accesso.
      </p>
      <label>
        Email
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {msg && <p className="auth-msg">{msg}</p>}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? '…' : mode === 'in' ? 'Accedi' : 'Crea account'}
      </button>
      <button type="button" className="link" onClick={() => (setMode(mode === 'in' ? 'up' : 'in'), setMsg(null))}>
        {mode === 'in' ? 'Non hai un account? Creane uno' : 'Hai già un account? Accedi'}
      </button>
    </form>
  );
}
