import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { Surface } from "@cloudflare/kumo";
import { QRCodeSVG } from "qrcode.react";
import type { LeaderboardGame, DashboardData, Stats } from "../types";
import { fetchDashboard, fetchStats } from "../lib/api";
import { usePolling } from "../hooks/usePolling";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  loader: async (): Promise<DashboardData> => fetchDashboard(10)
});

function DashboardPage() {
  const initialData = Route.useLoaderData();
  const [games, setGames] = useState<LeaderboardGame[]>(initialData.games);
  const [stats, setStats] = useState<Stats>({
    total_games: 0,
    total_users: 0,
    total_votes: 0,
    recent_games: 0
  });

  const refresh = useCallback(async () => {
    const [galleryData, statsData] = await Promise.all([
      fetchDashboard(10),
      fetchStats()
    ]);
    setGames(galleryData.games);
    setStats(statsData);
  }, []);

  usePolling(refresh, 5000);

  const boothUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="h-screen bg-slate-950 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">
            <span className="mr-3">🎮</span>AI Game Jam
          </h1>
          <p className="text-slate-400 text-xl">AI Engineer Europe 2026</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full grid grid-cols-12 gap-8">
          {/* Leaderboard */}
          <div className="col-span-12 lg:col-span-5">
            <Surface className="h-full rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                Leaderboard
              </h2>
              <div className="space-y-4">
                {games.slice(0, 5).map((game, index) => (
                  <div
                    key={game.id}
                    className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl"
                  >
                    <div className="text-3xl font-bold text-slate-500 w-8">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white">
                        {game.title}
                      </h3>
                      <p className="text-slate-400">by {game.creator_name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-400">
                        ▲{game.vote_count}
                      </div>
                    </div>
                  </div>
                ))}

                {games.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-400 text-lg">
                      No games yet. Scan the QR code to create one!
                    </p>
                  </div>
                )}
              </div>
            </Surface>
          </div>

          {/* Stats & QR Code */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-8">
            {/* Stats */}
            <Surface className="rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Stats</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-6 bg-slate-800 rounded-xl">
                  <div className="text-5xl font-bold text-purple-400 mb-2">
                    {stats.total_games}
                  </div>
                  <div className="text-slate-400">Games Created</div>
                </div>
                <div className="text-center p-6 bg-slate-800 rounded-xl">
                  <div className="text-5xl font-bold text-green-400 mb-2">
                    {stats.total_votes}
                  </div>
                  <div className="text-slate-400">Total Votes</div>
                </div>
                <div className="text-center p-6 bg-slate-800 rounded-xl">
                  <div className="text-5xl font-bold text-blue-400 mb-2">
                    {stats.total_users}
                  </div>
                  <div className="text-slate-400">Builders</div>
                </div>
                <div className="text-center p-6 bg-slate-800 rounded-xl">
                  <div className="text-5xl font-bold text-orange-400 mb-2">
                    {stats.recent_games}
                  </div>
                  <div className="text-slate-400">Games (Last 5min)</div>
                </div>
              </div>
            </Surface>

            {/* QR Code */}
            <Surface className="flex-1 rounded-2xl p-6 flex flex-col items-center justify-center">
              <div className="bg-white p-4 rounded-xl mb-4">
                <QRCodeSVG value={boothUrl} size={200} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Scan to Build
              </h3>
              <p className="text-slate-400 text-center">
                Point your camera at the QR code
                <br />
                to start building your game!
              </p>
            </Surface>
          </div>
        </div>
      </main>
    </div>
  );
}
