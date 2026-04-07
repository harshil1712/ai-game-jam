import { routeAgentRequest } from "agents";
import {
  handleLogin,
  handleLogout,
  handleMe,
  handleGallery,
  handleVote,
  handleStats,
  handleApp
} from "./server/routes";

// Re-export ChatAgent so wrangler and chat.tsx can import it from this file.
export { ChatAgent } from "./server/agent";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Agent WebSocket routes (must come first)
    if (path.startsWith("/agents/")) {
      const agentResponse = await routeAgentRequest(request, env);
      if (agentResponse) return agentResponse;
    }

    // API routes
    if (path === "/api/login") return handleLogin(request, env);
    if (path === "/api/logout") return handleLogout(request, env);
    if (path === "/api/me") return handleMe(request, env);
    if (path === "/api/gallery") return handleGallery(request, env);
    if (path === "/api/stats") return handleStats(request, env);
    if (path.startsWith("/api/vote/")) return handleVote(request, env);

    // Dynamic Worker app serving
    if (path.startsWith("/app/")) return handleApp(request, env);

    // 404 fallback (assets Worker handles everything else)
    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
