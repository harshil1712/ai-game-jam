import type { ReactNode } from "react";
import { CyberButton } from "./CyberButton";
import { HelpModal, useHelpModal } from "./HelpModal";

interface AppHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function AppHeader({ title, actions }: AppHeaderProps) {
  const help = useHelpModal();

  return (
    <>
      <header className="px-5 py-3 bg-surface border-b-2 border-accent">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/cf-logo.svg" alt="Cloudflare" className="h-6 sm:h-8" />
            <h1 className="text-lg sm:text-2xl font-bold text-primary font-display text-glow-cyan tracking-normal sm:tracking-widest uppercase">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <CyberButton
              cyber="ghost"
              shape="square"
              aria-label="Help & resources"
              onClick={help.open}
              className="w-6 h-6 text-xs font-bold"
              title="Help & Resources"
            >
              ?
            </CyberButton>
          </div>
        </div>
      </header>

      <HelpModal isOpen={help.isOpen} onClose={help.close} />
    </>
  );
}
