import { Badge } from "@cloudflare/kumo";
import {
  RocketLaunchIcon,
  CheckCircleIcon,
  GearIcon
} from "@phosphor-icons/react";
import { isToolUIPart, getToolName, type UIMessage } from "ai";
import { CyberSurface } from "./CyberSurface";

function formatToolName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function ToolPartView({ part }: { part: UIMessage["parts"][number] }) {
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
            <GearIcon size={14} className="text-cf-orange animate-spin" />
            <span className="text-xs text-cf-orange font-mono uppercase">
              {">"} BUILDING {displayName}...
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
                className="text-cf-orange-dark animate-pulse"
              />
            ) : (
              <GearIcon size={14} className="text-cf-orange animate-spin" />
            )}
            <span className="text-xs text-cf-orange font-mono uppercase">
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
    return (
      <div className="flex justify-start">
        <CyberSurface className="max-w-[80%] px-4 py-2.5">
          <div className="flex items-center gap-2">
            {isGame ? (
              <CheckCircleIcon size={14} className="text-cf-orange-light" />
            ) : (
              <GearIcon size={14} className="text-cf-orange" />
            )}
            <span className="text-xs font-bold text-cf-orange-light font-mono uppercase">
              {isGame ? "[ARCHIVE DEPLOYED]" : `[${displayName}]`}
            </span>
            <Badge
              variant="secondary"
              className="rounded-none border border-cf-orange-light text-cf-orange-light bg-black font-mono text-[10px]"
            >
              OK
            </Badge>
          </div>
        </CyberSurface>
      </div>
    );
  }

  return null;
}
