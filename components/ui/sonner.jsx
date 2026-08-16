"use client";

import { Toaster as Sonner } from "sonner";

/** Avisos curtos de sucesso e erro, no canto da tela. */
function Toaster(props) {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!bg-card !text-foreground !border !border-border !rounded-md !shadow-lg",
          description: "!text-muted-foreground",
          error: "!text-destructive",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
