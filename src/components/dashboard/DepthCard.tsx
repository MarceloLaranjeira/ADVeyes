import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  type KeyboardEvent,
  type ComponentPropsWithoutRef,
} from "react";

interface DepthCardProps extends ComponentPropsWithoutRef<typeof Card> {
  interactive?: boolean;
  onActivate?: () => void;
}

export const DepthCard = ({
  interactive = false,
  onActivate,
  className,
  onClick,
  onKeyDown,
  ...props
}: DepthCardProps) => {
  const isInteractive = interactive || Boolean(onActivate || onClick);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !isInteractive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate?.();
    }
  };

  return (
    <Card
      {...props}
      className={cn(
        "depth-card",
        isInteractive && "depth-card--interactive",
        className,
      )}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onActivate?.();
      }}
      onKeyDown={handleKeyDown}
    />
  );
};
