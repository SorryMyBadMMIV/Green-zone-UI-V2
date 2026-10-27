/** Two headline numbers side by side, with an optional line of explanation under them. */
export default function StatPair({ items, note }) {
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3">
        {items.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs text-ink-3">{label}</dt>
            <dd className="mt-0.5 text-xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-2 text-xs text-ink-3">{note}</p>}
    </div>
  );
}
