import type { Opening } from '../model/types';
import { PositionTrainer } from './PositionTrainer';

export function Review({ opening }: { opening: Opening }) {
  return <PositionTrainer opening={opening} mode="review" />;
}
