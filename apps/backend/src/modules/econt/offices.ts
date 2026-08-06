import { call } from "./client";

/**
 * Econt's office network, in the shape a checkout needs.
 *
 * Every call here is read-only. Nothing in this file can create a shipment.
 *
 * Econt return one flat list for a whole country — 585 offices for Bulgaria —
 * rather than offices per settlement the way Speedy do. That is convenient
 * enough to be worth keeping: one call, cached, and the filtering happens here.
 */

export interface EcontOffice {
  /** The code Econt want back when a shipment is addressed to this office. */
  code: string;
  name: string;
  city: string;
  postCode: string;
  address: string;
  /** "09:00 - 18:00", or null when Econt publish no hours for it. */
  hours: string | null;
  /** An automated parcel machine rather than a counter with a person. */
  isMachine: boolean;
}

interface OfficeResponse {
  offices?: {
    code: string;
    name: string;
    isAPS?: boolean;
    normalBusinessHoursFrom?: number;
    normalBusinessHoursTo?: number;
    address?: {
      fullAddress?: string;
      city?: { name?: string; postCode?: string };
    };
  }[];
}

/**
 * Econt give business hours as epoch milliseconds on an arbitrary day.
 *
 * Only the time of day carries meaning, and it is meant as local Bulgarian
 * time. Reading it in whatever zone the server happens to run in would shift
 * every office by an hour or two on a VPS in Frankfurt, so the zone is named
 * rather than inherited.
 */
function businessHours(from?: number, to?: number): string | null {
  if (!from || !to) return null;

  const format = (value: number) =>
    new Intl.DateTimeFormat("bg-BG", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Sofia",
    }).format(new Date(value));

  return `${format(from)} - ${format(to)}`;
}

export async function listOffices(countryCode = "BGR"): Promise<EcontOffice[]> {
  const data = await call<OfficeResponse>(
    "Nomenclatures/NomenclaturesService.getOffices.json",
    { countryCode },
  );

  return (data.offices ?? []).map((office) => ({
    code: office.code,
    name: office.name,
    city: office.address?.city?.name ?? "",
    postCode: office.address?.city?.postCode ?? "",
    /* Econt's `fullAddress` opens with a space and repeats the city. Both are
       noise next to a city that is already its own column. */
    address: (office.address?.fullAddress ?? "").trim(),
    hours: businessHours(office.normalBusinessHoursFrom, office.normalBusinessHoursTo),
    isMachine: office.isAPS === true,
  }));
}

/**
 * A settlement's id, which is the only address Econt never argues with.
 *
 * Naming a city and its post code together is rejected as "Несъответствие
 * между населено място и пощенски код" often enough to be unusable — their
 * data has several records per city and the pair does not always agree. An id
 * is exact.
 *
 * Looked up rather than written down, because ids are per system: Варна is 7
 * in the demo and something else in production, so a constant would work
 * through every test and fail on the first real parcel.
 */
const cityIds = new Map<string, number>();

export async function cityId(name: string): Promise<number> {
  const wanted = name.trim().toLowerCase();
  const known = cityIds.get(wanted);
  if (known) return known;

  const data = await call<{ cities?: { id: number; name: string }[] }>(
    "Nomenclatures/NomenclaturesService.getCities.json",
    { countryCode: "BGR" },
  );

  for (const city of data.cities ?? []) {
    if (!cityIds.has(city.name.toLowerCase())) cityIds.set(city.name.toLowerCase(), city.id);
  }

  const found = cityIds.get(wanted);
  if (!found) throw new Error(`Econt has no city named "${name}"`);
  return found;
}

/** The offices in one settlement, for a checkout that already knows the city. */
export async function officesInCity(city: string): Promise<EcontOffice[]> {
  const wanted = city.trim().toLowerCase();
  const offices = await listOffices();
  return offices.filter((office) => office.city.toLowerCase() === wanted);
}
