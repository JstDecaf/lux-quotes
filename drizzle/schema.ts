import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
};

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  notes: text("notes"),
  ...timestamps,
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  brand: text("brand").default("Leyard"),
  subBrand: text("sub_brand").default("Standard"),
  category: text("category"),
  status: text("status").notNull().default("Active"),
  description: text("description"),
  applications: text("applications"), // JSON array
  imageUrl: text("image_url"),
  driveFolder: text("drive_folder"),
  ...timestamps,
});

export const productVariants = sqliteTable("product_variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pixelPitch: text("pixel_pitch"),
  pricePerSqmUsd: real("price_per_sqm_usd"),
  cabinetSize: text("cabinet_size"),
  cabinetResolution: text("cabinet_resolution"),
  pixelConfig: text("pixel_config"),
  brightness: text("brightness"),
  contrastRatio: text("contrast_ratio"),
  refreshRate: text("refresh_rate"),
  viewingAngle: text("viewing_angle"),
  weight: text("weight"),
  powerAvg: text("power_avg"),
  powerMax: text("power_max"),
  ipRating: text("ip_rating"),
  operatingTemp: text("operating_temp"),
  gob: integer("gob", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  ...timestamps,
});

export const quotes = sqliteTable("quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  quoteNumber: text("quote_number").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  fxRate: real("fx_rate").notNull().default(0.625),
  defaultMargin: real("default_margin").notNull().default(0.5),
  gstRate: real("gst_rate").notNull().default(0.1),
  defaultResellerMargin: real("default_reseller_margin").notNull().default(0.3),
  depositPct: real("deposit_pct").notNull().default(0.5),
  secondTranchePct: real("second_tranche_pct").notNull().default(0.25),
  installationHourlyRate: real("installation_hourly_rate").notNull().default(95),
  installationMargin: real("installation_margin").notNull().default(0.3),
  installationQuotedBy: text("installation_quoted_by").notNull().default("lux"),
  screenSize: text("screen_size"),
  panelConfig: text("panel_config"),
  totalResolution: text("total_resolution"),
  supplierQuoteDate: text("supplier_quote_date"),
  supplierQuoteRef: text("supplier_quote_ref"),
  cachedTotalUsd: real("cached_total_usd").default(0),
  cachedTotalAudCost: real("cached_total_aud_cost").default(0),
  cachedTotalAudSellExGst: real("cached_total_aud_sell_ex_gst").default(0),
  cachedTotalAudSellIncGst: real("cached_total_aud_sell_inc_gst").default(0),
  cachedTotalGrossProfit: real("cached_total_gross_profit").default(0),
  notes: text("notes"),
  validUntil: text("valid_until"),
  ...timestamps,
});

export const quoteLineItems = sqliteTable("quote_line_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  itemName: text("item_name").notNull(),
  description: text("description"),
  unit: text("unit").notNull().default("PCS"),
  qty: real("qty").notNull().default(1),
  usdUnitPrice: real("usd_unit_price").default(0),
  marginOverride: real("margin_override"),
  resellerMarginOverride: real("reseller_margin_override"),
  isLocal: integer("is_local", { mode: "boolean" }).notNull().default(false),
  audLocalCost: real("aud_local_cost").default(0),
  isFree: integer("is_free", { mode: "boolean" }).notNull().default(false),
  productId: integer("product_id").references(() => products.id),
  productVariantId: integer("product_variant_id").references(() => productVariants.id),
  ...timestamps,
});

export const productDocuments = sqliteTable("product_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("link"), // brochure, manual, spec_sheet, video, link
  url: text("url").notNull(),
  fileType: text("file_type"), // pdf, xlsx, mp4, web
  notes: text("notes"),
  ...timestamps,
});

export const quoteInstallationItems = sqliteTable("quote_installation_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  itemName: text("item_name").notNull(),
  type: text("type").notNull().default("hourly"), // "hourly" | "fixed"
  hours: real("hours").default(0),
  hourlyRate: real("hourly_rate"),              // null = use quote default
  fixedCost: real("fixed_cost").default(0),
  marginOverride: real("margin_override"),       // null = use quote installation_margin
  isFree: integer("is_free", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  ...timestamps,
});

export const quoteHistory = sqliteTable("quote_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
