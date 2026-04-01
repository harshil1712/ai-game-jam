import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/" });
    }
  },
  component: () => <Outlet />
});
