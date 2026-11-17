import { Fragment, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  BookCheck,
  BookOpen,
  BookX,
  ChartColumn,
  Check,
  ChessKing,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleHelp,
  ClipboardCopy,
  ClipboardPaste,
  CornerDownRight,
  CornerUpLeft,
  Dices,
  Download,
  Eye,
  Flag,
  Flame,
  FolderOpen,
  Gamepad2,
  GraduationCap,
  Lightbulb,
  Microscope,
  OctagonAlert,
  PartyPopper,
  Play,
  Plus,
  Puzzle,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  Settings,
  SkipForward,
  Smartphone,
  Sparkles,
  Star,
  Swords,
  Tag,
  Target,
  TrendingUp,
  TriangleAlert,
  Undo2,
  User,
  Volume2,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Tutte le icone dell'app, da un solo set (Lucide): tratto 2px, angoli arrotondati,
 * colore del testo (currentColor). Così hanno lo stesso stile ovunque e seguono il tema.
 */
const ICONS = {
  course: GraduationCap,
  explore: BookOpen,
  drill: ChessPawn,
  review: Repeat,
  quiz: CircleHelp,
  sim: Gamepad2,
  lab: Microscope,
  knight: ChessKnight,
  king: ChessKing,
  queen: ChessQueen,
  rook: ChessRook,
  puzzle: Puzzle,
  analysis: ChartColumn,
  progress: TrendingUp,
  settings: Settings,
  plus: Plus,
  save: Download,
  folder: FolderOpen,
  hint: Lightbulb,
  check: Check,
  wrong: X,
  close: X,
  offline: WifiOff,
  warning: TriangleAlert,
  sync: RefreshCw,
  user: User,
  search: Search,
  bot: Bot,
  install: Smartphone,
  undo: Undo2,
  party: PartyPopper,
  flame: Flame,
  play: Play,
  first: ChevronFirst,
  prev: ChevronLeft,
  next: ChevronRight,
  last: ChevronLast,
  skip: SkipForward,
  back: CornerUpLeft,
  transpose: CornerDownRight,
  inBook: BookCheck,
  outOfBook: BookX,
  paste: ClipboardPaste,
  copy: ClipboardCopy,
  eye: Eye,
  dice: Dices,
  flag: Flag,
  stalemate: OctagonAlert,
  star: Star,
  sparkles: Sparkles,
  target: Target,
  tag: Tag,
  external: ArrowUpRight,
  sound: Volume2,
  swords: Swords,
  restart: RotateCcw,
  zap: Zap,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  white: Circle,
  black: Circle,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size, className, label }: { name: IconName; size?: number | string; className?: string; label?: string }) {
  const C = ICONS[name];
  const fill = name === 'black' ? 'currentColor' : name === 'star' ? 'currentColor' : 'none';
  return (
    <C
      className={`icon icon-${name}${className ? ` ${className}` : ''}`}
      size={size ?? '1.15em'}
      strokeWidth={2}
      fill={fill}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}

/** Simboli che possono ancora comparire dentro testi (feedback, lezioni): diventano icone. */
const SYMBOLS: Record<string, IconName> = {
  '✓': 'check',
  '✗': 'wrong',
  '⭐': 'star',
  '💡': 'hint',
  '🎉': 'party',
  '🔥': 'flame',
  '😱': 'stalemate',
};
const SYMBOL_RE = new RegExp(`(${Object.keys(SYMBOLS).join('|')})\\s?`, 'gu');

/** Sostituisce i simboli noti in una stringa con le icone corrispondenti. */
export function withIcons(text: string): ReactNode {
  if (!SYMBOL_RE.test(text)) return text;
  SYMBOL_RE.lastIndex = 0;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(SYMBOL_RE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(<Icon key={m.index} name={SYMBOLS[m[1]]} className="icon-inline" />);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}
