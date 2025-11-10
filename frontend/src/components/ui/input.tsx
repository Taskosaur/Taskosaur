import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "form-input-base file-input-styling input-placeholder input-selection dark-input-background input-disabled",
        "focus-ring",
        "invalid-state",
        className
      )}
      {...props}
    />
  );
}

export { Input };
