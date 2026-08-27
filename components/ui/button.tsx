"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
}

const variantStyles: Record<string, string> = {
  default: "bg-accent-brand text-white hover:bg-accent-brand-hover shadow-sm",
  outline: "border border-border-default bg-bg-secondary text-text-primary hover:bg-bg-hover",
  ghost: "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
  secondary: "bg-bg-tertiary text-text-primary hover:bg-bg-elevated border border-border-dim",
}

const sizeStyles: Record<string, string> = {
  default: "h-8 px-4 py-1.5 text-xs",
  sm: "h-7 px-3 text-xs",
  lg: "h-9 px-6 text-sm",
  icon: "h-8 w-8",
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand disabled:opacity-50 disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export default Button
