import { createClient, type Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { applyResets, mergeValue } from './merge';
import { getStamps, isSyncedKey, load, localKeys, onSave, setStamp, write } from './storage';
import { reloadCards } from './progress';

/**
 * Account e sincronizzazione dei progressi fra dispositivi (Supabase, piano gratuito).
 *
 * L'app resta "prima locale": legge e scrive sempre in localStorage e funziona offline.
 * Con l'accesso fatto, quando c'è rete scarica i dati dell'account, li unisce a quelli locali
 * (vedi merge.ts) e invia le modifiche. Ogni account vede solo le proprie righe (RLS sul database).
 */

// Chiave pubblica: è fatta per stare nel codice del sito, la sicurezza è nelle regole del database.
const SUPABASE_URL = 'https://qiakcpnjuqtdeoyezpea.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dlm9l7zb-NXdeMOOfAt0BA_lACAcy1M';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'offline' | 'error';

interface State {
  session: Session | null;
  status: SyncStatus;
  lastSync: number | null;
  /** Sono arrivati dati da un altro dispositivo mentre l'app era aperta. */
  updatedFromRemote: boolean;
}

let state: State = { session: null, status: 'off', lastSync: null, updatedFromRemote: false };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSync(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

let running: Promise<boolean> | null = null;
let again = false;

/** Sincronizza adesso. Restituisce true se sono cambiati dati locali. */
export function syncNow(): Promise<boolean> {
  if (running) {
    again = true;
    return running;
  }
  running = doSync().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

async function doSync(): Promise<boolean> {
  const user = state.session?.user;
  if (!user) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    set({ status: 'offline' });
    return false;
  }
  set({ status: 'syncing' });
  try {
    const { data, error } = await supabase.from('user_data').select('key, value, updated_at');
    if (error) throw error;

    const stamps = getStamps();
    const remote = new Map((data ?? []).map((r) => [r.key as string, { value: r.value as unknown, at: Number(r.updated_at) }]));
    const keys = new Set([...localKeys().filter(isSyncedKey), ...remote.keys()]);
    const upserts: { key: string; value: unknown; updated_at: number }[] = [];
    let changedLocal = false;
    const now = Date.now();

    for (const key of keys) {
      const r = remote.get(key);
      const localValue = load<unknown>(key, undefined);
      const localAt = stamps[key] ?? 0;
      let merged = mergeValue(key, localValue, localAt, r?.value, r?.at ?? 0);
      if (key === 'cards') {
        const resets = mergeValue('cards:resets', load('cards:resets', undefined), 0, remote.get('cards:resets')?.value, 0);
        if (resets) merged = applyResets(merged as never, resets as Record<string, number>);
      }
      const json = JSON.stringify(merged);
      const sameAsLocal = json === JSON.stringify(localValue);
      const sameAsRemote = r !== undefined && json === JSON.stringify(r.value);
      if (!sameAsLocal) {
        write(key, merged);
        changedLocal = true;
      }
      if (!sameAsRemote) {
        upserts.push({ key, value: merged, updated_at: now });
        setStamp(key, now);
      } else if (r) {
        setStamp(key, r.at);
      }
    }

    if (upserts.length) {
      const { error: upErr } = await supabase.from('user_data').upsert(upserts, { onConflict: 'user_id,key' });
      if (upErr) throw upErr;
    }
    if (changedLocal) reloadCards();
    set({ status: 'ok', lastSync: Date.now(), updatedFromRemote: state.updatedFromRemote || changedLocal });
    return changedLocal;
  } catch {
    set({ status: navigator.onLine === false ? 'offline' : 'error' });
    return false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync() {
  if (!state.session) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), 3000);
}

/**
 * Da chiamare prima di mostrare l'app: recupera la sessione e, se c'è rete, sincronizza
 * (al massimo per qualche secondo, poi l'app parte comunque con i dati locali).
 */
export async function initSync(timeoutMs = 3000): Promise<void> {
  const { data } = await supabase.auth.getSession();
  set({ session: data.session, status: data.session ? 'ok' : 'off' });

  supabase.auth.onAuthStateChange((_event, session) => {
    const wasIn = !!state.session;
    set({ session, status: session ? state.status : 'off' });
    if (session && !wasIn) void syncNow();
  });
  onSave(scheduleSync);
  window.addEventListener('online', () => void syncNow());
  // Tornando sull'app (es. dopo aver giocato sull'altro dispositivo) scarica le novità.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void syncNow().then((changed) => {
        if (changed) window.location.reload();
      });
    } else if (timer) {
      clearTimeout(timer);
      void syncNow();
    }
  });

  if (data.session) {
    await Promise.race([syncNow(), new Promise((r) => setTimeout(r, timeoutMs))]);
    set({ updatedFromRemote: false });
  }
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? translate(error.message) : null;
}

/** Restituisce un messaggio d'errore, oppure null se l'account è pronto (o 'confirm' se serve confermare la mail). */
export async function signUp(email: string, password: string): Promise<string | null | 'confirm'> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return translate(error.message);
  return data.session ? null : 'confirm';
}

/** Esce dall'account: i progressi restano su questo dispositivo. */
export async function signOut(): Promise<void> {
  await syncNow();
  await supabase.auth.signOut({ scope: 'local' });
}

function translate(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email o password sbagliate.';
  if (/already registered/i.test(msg)) return 'Esiste già un account con questa email: usa "Accedi".';
  if (/password should be at least/i.test(msg)) return 'La password deve avere almeno 6 caratteri.';
  if (/email not confirmed/i.test(msg)) return 'Devi prima confermare la mail (controlla la posta).';
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(msg)) return 'Email non valida (o registrazioni non ancora abilitate).';
  if (/rate limit/i.test(msg)) return 'Troppi tentativi: riprova fra qualche minuto.';
  if (/fetch|network/i.test(msg)) return 'Serve la connessione a internet per accedere.';
  return msg;
}
