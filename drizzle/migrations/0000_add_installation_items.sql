CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`contact_email` text,
	`contact_phone` text,
	`address` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'link' NOT NULL,
	`url` text NOT NULL,
	`file_type` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`name` text NOT NULL,
	`pixel_pitch` text,
	`price_per_sqm_usd` real,
	`cabinet_size` text,
	`cabinet_resolution` text,
	`pixel_config` text,
	`brightness` text,
	`contrast_ratio` text,
	`refresh_rate` text,
	`viewing_angle` text,
	`weight` text,
	`power_avg` text,
	`power_max` text,
	`ip_rating` text,
	`operating_temp` text,
	`gob` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`brand` text DEFAULT 'Leyard',
	`sub_brand` text DEFAULT 'Standard',
	`category` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`description` text,
	`applications` text,
	`image_url` text,
	`drive_folder` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quote_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_id` integer NOT NULL,
	`action` text NOT NULL,
	`details` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quote_installation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`item_name` text NOT NULL,
	`type` text DEFAULT 'hourly' NOT NULL,
	`hours` real DEFAULT 0,
	`hourly_rate` real,
	`fixed_cost` real DEFAULT 0,
	`margin_override` real,
	`is_free` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quote_line_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`item_name` text NOT NULL,
	`description` text,
	`unit` text DEFAULT 'PCS' NOT NULL,
	`qty` real DEFAULT 1 NOT NULL,
	`usd_unit_price` real DEFAULT 0,
	`margin_override` real,
	`reseller_margin_override` real,
	`is_local` integer DEFAULT false NOT NULL,
	`aud_local_cost` real DEFAULT 0,
	`is_free` integer DEFAULT false NOT NULL,
	`product_id` integer,
	`product_variant_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`quote_number` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`fx_rate` real DEFAULT 0.625 NOT NULL,
	`default_margin` real DEFAULT 0.5 NOT NULL,
	`gst_rate` real DEFAULT 0.1 NOT NULL,
	`default_reseller_margin` real DEFAULT 0.3 NOT NULL,
	`deposit_pct` real DEFAULT 0.5 NOT NULL,
	`second_tranche_pct` real DEFAULT 0.25 NOT NULL,
	`installation_hourly_rate` real DEFAULT 95 NOT NULL,
	`installation_margin` real DEFAULT 0.3 NOT NULL,
	`screen_size` text,
	`panel_config` text,
	`total_resolution` text,
	`supplier_quote_date` text,
	`supplier_quote_ref` text,
	`cached_total_usd` real DEFAULT 0,
	`cached_total_aud_cost` real DEFAULT 0,
	`cached_total_aud_sell_ex_gst` real DEFAULT 0,
	`cached_total_aud_sell_inc_gst` real DEFAULT 0,
	`cached_total_gross_profit` real DEFAULT 0,
	`notes` text,
	`valid_until` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_quote_number_unique` ON `quotes` (`quote_number`);