import fs from "node:fs/promises";
import path from "node:path";
import type { ExecArgs, RemoteQueryFunction } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { CATEGORY_TREE, validateProductsFile, type CategoryNode } from "@redpoint/catalog";
// No .js extension: this is a CommonJS project and `medusa exec` resolves
// against the TypeScript sources, where only map-product.ts exists.
import { mapProduct, toStaticPath, type MappingWarning } from "./map-product";

/**
 * Seeds the store from `seed/products.json`.
 *
 * Everything goes through Medusa workflows rather than direct writes. Bypassing
 * them leaves inventory items and search indexes unbuilt, which then fails much
 * later and much less obviously.
 *
 *   pnpm --filter @redpoint/backend seed
 *
 * Safe to re-run: each step checks for what it already created.
 */

/* What the container actually hands back for ContainerRegistrationKeys.QUERY.
   It strips the symbol-keyed members off RemoteQueryFunction, so referring to
   that type directly does not compile. */
type MedusaQuery = Omit<RemoteQueryFunction, symbol>;

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const PRODUCTS_FILE = path.join(REPO_ROOT, "seed", "products.json");
const IMAGES_SOURCE = path.join(REPO_ROOT, "seed", "images");
const IMAGES_DEST = path.join(process.cwd(), "static", "products");

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const SALES_CHANNEL_NAME = "Red Point";
const REGION_NAME = "България";

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const storeModule = container.resolve(Modules.STORE);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT);

  // --- store and sales channel ---------------------------------------------

  const [store] = await storeModule.listStores();
  if (!store) throw new Error("no store found; run migrations first");

  let [salesChannel] = await salesChannelModule.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  });
  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    });
    salesChannel = result[0]!;
    logger.info(`created sales channel ${salesChannel.name}`);
  }

  // --- region ---------------------------------------------------------------
  // EUR is the store currency. BGN is never a second price list; the storefront
  // derives it from the fixed peg at render time.

  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
  });
  let regionId = existingRegions.find((region) => region.name === REGION_NAME)?.id;

  if (!regionId) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: "eur",
            countries: ["bg"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    regionId = result[0]!.id;
    logger.info("created region България (EUR)");
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          { currency_code: "eur", is_default: true },
          // BGN is listed so the admin can display it, but no BGN price list
          // is ever created. See packages/design-system and the storefront's
          // price helper for the single conversion point.
          { currency_code: "bgn" },
        ],
        default_sales_channel_id: salesChannel.id,
        default_region_id: regionId,
      },
    },
  });

  // --- tax ------------------------------------------------------------------

  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  });
  if (!existingTaxRegions.some((region) => region.country_code === "bg")) {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "bg",
          default_tax_rate: { name: "ДДС", code: "bg-vat", rate: 20 },
        },
      ],
    });
    logger.info("created tax region BG at 20 percent");
  }

  // --- stock location and fulfillment --------------------------------------
  // One location for now. The three physical shops are not inventory locations
  // in this model; the old site scopes stock per shop but that decision is
  // deferred until the client confirms whether online orders draw from a
  // single warehouse or from shop stock.

  const { data: existingLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  });
  let stockLocationId = existingLocations.find((l) => l.name === "Склад Варна")?.id;

  if (!stockLocationId) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Склад Варна",
            address: { city: "Варна", country_code: "BG", address_1: "" },
          },
        ],
      },
    });
    stockLocationId = result[0]!.id;
    logger.info("created stock location");
  }

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocationId, add: [salesChannel.id] },
  });

  const shippingProfiles = await fulfillmentModule.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles[0];
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Стандартен", type: "default" }] },
    });
    shippingProfile = result[0]!;
  }

  /* The relations have to be requested explicitly. Without them a re-run finds
     the existing set, sees no service_zones on it, and dies claiming the set
     has no zone even though it does. */
  const existingFulfillmentSets = await fulfillmentModule.listFulfillmentSets(
    { name: "Доставка България" },
    { relations: ["service_zones"] },
  );
  let fulfillmentSet = existingFulfillmentSets[0];
  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModule.createFulfillmentSets({
      name: "Доставка България",
      type: "shipping",
      service_zones: [{ name: "България", geo_zones: [{ country_code: "bg", type: "country" }] }],
    });
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    });
    logger.info("created fulfillment set for Bulgaria");
  }

  const serviceZone = fulfillmentSet.service_zones?.[0];
  if (!serviceZone) throw new Error("fulfillment set has no service zone");

  const { data: existingShippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  });

  /* Placeholders using the manual provider so checkout can be exercised end to
     end before Phase 6. The real Speedy and Econt providers replace these. */
  const courierOptions = [
    { name: "Спиди - до офис", amount: 5 },
    { name: "Еконт - до офис", amount: 5 },
    { name: "Спиди - до адрес", amount: 7 },
  ];

  for (const option of courierOptions) {
    if (existingShippingOptions.some((existing) => existing.name === option.name)) continue;
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: option.name,
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfile.id,
          type: { label: option.name, description: option.name, code: "standard" },
          prices: [{ currency_code: "eur", amount: option.amount }],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    });
  }
  logger.info("shipping options ready (placeholders until Phase 6)");

  // --- publishable api key --------------------------------------------------
  // The storefront cannot read the Store API without one, so it belongs in the
  // seed rather than in a manual step someone has to remember in Phase 4.

  const { data: existingKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "title", "token"],
  });
  let publishableKey = existingKeys.find((key) => key.title === SALES_CHANNEL_NAME);

  if (!publishableKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: SALES_CHANNEL_NAME, type: "publishable", created_by: "seed" }],
      },
    });
    publishableKey = result[0]!;
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: publishableKey.id, add: [salesChannel.id] },
    });
    logger.info("created publishable api key");
  }
  logger.info(`storefront key: ${publishableKey.token}`);

  // --- categories -----------------------------------------------------------

  const categoryIdByKey = await seedCategories(container, query, logger);

  // --- products -------------------------------------------------------------

  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(PRODUCTS_FILE, "utf8"));
  } catch {
    logger.warn(
      `no ${PRODUCTS_FILE}; store is configured but empty. Run the scraper or ` +
        `import the client's export first.`,
    );
    return;
  }

  const parsed = validateProductsFile(raw);
  if (!parsed.success) {
    throw new Error(
      `seed/products.json failed validation:\n` +
        parsed.error.issues.slice(0, 20).map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }

  await copyImages(logger);

  const warnings: MappingWarning[] = [];
  const mapped = parsed.data.products.map((product) =>
    mapProduct(
      product,
      {
        categoryIds: product.categoryKeys
          .map((key) => categoryIdByKey.get(key))
          .filter((id): id is string => Boolean(id)),
        salesChannelId: salesChannel.id,
        shippingProfileId: shippingProfile.id,
        imageUrl: (repoPath) => `${BACKEND_URL}/static/${toStaticPath(repoPath)}`,
      },
      warnings,
    ),
  );

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  });
  const existingHandles = new Set(existingProducts.map((product) => product.handle));
  const toCreate = mapped.filter((product) => !existingHandles.has(product.handle));

  if (toCreate.length === 0) {
    logger.info("every product already exists, nothing to create");
  } else {
    const { result: created } = await createProductsWorkflow(container).run({
      input: {
        products: toCreate.map(({ variants, ...product }) => ({
          ...product,
          variants: variants.map(({ seedQuantity, ...variant }) => variant),
        })),
      },
    });
    logger.info(`created ${created.length} products`);

    await seedInventory(container, query, toCreate, stockLocationId, logger);
  }

  for (const warning of warnings) {
    logger.warn(`${warning.sku}: ${warning.message}`);
  }
  logger.info(
    "stock quantities are PLACEHOLDERS. The scraper could not identify the " +
      "old site's sold-out marker, so availability is unverified.",
  );
}

