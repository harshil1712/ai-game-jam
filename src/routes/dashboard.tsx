import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

const GITHUB_REPO = "https://github.com/harshil1712/ai-game-jam";

const BUILD_RESOURCES = [
  {
    label: "Dynamic Workers",
    url: "https://developers.cloudflare.com/dynamic-workers/"
  },
  { label: "Agents SDK", url: "https://developers.cloudflare.com/agents/" },
  { label: "Workers AI", url: "https://developers.cloudflare.com/workers-ai/" },
  { label: "D1 Database", url: "https://developers.cloudflare.com/d1/" }
];
import type { LeaderboardGame, DashboardData, Stats } from "../types";
import { fetchDashboard, fetchStats } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import { AppHeader } from "../components/AppHeader";
import { CyberSurface } from "../components/CyberSurface";

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
    <div className="h-screen bg-bg-deep bg-grid overflow-hidden flex flex-col">
      {/* Header */}
      <AppHeader title="COMMAND_CENTER" />

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full grid grid-cols-12 gap-8">
          {/* Leaderboard */}
          <div className="col-span-12 lg:col-span-5 min-h-0">
            <CyberSurface className="h-full p-6 shadow-brutalist-cyan border-2 flex flex-col">
              <h2 className="text-2xl font-bold text-white mb-6 font-display tracking-widest uppercase text-glow-cyan shrink-0">
                [LEADERBOARD]
              </h2>
              <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                {games.slice(0, 5).map((game, index) => (
                  <div
                    key={game.id}
                    className="flex items-center gap-4 p-4 bg-black border-2 border-cf-mid-gray"
                  >
                    <div className="text-3xl font-bold text-cf-orange w-8 font-display">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white font-display tracking-wide uppercase">
                        {game.title}
                      </h3>
                      <p className="text-cf-light-gray font-mono text-xs uppercase tracking-wider">
                        {">"} {game.creator_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-cf-orange-light font-mono">
                        {game.vote_count}
                      </div>
                      <div className="text-[10px] text-cf-light-gray font-mono uppercase">
                        VOTES
                      </div>
                    </div>
                  </div>
                ))}

                {games.length === 0 && (
                  <div className="text-center py-12 border-2 border-cf-mid-gray">
                    <p className="text-cf-light-gray text-lg font-mono uppercase">
                      [NO ENTRIES]
                    </p>
                    <p className="text-cf-mid-gray text-sm font-mono mt-2">
                      Scan the QR code to create a game
                    </p>
                  </div>
                )}
              </div>
            </CyberSurface>
          </div>

          {/* Stats & QR Code */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-8">
            {/* Stats */}
            <CyberSurface className="p-6 shadow-brutalist-magenta border-2">
              <h2 className="text-2xl font-bold text-white mb-6 font-display tracking-widest uppercase text-glow-cyan">
                [SYSTEM_STATUS]
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-6 bg-black border-2 border-cf-mid-gray">
                  <div className="text-5xl font-bold text-cf-orange mb-2 font-display">
                    {stats.total_games}
                  </div>
                  <div className="text-cf-light-gray font-mono text-xs uppercase tracking-wider">
                    Games Created
                  </div>
                </div>
                <div className="text-center p-6 bg-black border-2 border-cf-mid-gray">
                  <div className="text-5xl font-bold text-cf-orange-light mb-2 font-display">
                    {stats.total_votes}
                  </div>
                  <div className="text-cf-light-gray font-mono text-xs uppercase tracking-wider">
                    Total Votes
                  </div>
                </div>
                {/* <div className="text-center p-6 bg-black border-2 border-cf-mid-gray">
                  <div className="text-5xl font-bold text-white mb-2 font-display">
                    {stats.total_users}
                  </div>
                  <div className="text-cf-light-gray font-mono text-xs uppercase tracking-wider">
                    Builders
                  </div>
                </div> */}
              </div>
            </CyberSurface>

            {/* QR Code */}
            <CyberSurface className="p-6 flex flex-col items-center justify-center shadow-brutalist-green border-2">
              <div className="bg-white p-4 border-2 border-cf-mid-gray mb-4">
                <QRCodeSVG value={boothUrl} size={180} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 font-display tracking-widest uppercase text-glow-cyan">
                SCAN_TO_BUILD
              </h3>
              <p className="text-cf-light-gray text-center font-mono text-sm uppercase tracking-wider">
                Point your camera at the QR code
                <br />
                to start building your game
              </p>
            </CyberSurface>

            {/* Build Your Own */}
            <CyberSurface className="p-6 shadow-brutalist-magenta border-2">
              <div className="flex items-start gap-6">
                {/* Resources */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white mb-3 font-display tracking-widest uppercase text-glow-cyan">
                    BUILD_YOUR_OWN
                  </h3>
                  <div className="space-y-1.5">
                    {BUILD_RESOURCES.map((r) => (
                      <a
                        key={r.url}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-cf-light-gray hover:text-cf-orange font-mono text-xs uppercase tracking-wider transition-colors group"
                      >
                        <span className="text-cf-orange group-hover:text-cf-orange-light">
                          {">"}
                        </span>
                        {r.label}
                      </a>
                    ))}
                    <a
                      href={GITHUB_REPO}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-cf-light-gray hover:text-cf-orange font-mono text-xs uppercase tracking-wider transition-colors group mt-2"
                    >
                      <span className="text-cf-orange group-hover:text-cf-orange-light">
                        {">"}
                      </span>
                      github.com/harshil1712/ai-game-jam
                    </a>
                  </div>
                </div>
              </div>
            </CyberSurface>
          </div>
        </div>
      </main>
    </div>
  );
}
