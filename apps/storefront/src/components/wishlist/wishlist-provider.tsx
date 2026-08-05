"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * The favourites list, kept in the browser.
 *
 * localStorage rather than the cart's httpOnly cookie or a customer account.
 * There are no accounts yet, and a favourites list is not sensitive the way a
 * basket is — it holds no prices, no addresses and nothing a shop would act on.
 * When Phase 9 adds accounts this becomes the guest half of a merge: whatever
 * is here gets pushed up on sign-in.
 *
 * Handles rather than ids, because they are what a product page is addressed
 * by, so nothing has to be resolved before the list can render a link.
 */

const STORAGE_KEY = "redpoint.wishlist";

interface WishlistValue {
  handles: string[];
  /** False until the browser has read storage, so the UI can stay quiet. */
  ready: boolean;
  has: (handle: string) => boolean;
  toggle: (handle: string) => void;
}

const WishlistContext = createContext<WishlistValue | null>(null);

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    /* Private browsing, a full quota, or someone else's data under our key.
       An unreadable favourites list is an empty one, never a broken page. */
    return [];
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [handles, setHandles] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  /* Read after mount, not during render. The server has no localStorage, so
     starting from anything else would make the first client render disagree
     with the HTML that was sent. */
  useEffect(() => {
    setHandles(read());
    setReady(true);
  }, []);

  /* Another tab is the same list. Without this, hearting something in one tab
     and opening favourites in another shows a stale page. */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setHandles(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((handle: string) => {
    setHandles((current) => {
      const next = current.includes(handle)
        ? current.filter((entry) => entry !== handle)
        : [handle, ...current];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* Out of quota or storage denied. The heart still fills for this
           visit; it just will not survive a reload. Losing a favourite is not
           worth an error message. */
      }
      return next;
    });
  }, []);

  const has = useCallback((handle: string) => handles.includes(handle), [handles]);

  return (
    <WishlistContext.Provider value={{ handles, ready, has, toggle }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistValue {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist used outside WishlistProvider");
  return value;
}
