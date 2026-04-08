import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toasty } from "@cloudflare/kumo/components/toast";
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
  return (
    <Toasty>
      <div className="crt-overlay">
        <Outlet />
      </div>
    </Toasty>
  );
}
