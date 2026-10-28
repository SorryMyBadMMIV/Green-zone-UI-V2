import { X } from 'lucide-react';

/** The Figma-style dark box at the bottom right of the map: bold lines, a × button and optional tags under them. */
export default function MapInfoBox({ label, closeLabel, onClose, tags, children }) {
  return (
    <section
      aria-label={label}
      className="absolute bottom-6 right-3 z-[1000] w-72 max-w-[calc(100%-1.5rem)] rounded-2xl bg-neutral-900/85 px-4 py-3 text-white shadow-lg backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-white/80 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <div className="space-y-0.5 pr-6 text-base font-bold leading-snug">{children}</div>
      {tags && <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">{tags}</div>}
    </section>
  );
}
