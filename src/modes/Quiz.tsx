import type { Opening } from '../model/types';
import { PositionTrainer } from './PositionTrainer';

export function Quiz({ opening }: { opening: Opening }) {
  return <PositionTrainer opening={opening} mode="quiz" />;
}
