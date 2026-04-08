import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { AppHeader } from "../components/AppHeader";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthedLayout
});

function AuthedLayout() {
  return (
    <div className="flex flex-col h-screen bg-bg-deep">
      <AppHeader />
      <Outlet />
    </div>
  );
}
