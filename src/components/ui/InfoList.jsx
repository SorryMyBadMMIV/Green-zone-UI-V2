/** Label / value rows for the Info card. `rows` is a list of [label, value] pairs. */
export default function InfoList({ rows }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-1.5">
          <dt className="shrink-0 text-ink-3">{label}</dt>
          <dd className="text-right text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
