export function SectionSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24"
      aria-hidden="true"
    >
      <div className="mx-auto mb-10 h-4 w-24 animate-pulse rounded-full bg-border/60" />
      <div className="mx-auto mb-4 h-10 max-w-lg animate-pulse rounded-lg bg-border/50" />
      <div className="mx-auto h-4 max-w-md animate-pulse rounded bg-border/40" />
    </div>
  );
}
