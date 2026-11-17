// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseOpening } from '../core/pgnToTree';
import { getCard, replaceCards } from '../core/progress';
import { cardPositions } from '../core/tree';
import { fakeBoard } from '../test/fakeBoard';
import { Review } from './Review';

vi.mock('../components/Board', async () => ({ Board: (await import('../test/fakeBoard')).FakeBoard }));

const OPENING = parseOpening(
  `[Opening "Test Nero"]
[Color "black"]
[Id "test-black"]

1. e4 c6 2. d4 d5 *`,
  'test-black',
);

const play = (from: string, to: string) => act(() => void fakeBoard.props!.onMove!(from, to));
const feedback = () => document.querySelector('.feedback')!;

describe('Ripasso', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceCards({});
  });
  afterEach(cleanup);

  it('chiede le posizioni nuove una alla volta', () => {
    render(<Review opening={OPENING} />);
    expect(screen.getByText('Da fare: 2')).toBeTruthy();
    expect(screen.getByText('Nuova')).toBeTruthy();
    expect(feedback().textContent).toContain('Trova la mossa');
  });

  it('risposta giusta: scheda salvata e si passa alla prossima', () => {
    render(<Review opening={OPENING} />);
    play('c7', 'c6');
    expect(feedback().className).toContain('ok');
    const [first] = cardPositions(OPENING);
    expect(getCard(first.key)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
    expect(screen.getByText('Da fare: 1')).toBeTruthy();
    expect(feedback().textContent).toContain('Trova la mossa');
  });

  it('risposta sbagliata: mostra la giusta e la posizione torna in coda', () => {
    render(<Review opening={OPENING} />);
    play('e7', 'e5');
    expect(feedback().className).toContain('wrong');
    expect(feedback().textContent).toContain('e5 non è nel repertorio');
    expect(fakeBoard.props!.arrows).toEqual([expect.objectContaining({ from: 'c7', to: 'c6' })]);
    // la posizione sbagliata torna in fondo: ora le domande sono 3
    expect(screen.getByText('Da fare: 3')).toBeTruthy();
    // si può ancora giocare la mossa giusta, ma non conta come risposta giusta
    play('c7', 'c6');
    expect(feedback().className).toContain('ok');
    expect(document.querySelector('.stats-row')!.textContent).toContain('0');
  });

  it('finite le domande, riepilogo della sessione', () => {
    render(<Review opening={OPENING} />);
    play('c7', 'c6');
    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
    play('d7', 'd5');
    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
    expect(screen.getByText('Sessione completata!')).toBeTruthy();
    expect(document.querySelector('.session-end')!.textContent).toContain('Risposte giuste al primo colpo: 2');
  });
});
