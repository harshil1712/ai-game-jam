import { Link, useRouter } from "@tanstack/react-router";
import { CyberButton } from "./CyberButton";
import { HelpModal, useHelpModal } from "./HelpModal";
import { logout } from "../lib/api";

export function AppHeader() {
  const help = useHelpModal();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    await router.invalidate();
    await router.navigate({ to: "/" });
  };

  return (
    <>
      <header className="px-5 py-3 bg-bg-charcoal border-b-2 border-cf-orange">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
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
            <CyberButton
              cyber="ghost"
              variant="secondary"
              size="sm"
              onClick={handleLogout}
              title="Log out"
            >
              LOGOUT
            </CyberButton>
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
