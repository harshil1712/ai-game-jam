import { useState } from "react";
import type React from "react";
import { CyberButton } from "./CyberButton";
import { CyberSurface } from "./CyberSurface";

const GITHUB_REPO = "https://github.com/harshil1712/ai-game-jam";

const RESOURCES = [
  {
    category: "CORE_PRIMITIVES",
    items: [
      {
        label: "Dynamic Workers (Worker Loaders)",
        description: "Run AI-generated code in isolated sandboxes",
        url: "https://developers.cloudflare.com/dynamic-workers/"
      },
      {
        label: "Agents SDK",
        description: "Build stateful AI agents on Cloudflare Workers",
        url: "https://developers.cloudflare.com/agents/"
      }
    ]
  },
  {
    category: "CLOUDFLARE_PRODUCTS",
    items: [
      {
        label: "Workers AI",
        description: "Run AI models at the edge, no API key needed",
        url: "https://developers.cloudflare.com/workers-ai/"
      },
      {
        label: "D1",
        description: "Serverless SQLite at the edge",
        url: "https://developers.cloudflare.com/d1/"
      },
      {
        label: "Durable Objects",
        description: "Stateful, globally consistent Workers",
        url: "https://developers.cloudflare.com/durable-objects/"
      }
    ]
  }
];

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — intentionally dark in both themes to dim the page behind the modal */}
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm w-full cursor-default"
        onClick={onClose}
      />

      {/* Modal */}
      <CyberSurface
        className="relative z-10 w-full max-w-lg border-2 border-accent shadow-brutalist-cyan p-0 overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-card border-b-2 border-accent flex items-center justify-between">
          <h2 className="text-lg font-bold text-accent font-display tracking-widest uppercase text-glow-cyan">
            [BUILD_YOUR_OWN]
          </h2>
          <CyberButton
            cyber="ghost"
            shape="square"
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 text-xs"
          >
            ✕
          </CyberButton>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* GitHub Repo */}
          <div>
            <p className="text-muted font-mono text-xs uppercase tracking-wider mb-3">
              {">"} SOURCE_CODE
            </p>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-card border-2 border-muted hover:border-[var(--cf-orange)] hover:shadow-brutalist-cyan transition-all group"
            >
              <GitHubIcon className="w-6 h-6 text-muted group-hover:text-[var(--cf-orange)] flex-shrink-0" />
              <div>
                <div className="text-primary font-mono text-sm group-hover:text-[var(--cf-orange)]">
                  harshil1712/ai-game-jam
                </div>
                <div className="text-dim-color font-mono text-xs mt-0.5">
                  github.com
                </div>
              </div>
              <ExternalLinkIcon className="w-4 h-4 text-dim-color group-hover:text-[var(--cf-orange)] ml-auto flex-shrink-0" />
            </a>
          </div>

          {/* Resource sections */}
          {RESOURCES.map((section) => (
            <div key={section.category}>
              <p className="text-muted font-mono text-xs uppercase tracking-wider mb-3">
                {">"} {section.category}
              </p>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-card border border-muted hover:border-[var(--cf-orange)] hover:shadow-brutalist-cyan transition-all group"
                  >
                    <div>
                      <div className="text-primary font-mono text-sm group-hover:text-[var(--cf-orange)]">
                        {item.label}
                      </div>
                      <div className="text-dim-color font-mono text-xs mt-0.5">
                        {item.description}
                      </div>
                    </div>
                    <ExternalLinkIcon className="w-3.5 h-3.5 text-dim-color group-hover:text-[var(--cf-orange)] ml-3 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-card border-t border-muted">
          <p className="text-dim-color font-mono text-xs text-center uppercase tracking-wider">
            Built with Cloudflare Workers · MIT License
          </p>
        </div>
      </CyberSurface>
    </div>
  );
}

// Inline SVG icons to avoid adding a new dependency
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// Hook for convenience
export function useHelpModal() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false)
  };
}
