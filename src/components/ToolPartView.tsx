import { Badge } from "@cloudflare/kumo";
import {
  RocketLaunchIcon,
  CheckCircleIcon,
  GearIcon,
  WarningCircleIcon,
  CopyIcon,
  CheckIcon,
  ArrowSquareOutIcon
} from "@phosphor-icons/react";
import { isToolUIPart, getToolName, type UIMessage } from "ai";
import { useState } from "react";
import { CyberSurface } from "./CyberSurface";
import { CyberButton } from "./CyberButton";

function formatToolName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function ToolPartView({
  part,
  isLatestGame
}: {
  part: UIMessage["parts"][number];
  isLatestGame?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);
  const isGame = toolName === "generateGame";
  const displayName = isGame
    ? "GENERATE_GAME"
    : formatToolName(toolName).toUpperCase().replace(/ /g, "_");

  if (part.state === "input-streaming") {
    return (
      <div className="flex justify-start">
        <CyberSurface className="max-w-[80%] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <GearIcon size={14} className="text-accent animate-spin" />
            <span className="text-sm text-accent font-mono uppercase">
              {">"} {displayName}...
            </span>
          </div>
        </CyberSurface>
      </div>
    );
  }

  if (part.state === "input-available") {
    return (
      <div className="flex justify-start">
        <CyberSurface className="max-w-[80%] px-4 py-2.5">
          <div className="flex items-center gap-2">
            {isGame ? (
              <RocketLaunchIcon
                size={14}
                className="text-accent-dark animate-pulse"
              />
            ) : (
              <GearIcon size={14} className="text-accent animate-spin" />
            )}
            <span className="text-sm text-accent font-mono uppercase">
              {isGame
                ? "{'>'} DEPLOYING ARCHIVE..."
                : `{'>'} EXECUTING ${displayName}...`}
            </span>
          </div>
        </CyberSurface>
      </div>
    );
  }

  if (part.state === "output-available") {
    if (isGame) {
      const output = (part as { output?: { url?: string } }).output;
      const gameUrl = output?.url ?? null;

      if (isLatestGame) {
        return (
          <div className="flex justify-start w-full">
            <div className="w-full">
              {/* Deployed badge row */}
              <div className="flex items-center gap-2 mb-3">
                <CheckCircleIcon size={14} className="text-accent-light" />
                <span className="text-sm font-bold text-accent-light font-mono uppercase">
                  [ARCHIVE DEPLOYED]
                </span>
                <Badge
                  variant="secondary"
                  className="rounded-none border border-accent-light text-accent-light bg-card font-mono text-[10px]"
                >
                  OK
                </Badge>
              </div>

              {/* Preview block */}
              <div className="border-2 border-muted bg-surface">
                {/* Header bar */}
                <div className="flex items-center justify-between px-3 py-2 border-b-2 border-muted">
                  <h3 className="font-bold text-primary font-display tracking-wider uppercase text-xs text-glow-cyan">
                    PREVIEW_UNIT
                  </h3>
                  <div className="flex gap-2">
                    {gameUrl && (
                      <CyberButton
                        cyber="secondary"
                        size="sm"
                        icon={
                          copied ? (
                            <CheckIcon size={14} />
                          ) : (
                            <CopyIcon size={14} />
                          )
                        }
                        onClick={async () => {
                          await navigator.clipboard.writeText(
                            `${window.location.origin}${gameUrl}`
                          );
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? "COPIED" : "COPY"}
                      </CyberButton>
                    )}
                    {gameUrl && (
                      <a
                        href={gameUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <CyberButton
                          size="sm"
                          icon={<ArrowSquareOutIcon size={14} />}
                        >
                          OPEN
                        </CyberButton>
                      </a>
                    )}
                  </div>
                </div>

                {/* Iframe container — responsive with CRT border */}
                <div className="p-2 sm:p-3 bg-surface">
                  <div className="border-8 sm:border-[12px] border-dim shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] bg-card overflow-hidden aspect-[4/3] w-full">
                    {gameUrl ? (
                      <iframe
                        src={gameUrl}
                        className="w-full h-full border-0"
                        sandbox="allow-scripts"
                        title="Game Preview"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-dim-color font-mono text-xs uppercase">
                        No preview available
                      </div>
                    )}
                  </div>
                </div>

                {/* Status bar */}
                <div className="px-3 py-2 border-t border-dim flex justify-between items-center">
                  <span className="text-[10px] text-muted font-mono uppercase">
                    Status: RUNNING
                  </span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-accent box-glow-green"></div>
                    <div className="w-2 h-2 bg-accent box-glow-green"></div>
                    <div className="w-2 h-2 bg-[var(--cf-mid-gray)]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Older game - compact badge with OPEN link
      return (
        <div className="flex justify-start">
          <CyberSurface className="max-w-[80%] px-4 py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircleIcon size={14} className="text-accent-light" />
              <span className="text-sm font-bold text-accent-light font-mono uppercase">
                [ARCHIVE DEPLOYED]
              </span>
              <Badge
                variant="secondary"
                className="rounded-none border border-accent-light text-accent-light bg-card font-mono text-[10px]"
              >
                OK
              </Badge>
              {gameUrl && (
                <a href={gameUrl} target="_blank" rel="noopener noreferrer">
                  <CyberButton
                    size="sm"
                    icon={<ArrowSquareOutIcon size={12} />}
                  >
                    OPEN
                  </CyberButton>
                </a>
              )}
            </div>
          </CyberSurface>
        </div>
      );
    }

    // Non-game tools
    return (
      <div className="flex justify-start">
        <CyberSurface className="max-w-[80%] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <GearIcon size={14} className="text-accent" />
            <span className="text-sm font-bold text-accent-light font-mono uppercase">
              [{displayName}]
            </span>
            <Badge
              variant="secondary"
              className="rounded-none border border-accent-light text-accent-light bg-card font-mono text-[10px]"
            >
              OK
            </Badge>
          </div>
        </CyberSurface>
      </div>
    );
  }

  if (part.state === "output-error") {
    const errorText =
      "errorText" in part
        ? (part as { errorText: string }).errorText
        : "Unknown error";
    return (
      <div className="flex justify-start">
        <CyberSurface className="max-w-[80%] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <WarningCircleIcon size={14} className="text-red-500" />
            <span className="text-sm font-bold text-red-400 font-mono uppercase">
              [{displayName}] ERROR
            </span>
            <Badge
              variant="secondary"
              className="rounded-none border border-red-500 text-red-400 bg-card font-mono text-[10px]"
            >
              FAIL
            </Badge>
          </div>
          <p className="text-xs text-red-400/70 font-mono mt-1 truncate">
            {errorText}
          </p>
        </CyberSurface>
      </div>
    );
  }

  return null;
}
