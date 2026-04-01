import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter
} from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@cloudflare/kumo";
import { login } from "../lib/api";
import { CyberSurface } from "../components/CyberSurface";
import { CyberButton } from "../components/CyberButton";

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
      await login(name.trim(), email.trim());
      await router.invalidate();
      await navigate({ to: "/chat" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep bg-grid flex items-center justify-center p-4">
      <CyberSurface glow className="w-full max-w-md p-8 border-2">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 font-display text-glow-cyan tracking-wider">
            AI GAME JAM
          </h1>
          <p className="text-cf-light-gray font-mono text-sm uppercase tracking-widest">
            AI Engineer Europe 2026
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-bold text-cf-orange mb-1 font-mono uppercase tracking-wider"
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
              className="w-full rounded-none border-2 border-cf-mid-gray focus:border-cf-orange bg-black text-white font-mono placeholder:text-cf-mid-gray"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold text-cf-orange mb-1 font-mono uppercase tracking-wider"
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
              className="w-full rounded-none border-2 border-cf-mid-gray focus:border-cf-orange bg-black text-white font-mono placeholder:text-cf-mid-gray"
            />
          </div>

          {error && (
            <p className="text-cf-orange-dark text-sm font-mono">[!] {error}</p>
          )}

          <CyberButton
            type="submit"
            variant="primary"
            className="w-full tracking-wider font-display font-bold transition-all"
            disabled={loading}
          >
            {loading ? "> INITIALIZING..." : "> START_BUILDING"}
          </CyberButton>
        </form>

        <p className="text-center text-xs text-cf-light-gray mt-6 font-mono uppercase">
          Your game will be live in seconds.
        </p>
      </CyberSurface>
    </div>
  );
}
