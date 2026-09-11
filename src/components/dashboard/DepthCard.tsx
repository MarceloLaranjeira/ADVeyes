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

  const comesFromNestedControl = (target: EventTarget | null, currentTarget: EventTarget) => {
    if (!(target instanceof Element) || target === currentTarget) return false;
    const control = target.closest("a, button, input, select, textarea, [role='button'], [role='link']");
    return Boolean(control && control !== currentTarget);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !isInteractive || comesFromNestedControl(event.target, event.currentTarget)) return;
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
        if (!event.defaultPrevented && !comesFromNestedControl(event.target, event.currentTarget)) onActivate?.();
      }}
      onKeyDown={handleKeyDown}
    />
  );
};
