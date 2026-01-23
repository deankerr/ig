CREATE TABLE `models` (
	`endpoint_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`license_type` text,
	`kind` text NOT NULL,
	`duration_estimate` integer,
	`thumbnail_url` text,
	`unit_price` real,
	`unit` text,
	`currency` text DEFAULT 'USD',
	`updated_at` integer NOT NULL,
	`synced_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_models_category` ON `models` (`category`);--> statement-breakpoint
CREATE INDEX `idx_models_status` ON `models` (`status`);--> statement-breakpoint
DROP TABLE `account`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
DROP TABLE `verification`;