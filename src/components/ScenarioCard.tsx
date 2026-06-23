import { twMerge } from "tailwind-merge";

export interface ScenarioCardProps {
  title?: string;
  body?: string;
  benefit?: string;
  className?: string;
}

// Everyday-life framing for a routine. Keeps abstract number/attention tasks
// grounded in a daily scene (mentoring: prefer "apples at the market" over dry
// arithmetic). Purely text, so state is never color-dependent.
export function ScenarioCard({ title, body, benefit, className }: ScenarioCardProps) {
  if (!title && !body && !benefit) {
    return null;
  }

  return (
    <section
      className={twMerge(
        "rounded-2xl border-2 border-amber-200 bg-amber-50 p-4",
        className,
      )}
      aria-label={title}
    >
      {title && (
        <p className="text-base font-extrabold uppercase tracking-wide text-amber-700">
          {title}
        </p>
      )}
      {body && (
        <p className="mt-1 text-lg font-bold leading-relaxed text-ink">{body}</p>
      )}
      {benefit && (
        <p className="mt-2 text-base font-medium leading-relaxed text-amber-800">
          {benefit}
        </p>
      )}
    </section>
  );
}
