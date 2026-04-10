CREATE TABLE `product_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`source` text DEFAULT 'upload' NOT NULL,
	`original_document_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`file_type` text DEFAULT 'png' NOT NULL,
	`file_size` integer,
	`width` integer,
	`height` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`original_document_id`) REFERENCES `product_documents`(`id`) ON UPDATE no action ON DELETE set null
);
