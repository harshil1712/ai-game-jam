import type { GalleryData, DashboardData, Stats, PublicUser } from "../types";

export async function fetchGallery(limit = 20): Promise<GalleryData> {
  const res = await fetch(`/api/gallery?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load gallery");
  return res.json();
}

export async function fetchDashboard(limit = 10): Promise<DashboardData> {
  const res = await fetch(`/api/gallery?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function fetchMe(): Promise<PublicUser | undefined> {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export async function login(name: string, email: string): Promise<PublicUser> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email })
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error || "Login failed");
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

export async function vote(
  gameId: string
): Promise<{ vote_count: number; voted: boolean }> {
  const res = await fetch(`/api/vote/${gameId}`, { method: "POST" });
  if (!res.ok) throw new Error("Vote failed");
  return res.json();
}
