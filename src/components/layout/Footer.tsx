export function Footer() {
  return (
    <footer className="border-t border-border bg-white py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <span className="text-xs font-bold text-white">B</span>
          </div>
          <span className="text-sm font-semibold text-deep-navy">BelgoBase</span>
        </div>
        <p className="text-sm text-muted">
          Official Belgian company data · GDPR-safe · Belgium-only
        </p>
        <p className="text-sm text-muted">
          © {new Date().getFullYear()} BelgoBase. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
