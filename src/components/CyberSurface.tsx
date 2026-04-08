import { Surface } from "@cloudflare/kumo";
import type { ComponentProps } from "react";

interface CyberSurfaceProps extends ComponentProps<typeof Surface> {
  glow?: boolean;
}

export function CyberSurface({
  className = "",
  glow = false,
  ...props
}: CyberSurfaceProps) {
  return (
    <Surface
      className={`rounded-none border border-muted bg-surface font-mono${glow ? " border-accent shadow-brutalist-cyan" : ""} ${className}`}
      {...props}
    />
  );
}
