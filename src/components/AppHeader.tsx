import { Link } from "@tanstack/react-router";
import { CyberButton } from "./CyberButton";
import { CyberLinkButton } from "./CyberButton";
import { HelpModal, useHelpModal } from "./HelpModal";

export function AppHeader() {
  const help = useHelpModal();

  return (
    <>
      <header className="px-5 py-3 bg-surface border-b-2 border-accent">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/chat">
              <h1 className="text-2xl font-bold text-white font-display text-glow-cyan tracking-widest uppercase hover:text-cf-orange transition-colors">
                AI GAME JAM
              </h1>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/gallery">
              <CyberButton variant="secondary" size="sm">
                GALLERY
              </CyberButton>
            </Link>
            <CyberLinkButton
              cyber="ghost"
              variant="secondary"
              size="sm"
              href="/api/logout"
              title="Log out"
            >
              LOGOUT
            </CyberLinkButton>
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
