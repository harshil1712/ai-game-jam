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
      className={`rounded-none border border-cf-mid-gray bg-bg-charcoal font-mono${glow ? " border-cf-orange shadow-brutalist-cyan" : ""} ${className}`}
      {...props}
    />
  );
}
