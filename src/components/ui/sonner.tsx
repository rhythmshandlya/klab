"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Shadcn's Sonner toast surface, mapped onto the app's existing dark design tokens. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!border-border-strong !bg-panel-elevated !text-foreground !shadow-xl",
          description: "!text-muted",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-panel-hover !text-muted",
        },
      }}
      {...props}
    />
  );
}
