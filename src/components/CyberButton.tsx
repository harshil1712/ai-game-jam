import { Button } from "@cloudflare/kumo";
import * as React from "react";

export type CyberVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonSize = "xs" | "sm" | "base" | "lg";
type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "secondary-destructive"
  | "outline";

interface CyberButtonBaseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  cyber?: CyberVariant;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
}

interface CyberButtonWithTextProps extends CyberButtonBaseProps {
  shape?: "base";
}

interface CyberButtonIconOnlyProps extends CyberButtonBaseProps {
  shape: "square" | "circle";
  "aria-label": string;
}

export type CyberButtonProps =
  | CyberButtonWithTextProps
  | CyberButtonIconOnlyProps;

const cyberClasses: Record<CyberVariant, string> = {
  // Orange accent — default interactive button
  primary:
    "rounded-none border-2 border-cf-mid-gray bg-black text-cf-orange hover:bg-cf-orange hover:text-black hover:border-cf-orange font-mono uppercase text-xs",
  // Gray accent — secondary/muted button
  secondary:
    "rounded-none border-2 border-cf-mid-gray bg-black text-cf-light-gray hover:text-cf-orange hover:border-cf-orange font-mono uppercase text-xs",
  // Red/dark-orange — destructive action (CLEAR, STOP)
  danger:
    "rounded-none border-2 border-cf-orange-dark bg-black text-cf-orange-dark hover:bg-cf-orange-dark hover:text-black font-mono uppercase text-xs",
  // Like secondary but danger colors on hover
  ghost:
    "rounded-none border-2 border-cf-mid-gray bg-black text-cf-light-gray hover:text-cf-orange-dark hover:border-cf-orange-dark font-mono uppercase text-xs"
};

export function CyberButton({
  cyber = "primary",
  className = "",
  variant = "secondary",
  ...props
}: CyberButtonProps) {
  const combinedClassName = `${cyberClasses[cyber]} ${className}`;

  // Pass through all props including shape and aria-label if they exist
  return <Button variant={variant} className={combinedClassName} {...props} />;
}
