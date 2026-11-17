import { describe, expect, it } from 'vitest';

/**
 * Regole sulle dipendenze tra i moduli: la logica (core, engine, model) non importa mai la grafica
 * (components, modes) e non ci sono cicli di import. Gli import di soli tipi non contano: spariscono
 * in compilazione.
 */
const raw = import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;
/** Percorsi relativi a src, es. "core/training.ts". */
const sources = new Map(Object.entries(raw).map(([k, v]) => [k.slice(2), v]));

function resolvePath(fromFile: string, spec: string): string {
  const parts = fromFile.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function resolveImport(from: string, spec: string): string | undefined {
  if (!spec.startsWith('.')) return undefined;
  const base = resolvePath(from, spec);
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((ext) => base + ext).find((f) => sources.has(f));
}

/** Import che restano a runtime: si scartano `import type` e gli import con solo `type X` tra le graffe. */
function runtimeImports(file: string, src: string): string[] {
  const out: string[] = [];
  const re = /^(?:import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
  for (const m of src.matchAll(re)) {
    if (m[1]) continue;
    const names = m[2].match(/\{([\s\S]*)\}/)?.[1];
    if (names && names.split(',').every((n: string) => !n.trim() || n.trim().startsWith('type '))) continue;
    const target = resolveImport(file, m[3]);
    if (target) out.push(target);
  }
  return out;
}

const graph = new Map<string, string[]>([...sources].map(([f, src]) => [f, runtimeImports(f, src)]));
const rel = (f: string) => f;

function cycles(): string[][] {
  const found: string[][] = [];
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const visit = (f: string) => {
    state.set(f, 'open');
    stack.push(f);
    for (const t of graph.get(f) ?? []) {
      if (state.get(t) === 'open') found.push([...stack.slice(stack.indexOf(t)), t].map(rel));
      else if (!state.has(t)) visit(t);
    }
    stack.pop();
    state.set(f, 'done');
  };
  for (const f of graph.keys()) if (!state.has(f)) visit(f);
  return found;
}

describe('architettura', () => {
  it('non ci sono cicli di import', () => {
    expect(cycles().map((c) => c.join(' → '))).toEqual([]);
  });

  it('la logica non importa la grafica', () => {
    const bad = [...graph]
      .filter(([f]) => /^(core|engine|model)\//.test(rel(f)))
      .flatMap(([f, deps]) => deps.filter((d) => /^(components|modes)\//.test(rel(d))).map((d) => `${rel(f)} → ${rel(d)}`));
    expect(bad).toEqual([]);
  });
});
