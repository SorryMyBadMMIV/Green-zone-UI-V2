import { useId } from 'react';

/** One of the 4 sidebar cards: a small title and its content. */
export default function Card({ title, children }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="rounded-xl border border-line bg-card px-4 py-3.5">
      <h3 id={titleId} className="mb-2 text-xs font-medium text-ink-2">
        {title}
      </h3>
      {children}
    </section>
  );
}
