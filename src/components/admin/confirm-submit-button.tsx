"use client";

import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({
  message,
  children,
  variant = "destructive",
}: {
  message: string;
  children: React.ReactNode;
  variant?: "destructive" | "outline";
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size="sm"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