/** Walks the category tree depth first so parents exist before their children. */
async function seedCategories(
  container: ExecArgs["container"],
  query: MedusaQuery,
  logger: { info: (message: string) => void },
): Promise<Map<string, string>> {
  const { data: existing } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  });
  const idByKey = new Map<string, string>(
    existing.map((category: { handle: string; id: string }) => [category.handle, category.id]),
  );

  const createLevel = async (nodes: CategoryNode[], parentKey: string | null) => {
    const missing = nodes.filter((node) => !idByKey.has(node.key));
    if (missing.length > 0) {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: missing.map((node) => ({
            name: node.name,
            handle: node.key,
            is_active: true,
            parent_category_id: parentKey ? idByKey.get(parentKey) : undefined,
          })),
        },
      });
      for (const category of result) {
        idByKey.set(category.handle, category.id);
      }
    }
    for (const node of nodes) {
      if (node.children?.length) await createLevel(node.children, node.key);
    }
  };

  await createLevel(CATEGORY_TREE, null);
  logger.info(`categories ready (${idByKey.size} total)`);
  return idByKey;
}

/** Sets placeholder stock on every variant's inventory item. */
async function seedInventory(
  container: ExecArgs["container"],
  query: MedusaQuery,
  mapped: { variants: { sku: string; seedQuantity: number }[] }[],
  stockLocationId: string,
  logger: { info: (message: string) => void },
): Promise<void> {
  const quantityBySku = new Map<string, number>();
  for (const product of mapped) {
    for (const variant of product.variants) {
      quantityBySku.set(variant.sku, variant.seedQuantity);
    }
  }

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "inventory_items.inventory_item_id"],
  });

  const levels = variants.flatMap(
    (variant: { sku: string | null; inventory_items?: { inventory_item_id: string }[] }) => {
      const quantity = variant.sku ? quantityBySku.get(variant.sku) : undefined;
      if (quantity === undefined) return [];
      return (variant.inventory_items ?? []).map((item) => ({
        location_id: stockLocationId,
        stocked_quantity: quantity,
        inventory_item_id: item.inventory_item_id,
      }));
    },
  );

  if (levels.length === 0) return;
  await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: levels } });
  logger.info(`set stock on ${levels.length} inventory levels`);
}

/** Copies scraped photography into the folder the local file provider serves. */
async function copyImages(logger: { info: (m: string) => void; warn: (m: string) => void }) {
  try {
    await fs.access(IMAGES_SOURCE);
  } catch {
    logger.warn(`no ${IMAGES_SOURCE}; products will reference missing images`);
    return;
  }
  await fs.mkdir(path.dirname(IMAGES_DEST), { recursive: true });
  await fs.cp(IMAGES_SOURCE, IMAGES_DEST, { recursive: true, force: false, errorOnExist: false });
  logger.info(`copied photography into ${IMAGES_DEST}`);
}
