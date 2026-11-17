import type { BoardProps } from '../components/Board';

/**
 * Scacchiera finta per i test dei componenti: la vera (react-chessboard) ha bisogno di misure e
 * trascinamenti che jsdom non ha. Mostra la FEN e lascia ai test le props, per "giocare" con onMove.
 */
export const fakeBoard: { props?: BoardProps } = {};

export function FakeBoard(props: BoardProps) {
  fakeBoard.props = props;
  return <div data-testid="board" data-fen={props.fen} />;
}
