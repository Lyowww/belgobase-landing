export function AnimatedGrid() {
  return (
    <div className="animated-grid pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="animated-grid-inner absolute inset-0 opacity-40" />
    </div>
  );
}

export function AmbientGlow({
  className,
  color = "accent",
}: {
  className?: string;
  color?: "accent" | "primary";
}) {
  return (
    <div
      className={`ambient-glow pointer-events-none absolute rounded-full blur-[100px] ${
        color === "accent" ? "bg-accent/10" : "bg-primary/10"
      } ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
