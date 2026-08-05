import { call } from "./client";

/**
 * Reading Speedy's network: sites (settlements) and the offices in them.
 *
 * Every call here is read-only. Nothing in this file can create a shipment.
 */

export interface SpeedySite {
  id: number;
  /** "София", "Варна" */
  name: string;
  /** "гр.", "с." — Speedy distinguish towns from villages. */
  type: string;
  postCode: string;
  municipality?: string;
  region?: string;
}

export interface SpeedyOffice {
  id: number;
  name: string;
  siteId: number;
  address: string;
  /** Speedy cap what an office will accept; a heavy parcel cannot go there. */
  maxParcelWeight?: number;
  workingTime?: string;
}

interface SiteResponse {
  sites?: {
    id: number;
    name: string;
    type: string;
    postCode: string;
    municipality?: string;
    region?: string;
  }[];
}

interface OfficeResponse {
  offices?: {
    id: number;
    name: string;
    siteId: number;
    address?: { fullAddressString?: string };
    maxParcelWeight?: number;
    workingTimeFrom?: string;
    workingTimeTo?: string;
  }[];
}

/** Settlements matching a name, for the "which town" step of choosing an office. */
export async function findSites(name: string, countryId = 100): Promise<SpeedySite[]> {
  const data = await call<SiteResponse>("/location/site", {
    countryId,
    name,
    language: "BG",
  });

  return (data.sites ?? []).map((site) => ({
    id: site.id,
    name: site.name,
    type: site.type,
    postCode: site.postCode,
    municipality: site.municipality,
    region: site.region,
  }));
}

/** Offices in one settlement. */
export async function findOffices(siteId: number, countryId = 100): Promise<SpeedyOffice[]> {
  const data = await call<OfficeResponse>("/location/office", {
    countryId,
    siteId,
    language: "BG",
  });

  return (data.offices ?? []).map((office) => ({
    id: office.id,
    name: office.name,
    siteId: office.siteId,
    address: office.address?.fullAddressString ?? "",
    maxParcelWeight: office.maxParcelWeight,
    workingTime:
      office.workingTimeFrom && office.workingTimeTo
        ? `${office.workingTimeFrom} - ${office.workingTimeTo}`
        : undefined,
  }));
}
