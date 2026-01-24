CREATE TABLE `presets` (
	`name` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`input` text,
	`tags` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `generations` ADD `slug` text;--> statement-breakpoint
CREATE UNIQUE INDEX `generations_slug_unique` ON `generations` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_generations_slug` ON `generations` (`slug`);