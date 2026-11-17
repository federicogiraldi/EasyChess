// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseOpening } from '../core/pgnToTree';
import { replaceCards } from '../core/progress';
import { fakeBoard } from '../test/fakeBoard';
import { Drill } from './Drill';

vi.mock('../components/Board', async () => ({ Board: (await import('../test/fakeBoard')).FakeBoard }));

const OPENING = parseOpening(
  `[Opening "Test Bianco"]
[Color "white"]
[Id "test-white"]

1. e4 { [%line Base] } e5 2. Nf3 Nc6 3. Bc4 *`,
  'test-white',
);

const play = (from: string, to: string) => act(() => void fakeBoard.props!.onMove!(from, to));
const opponentReplies = () => act(() => void vi.advanceTimersByTime(500));

describe('Allenamento', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    replaceCards({});
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('una mossa giusta va avanti e conta come risposta giusta', () => {
    render(<Drill opening={OPENING} />);
    play('e2', 'e4');
    expect(screen.getByText(/✓|e4/, { selector: '.feedback, .feedback *' })).toBeTruthy();
    expect(document.querySelector('.feedback')!.className).toContain('ok');
    opponentReplies();
    expect(screen.getByTestId('board').dataset.fen).toContain('4p3/4P3');
    expect(document.querySelector('.stats-row')!.textContent).toMatch(/^\s*1/);
  });

  it('una mossa sbagliata mostra quella giusta e il pulsante "Perché"', () => {
    render(<Drill opening={OPENING} />);
    play('d2', 'd4');
    const feedback = document.querySelector('.feedback')!;
    expect(feedback.className).toContain('wrong');
    expect(feedback.textContent).toContain('d4 non è nel repertorio');
    expect(feedback.textContent).toContain('e4');
    expect(screen.getByRole('button', { name: /Perché/ })).toBeTruthy();
    // la freccia indica la mossa giusta
    expect(fakeBoard.props!.arrows).toEqual([expect.objectContaining({ from: 'e2', to: 'e4' })]);
    // la scacchiera non si muove
    expect(screen.getByTestId('board').dataset.fen).toBe(OPENING.root.fen);
  });

  it('a fine linea propone la prossima', () => {
    render(<Drill opening={OPENING} />);
    play('e2', 'e4');
    opponentReplies();
    play('g1', 'f3');
    opponentReplies();
    play('f1', 'c4');
    expect(document.querySelector('.feedback')!.textContent).toContain('Linea completata');
    fireEvent.click(screen.getByRole('button', { name: /Prossima linea/ }));
    expect(screen.getByTestId('board').dataset.fen).toBe(OPENING.root.fen);
  });
});
