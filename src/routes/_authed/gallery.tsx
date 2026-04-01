import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button, Surface } from "@cloudflare/kumo";
import {
  ChatCircleDotsIcon,
  TriangleIcon,
  ArrowSquareOutIcon
} from "@phosphor-icons/react";

interface Game {
  id: string;
  title: string;
  description: string;
  vote_count: number;
  version: number;
  created_at: string;
  updated_at: string;
  creator_name: string;
  has_voted: boolean;
}

interface GalleryData {
  games: Game[];
  total: number;
  page: number;
}

export const Route = createFileRoute("/_authed/gallery")({
  component: GalleryPage,
  loader: async (): Promise<GalleryData> => {
    const res = await fetch("/api/gallery?limit=20");
    if (!res.ok) throw new Error("Failed to load gallery");
    return res.json();
  }
});

function GalleryPage() {
  const initialData = Route.useLoaderData();
  const [games, setGames] = useState<Game[]>(initialData.games);
  const [loading, _setLoading] = useState(false);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/gallery?limit=20");
        if (res.ok) {
          const data: GalleryData = await res.json();
          setGames(data.games);
        }
      } catch {
        // Ignore polling errors
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleVote = async (gameId: string) => {
    try {
      const res = await fetch(`/api/vote/${gameId}`, { method: "POST" });
      if (res.ok) {
        const result = (await res.json()) as {
          vote_count: number;
          voted: boolean;
        };
        // Update local state
        setGames((prev) =>
          prev.map((g) =>
            g.id === gameId
              ? { ...g, vote_count: result.vote_count, has_voted: result.voted }
              : g
          )
        );
      }
    } catch {
      // Ignore errors
    }
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Header - System Status Bar */}
      <header className="px-5 py-3 bg-[#111] border-b-2 border-[#f48120]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white font-display text-glow-cyan tracking-widest uppercase">
              ARCHIVE_DATABASE
            </h1>
          </div>
          <Link to="/chat">
            <Button
              variant="secondary"
              icon={<ChatCircleDotsIcon size={14} />}
              className="rounded-none border-2 border-[#3c3e40] bg-black text-[#f48120] hover:bg-[#f48120] hover:text-black hover:border-[#f48120] font-mono uppercase text-xs"
            >
              BUILDER
            </Button>
          </Link>
        </div>
      </header>

      {/* Gallery Grid */}
      <main className="max-w-6xl mx-auto px-5 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <Surface
              key={game.id}
              className="rounded-none border-2 border-[#3c3e40] bg-[#111] chamfer-br shadow-brutalist-magenta flex flex-col hover:border-[#f48120] transition-colors"
            >
              <div className="p-4 flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-white text-lg font-display tracking-wide">
                    {game.title.toUpperCase()}
                  </h3>
                  <span className="text-[10px] text-[#8e8e8e] font-mono border border-[#3c3e40] px-1">
                    V{game.version}
                  </span>
                </div>
                <p className="text-[#f48120] text-xs mb-3 font-mono uppercase tracking-wider">
                  {">"} {game.creator_name}
                </p>
                <p className="text-[#8e8e8e] text-sm line-clamp-2 font-mono">
                  {game.description || "[NO DESCRIPTION AVAILABLE]"}
                </p>
              </div>

              <div className="px-4 pb-4 flex items-center justify-between border-t border-[#3c3e40] pt-3 mt-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={game.has_voted ? "primary" : "secondary"}
                    size="sm"
                    icon={<TriangleIcon size={14} weight="fill" />}
                    onClick={() => handleVote(game.id)}
                    disabled={game.has_voted || loading}
                    aria-label={game.has_voted ? "Already voted" : "Upvote"}
                    className={`rounded-none border-2 font-mono uppercase text-xs tracking-wide ${
                      game.has_voted
                        ? "border-[#ffb020] bg-[#ffb020] text-black box-glow-green"
                        : "border-[#3c3e40] bg-black text-[#8e8e8e] hover:text-[#ffb020] hover:border-[#ffb020]"
                    }`}
                  >
                    {game.vote_count}
                  </Button>
                </div>

                <a
                  href={`/app/${game.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<ArrowSquareOutIcon size={14} />}
                    className="rounded-none border-2 border-[#3c3e40] bg-black text-[#f48120] hover:bg-[#f48120] hover:text-black hover:border-[#f48120] font-mono uppercase text-xs tracking-wide"
                  >
                    LAUNCH
                  </Button>
                </a>
              </div>
            </Surface>
          ))}
        </div>

        {games.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-block border-2 border-[#3c3e40] p-8 mb-6">
              <p className="text-[#8e8e8e] text-lg font-mono uppercase">
                [ARCHIVE EMPTY]
              </p>
              <p className="text-[#3c3e40] text-sm font-mono mt-2">
                No data entries found in database
              </p>
            </div>
            <Link to="/chat" className="mt-4 inline-block">
              <Button
                variant="primary"
                className="rounded-none border-2 border-[#f48120] bg-black text-[#f48120] hover:bg-[#f48120] hover:text-black shadow-brutalist-cyan font-mono uppercase tracking-wider"
              >
                INITIALIZE_CREATION
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
