import { RefreshCw, TriangleAlert } from 'lucide-react';
import { API_URL, USING_MOCK_DATA } from '../../config.js';
import { COLORS } from '../../lib/constants.js';

/** Shown when the zone data can't be loaded: what to check, the exact reason, and Retry. */
export default function ErrorCard({ error, onRetry }) {
  const hint = USING_MOCK_DATA
    ? "The app couldn't load its example data."
    : `Check that the backend at ${API_URL} is running, then try again.`;
  return (
    <section role="alert" className="rounded-xl border border-line bg-card px-4 py-4">
      <p className="flex items-center gap-2 font-medium text-ink">
        <TriangleAlert size={18} color={COLORS.warning} aria-hidden="true" />
        Couldn't load zone data
      </p>
      <p className="mt-1 text-sm text-ink-2">{hint}</p>
      {error?.message && <p className="mt-2 break-words text-xs text-ink-3">{error.message}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-ink hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <RefreshCw size={14} aria-hidden="true" />
        Retry
      </button>
    </section>
  );
}
