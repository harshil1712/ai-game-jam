import { ArrowSquareOutIcon, ArrowFatUpIcon } from "@phosphor-icons/react";
import type { GalleryGame } from "../types";
import { CyberButton } from "./CyberButton";
import { CyberSurface } from "./CyberSurface";

interface GameCardProps {
  game: GalleryGame;
  onVote: (gameId: string) => void;
  voteDisabled?: boolean;
}

export function GameCard({
  game,
  onVote,
  voteDisabled = false
}: GameCardProps) {
  return (
    <CyberSurface className="chamfer-br shadow-brutalist-magenta flex flex-col hover:border-accent transition-colors border-2">
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-primary text-lg font-display tracking-wide">
            {game.title.toUpperCase()}
          </h3>
          <span className="text-[10px] text-muted font-mono border border-muted px-1">
            V{game.version}
          </span>
        </div>
        <p className="text-accent text-xs mb-3 font-mono uppercase tracking-wider">
          {">"} {game.creator_name}
        </p>
        <p className="text-muted text-sm line-clamp-2 font-mono">
          {game.description || "[NO DESCRIPTION AVAILABLE]"}
        </p>
      </div>

      <div className="px-4 pb-4 flex items-center justify-between border-t border-muted pt-3 mt-2">
        <CyberButton
          cyber={game.has_voted ? "primary" : "secondary"}
          variant={game.has_voted ? "primary" : "secondary"}
          size="sm"
          icon={<ArrowFatUpIcon size={14} weight="fill" />}
          onClick={() => onVote(game.id)}
          disabled={game.has_voted || voteDisabled}
          aria-label={game.has_voted ? "Already voted" : "Upvote"}
          className={
            game.has_voted
              ? "border-accent-light bg-[var(--cf-orange-light)] text-[var(--bg-card)] box-glow-green"
              : "text-muted hover:text-[var(--cf-orange-light)] hover:border-[var(--cf-orange-light)]"
          }
        >
          {game.vote_count}
        </CyberButton>

        <a href={`/app/${game.id}`} target="_blank" rel="noopener noreferrer">
          <CyberButton
            size="sm"
            icon={<ArrowSquareOutIcon size={14} />}
            className="tracking-wide"
          >
            LAUNCH
          </CyberButton>
        </a>
      </div>
    </CyberSurface>
  );
}
