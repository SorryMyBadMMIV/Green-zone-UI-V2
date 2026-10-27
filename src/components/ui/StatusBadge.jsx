import { CircleCheck, CircleQuestionMark, OctagonAlert, TriangleAlert } from 'lucide-react';

const ICONS = { good: CircleCheck, warning: TriangleAlert, critical: OctagonAlert, none: CircleQuestionMark };

/** Status as icon + word + color together, never color alone. */
export default function StatusBadge({ status }) {
  const Icon = ICONS[status.level] ?? CircleQuestionMark;
  return (
    <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink">
      <Icon size={16} color={status.color} aria-hidden="true" />
      {status.label}
    </p>
  );
}
