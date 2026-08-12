import type { ReactNode } from 'react';
import './employeeAuth.css';

type Props = {
  titleId: string;
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
};

/** Shared chrome for the two Employee Access screens (sign-in and
 * dual-role workspace select) — same card, same brand mark, same
 * kicker/title/lede rhythm either way. */
export function EmployeeAuthShell({ titleId, kicker, title, lede, children }: Props) {
  return (
    <div className="employee-auth-bg flex min-h-screen items-center justify-center overflow-auto p-3 sm:p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <section
          aria-labelledby={titleId}
          className="max-h-[calc(100vh-2rem)] w-full overflow-auto rounded-2xl border border-[var(--aida-caramel)]/40 bg-white/90 p-5 shadow-xl sm:p-8"
        >
          <p className="text-center font-brand text-4xl text-[var(--aida-floral-pink)]">Aida Cafe</p>
          <p className="mt-1 text-center text-xs font-bold uppercase tracking-widest text-[var(--aida-gold)]">
            {kicker}
          </p>
          <h1 id={titleId} className="mt-3 text-center text-2xl font-bold text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">{lede}</p>
          <div className="mt-6 flex flex-col gap-4">{children}</div>
        </section>
      </div>
    </div>
  );
}
