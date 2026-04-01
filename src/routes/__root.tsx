import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toasty } from "@cloudflare/kumo/components/toast";
import { useEffect, useState } from "react";

export interface RouterContext {
  user: { id: string; name: string; email: string } | undefined;
}

async function fetchUser(): Promise<RouterContext["user"]> {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  beforeLoad: async () => {
    const user = await fetchUser();
    return { user };
  }
});

function RootLayout() {
  const [isDark] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-mode",
      isDark ? "dark" : "light"
    );
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  return (
    <Toasty>
      <div className={`${isDark ? "dark" : ""} crt-overlay`}>
        <Outlet />
      </div>
    </Toasty>
  );
}
