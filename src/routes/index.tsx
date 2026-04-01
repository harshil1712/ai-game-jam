import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter
} from "@tanstack/react-router";
import { useState } from "react";
import { Button, Input, Surface } from "@cloudflare/kumo";

export const Route = createFileRoute("/")({
  component: LoginPage,
  beforeLoad: async ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/chat" });
    }
  }
});

function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() })
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Login failed");
      }

      // Invalidate router so beforeLoad re-runs and picks up new session
      await router.invalidate();
      await navigate({ to: "/chat" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] bg-grid flex items-center justify-center p-4">
      <Surface className="w-full max-w-md p-8 rounded-none border-2 border-[#f48120] shadow-brutalist-cyan bg-[#111]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 font-display text-glow-cyan tracking-wider">
            AI GAME JAM
          </h1>
          <p className="text-[#8e8e8e] font-mono text-sm uppercase tracking-widest">
            AI Engineer Europe 2026
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-bold text-[#f48120] mb-1 font-mono uppercase tracking-wider"
            >
              [NAME]
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="> ENTER_IDENTITY"
              disabled={loading}
              className="w-full rounded-none border-2 border-[#3c3e40] focus:border-[#f48120] bg-black text-white font-mono placeholder:text-[#3c3e40]"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold text-[#f48120] mb-1 font-mono uppercase tracking-wider"
            >
              [EMAIL]
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="> ENTER_COMMS_ADDRESS"
              disabled={loading}
              className="w-full rounded-none border-2 border-[#3c3e40] focus:border-[#f48120] bg-black text-white font-mono placeholder:text-[#3c3e40]"
            />
          </div>

          {error && (
            <p className="text-[#d9650d] text-sm font-mono">[!] {error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full rounded-none border-2 border-[#f48120] bg-black text-[#f48120] hover:bg-[#f48120] hover:text-black uppercase font-bold tracking-wider font-display transition-all"
            disabled={loading}
          >
            {loading ? "> INITIALIZING..." : "> START_BUILDING"}
          </Button>
        </form>

        <p className="text-center text-xs text-[#8e8e8e] mt-6 font-mono uppercase">
          Your game will be live in seconds.
        </p>
      </Surface>
    </div>
  );
}
