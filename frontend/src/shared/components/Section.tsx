import type { PropsWithChildren, ReactNode } from "react";

interface SectionProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
}

export function Section({ title, subtitle, meta, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}
