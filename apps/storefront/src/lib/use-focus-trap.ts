"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Keeps focus inside a modal surface for as long as it is open.
 *
 * `aria-modal="true"` is a promise to assistive technology, not an
 * implementation: on its own it does nothing about the tab order, so a keyboard
 * user tabs straight out of the dialog and carries on through the page behind
 * it while a screen reader insists they are still in a modal. This is the part
 * that makes the attribute true.
 *
 * It also parks the page scroll and returns focus to whatever opened the
 * dialog, so closing it puts the user back where they were rather than at the
 * top of the document.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const container = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = container.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null,
      );

    // Focus the first control, or the dialog itself when it has none, so the
    // next Tab starts inside rather than at the top of the page.
    const first = focusables()[0];
    if (first) first.focus();
    else {
      node.tabIndex = -1;
      node.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const current = document.activeElement;

      if (event.shiftKey && (current === firstItem || !node.contains(current))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && current === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [active]);

  return container;
}
