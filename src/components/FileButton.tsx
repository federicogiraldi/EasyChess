import { useRef, type ChangeEvent, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  className?: string;
}

/** Pulsante che apre la scelta di un file: un vero <button>, quindi raggiungibile da tastiera e screen reader. */
export function FileButton({ children, onFile, accept, className }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input ref={input} type="file" accept={accept} onChange={onFile} hidden tabIndex={-1} />
    </>
  );
}
