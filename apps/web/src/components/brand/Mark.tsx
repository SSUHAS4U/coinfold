"use client";

/**
 * The Coinfold mark: a coin seen mid-fold.
 *
 * Two arcs on one centre — a disc that has been creased — so the name is
 * legible in the shape itself. Drawn rather than imported, so it inherits the
 * accent gradient, needs no network request, and stays sharp at any size.
 *
 * The gradient id is suffixed per instance: two marks on one page sharing an
 * id makes the second one render with the first one's fill.
 */
export function Mark({ size = 22, id = "brand" }: { size?: number; id?: string }) {
  const gradientId = `mark-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>

      <circle cx="12" cy="12" r="9.5" fill={`url(#${gradientId})`} opacity="0.16" />
      <path
        d="M12 2.5a9.5 9.5 0 0 1 0 19c-3.5 0-5.3-4.25-5.3-9.5S8.5 2.5 12 2.5Z"
        fill={`url(#${gradientId})`}
      />
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  );
}
