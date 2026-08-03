"use client";

import type { InputHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Persistent hint. Rendered above the error, never as a placeholder. */
  helper?: string;
  /** When set, the field renders its error state and announces it. */
  error?: string;
}

/**
 * Label always sits ABOVE the field, helper and error BELOW. Placeholder is
 * never a substitute for a label - it disappears the moment the user types,
 * and checkout has to survive keyboard-only navigation.
 *
 * The error state is monochrome on purpose. This system reserves #C2311E for
 * sale signage and forbids secondary brand colours, so it has no error red to
 * spend. The state is carried by a hard 2px black stroke (the resting field
 * has no border at all), a bold message below, and role="alert" - which also
 * means it never depends on colour alone.
 */
export function Input({
  label,
  helper,
  error,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const describedBy =
    [helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="font-body text-nav text-primary">
        {label}
      </label>

      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-none border-0 bg-surface px-4 py-3",
          "font-body text-input text-body-text",
          "placeholder:text-muted-text",
          error && "outline-2 -outline-offset-2 outline-primary",
          className,
        )}
        {...props}
      />

      {helper && (
        <p id={helperId} className="font-body text-body text-muted-text">
          {helper}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="font-body text-body font-semibold text-primary"
        >
          {error}
        </p>
      )}
    </div>
  );
}
