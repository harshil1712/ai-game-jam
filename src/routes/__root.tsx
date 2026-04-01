import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toasty } from "@cloudflare/kumo/components/toast";
import { useEffect, useState } from "react";
import { fetchMe } from "../lib/api";
import type { PublicUser } from "../types";

export interface RouterContext {
  user: PublicUser | undefined;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  beforeLoad: async () => {
    const user = await fetchMe();
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
