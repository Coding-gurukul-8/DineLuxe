"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormErrorProps {
  /** The error message string, or null/undefined to render nothing */
  error: string | null | undefined;
  className?: string;
}

/**
 * Renders a red alert box containing a form-level error message.
 * Returns null when there is no error so it can be placed unconditionally.
 *
 * Usage:
 *   const [formError, setFormError] = useState<string | null>(null)
 *   ...
 *   <FormError error={formError} />
 */
export function FormError({ error, className }: FormErrorProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700",
        className
      )}
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
      <span>{error}</span>
    </div>
  );
}
