import { useState, useEffect } from "react";
import { isToolUIPart, type UIMessage } from "ai";

/**
 * Scans `messages` and returns the URL of the most recently deployed game,
 * or null if no game has been deployed yet.
 */
export function useGameUrl(messages: UIMessage[]): string | null {
  const [gameUrl, setGameUrl] = useState<string | null>(null);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === "assistant") {
        for (const part of msg.parts) {
          if (isToolUIPart(part) && part.state === "output-available") {
            const output = part.output as { url?: string } | undefined;
            if (output?.url) {
              setGameUrl(output.url);
            }
          }
        }
      }
    }
  }, [messages]);

  return gameUrl;
}
