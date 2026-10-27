import { X } from 'lucide-react';

/** Top of a zone panel: type pill, zone name, subtitle and a close (×) button. */
export default function PanelHeader({ pill, pillColor, pillBg, title, subtitle, onClose }) {
  return (
    <header className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <span className="inline-block rounded-md px-2 py-0.5 text-xs" style={{ color: pillColor, background: pillBg }}>
          {pill}
        </span>
        <h2 className="mt-2 text-xl font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink-3">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close and show the overview"
        title="Close (Esc)"
        className="rounded-lg p-1.5 text-ink-2 hover:bg-white/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-white"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </header>
  );
}
