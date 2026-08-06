"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Choosing the office a parcel is delivered to.
 *
 * Our own list rather than Econt's iframe widget, which the brief suggested.
 * Two reasons, and they are worth stating because it is a deviation:
 *
 *   Speedy have no widget, so an office picker has to exist here anyway, and
 *   one picker now serves both — two couriers behind two different pickers
 *   would look like two different shops.
 *
 *   The widget lives on Econt's domain and carries their styling. Dropping it
 *   into a monochrome, square-cornered checkout is the one place on the site
 *   where a shopper is deciding whether to trust it with money.
 *
 * Switching to the widget later costs this file and nothing else.
 */

export interface Office {
  code: string;
  name: string;
  city: string;
  postCode: string;
  address: string;
  hours: string | null;
  isMachine: boolean;
}

export function OfficePicker({
  courier,
  city,
  value,
  onChange,
}: {
  /** Which network to list — the two answer in the same shape by now. */
  courier: "econt" | "speedy";
  /** What the shopper typed in the city field; the list follows it. */
  city: string;
  value: Office | null;
  onChange: (office: Office | null) => void;
}) {
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("");
  const listId = useId();

  useEffect(() => {
    const wanted = city.trim();
    if (wanted.length < 2) {
      setOffices(null);
      return;
    }

    /* Debounced: the city field is typed into letter by letter, and a request
       per keystroke is one the courier does not deserve and the shopper does
       not benefit from. */
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/offices?courier=${courier}&city=${encodeURIComponent(wanted)}`,
        );
        const data = await response.json();
        if (!live) return;
        setOffices(data.offices ?? []);
        setFailed(!response.ok);
      } catch {
        if (live) setFailed(true);
      }
    }, 400);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [city, courier]);

  if (city.trim().length < 2) {
    return (
      <p className="font-body text-body text-muted-text">
        Напишете града по-горе, за да видите офисите.
      </p>
    );
  }

  if (failed) {
    return (
      <p className="font-body text-body text-primary" role="alert">
        Списъкът с офиси не се зареди. Опитайте пак или изберете доставка до
        адрес.
      </p>
    );
  }

  if (offices === null) {
    return <p className="font-body text-body text-muted-text">Търсим офиси…</p>;
  }

  if (offices.length === 0) {
    return (
      <p className="font-body text-body text-muted-text">
        Няма офиси в „{city}". Проверете изписването или изберете доставка до
        адрес.
      </p>
    );
  }

  const shown = filter.trim()
    ? offices.filter((office) =>
        `${office.name} ${office.address}`.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : offices;

  return (
    <div className="flex flex-col gap-3">
      {/* Only worth showing when there is enough to search through. Varna has
          31 offices; a village has one, and a search box above one result is
          furniture. */}
      {offices.length > 6 && (
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="търсене по улица или квартал"
          aria-label="Търсене в офисите"
          aria-controls={listId}
          className="w-full bg-surface px-3 py-2 font-body text-input text-body-text outline-none"
        />
      )}

      <ul
        id={listId}
        className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto border border-border"
      >
        {shown.map((office) => {
          const chosen = value?.code === office.code;
          return (
            <li key={office.code}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 p-3",
                  chosen && "bg-neutral",
                )}
              >
                <input
                  type="radio"
                  name="courierOffice"
                  checked={chosen}
                  onChange={() => onChange(office)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-body text-nav text-primary">
                    {office.name}
                    {office.isMachine && " · автомат"}
                  </span>
                  <span className="font-body text-body text-muted-text">{office.address}</span>
                  {office.hours && (
                    <span className="font-body text-body text-muted-text">{office.hours}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {shown.length === 0 && (
        <p className="font-body text-body text-muted-text">Няма съвпадение.</p>
      )}
    </div>
  );
}
