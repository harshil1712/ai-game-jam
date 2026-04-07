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
      <header className="px-5 py-3 bg-bg-charcoal border-b-2 border-cf-orange">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white font-display text-glow-cyan tracking-widest uppercase">
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
              className="w-9 h-9 text-sm font-bold"
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
