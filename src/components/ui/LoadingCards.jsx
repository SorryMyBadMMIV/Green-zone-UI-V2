const HEIGHTS = [190, 104, 128, 140];

/** Grey placeholder cards shown while the zone data loads. */
export default function LoadingCards() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading zone data">
      {HEIGHTS.map((height) => (
        <div key={height} className="animate-pulse rounded-xl border border-line bg-card" style={{ height }} />
      ))}
    </div>
  );
}
