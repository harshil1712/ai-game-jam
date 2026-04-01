import type { ReactNode } from "react";

interface AppHeaderProps {
  title: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function AppHeader({ title, badge, actions }: AppHeaderProps) {
  return (
    <header className="px-5 py-3 bg-bg-charcoal border-b-2 border-cf-orange">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white font-display text-glow-cyan tracking-widest uppercase">
            {title}
          </h1>
          {badge}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
