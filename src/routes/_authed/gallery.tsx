import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import type { GalleryGame, GalleryData } from "../../types";
import { fetchGallery, vote } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
import { AppHeader } from "../../components/AppHeader";
import { GameCard } from "../../components/GameCard";
import { CyberButton } from "../../components/CyberButton";

export const Route = createFileRoute("/_authed/gallery")({
  component: GalleryPage,
  loader: async (): Promise<GalleryData> => fetchGallery(20)
});

function GalleryPage() {
  const initialData = Route.useLoaderData();
  const [games, setGames] = useState<GalleryGame[]>(initialData.games);

  const refresh = useCallback(async () => {
    const data = await fetchGallery(20);
    setGames(data.games);
  }, []);

  usePolling(refresh, 10000);

  const handleVote = async (gameId: string) => {
    try {
      const result = await vote(gameId);
      setGames((prev) =>
        prev.map((g) =>
          g.id === gameId
            ? { ...g, vote_count: result.vote_count, has_voted: result.voted }
            : g
        )
      );
    } catch {
      // Ignore errors
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-5 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} onVote={handleVote} />
          ))}
        </div>

        {games.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-block border-2 border-cf-mid-gray p-8 mb-6">
              <p className="text-cf-light-gray text-lg font-mono uppercase">
                [ARCHIVE EMPTY]
              </p>
              <p className="text-cf-mid-gray text-sm font-mono mt-2">
                No data entries found in database
              </p>
            </div>
            <Link to="/chat" className="mt-4 inline-block">
              <CyberButton className="shadow-brutalist-cyan tracking-wider">
                INITIALIZE_CREATION
              </CyberButton>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
