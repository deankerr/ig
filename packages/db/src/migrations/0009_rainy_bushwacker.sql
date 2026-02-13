CREATE TABLE `runware_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`model` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`width` integer,
	`height` integer,
	`seed` integer,
	`cost` real,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`generation_id`) REFERENCES `runware_generations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ra_created` ON `runware_artifacts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ra_generation` ON `runware_artifacts` (`generation_id`);--> statement-breakpoint
CREATE INDEX `idx_ra_model_created` ON `runware_artifacts` (`model`,`created_at`);--> statement-breakpoint
CREATE TABLE `runware_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`input` text NOT NULL,
	`batch` integer NOT NULL,
	`error` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_rg_created` ON `runware_generations` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_rg_model_created` ON `runware_generations` (`model`,`created_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`tag` text NOT NULL,
	`value` text,
	`target_id` text NOT NULL,
	PRIMARY KEY(`tag`, `target_id`),
	FOREIGN KEY (`target_id`) REFERENCES `runware_artifacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tags_target` ON `tags` (`target_id`);--> statement-breakpoint
CREATE INDEX `idx_tags_tag` ON `tags` (`tag`);--> statement-breakpoint
CREATE INDEX `idx_tags_tag_value` ON `tags` (`tag`,`value`);--> statement-breakpoint
DROP TABLE `models`;--> statement-breakpoint
DROP TABLE `presets`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`provider` text DEFAULT 'runware' NOT NULL,
	`model` text NOT NULL,
	`input` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`content_type` text,
	`error_code` text,
	`error_message` text,
	`provider_request_id` text,
	`provider_metadata` text,
	`slug` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_generations`("id", "status", "provider", "model", "input", "tags", "content_type", "error_code", "error_message", "provider_request_id", "provider_metadata", "slug", "created_at", "completed_at") SELECT "id", "status", "provider", "model", "input", "tags", "content_type", "error_code", "error_message", "provider_request_id", "provider_metadata", "slug", "created_at", "completed_at" FROM `generations`;--> statement-breakpoint
DROP TABLE `generations`;--> statement-breakpoint
ALTER TABLE `__new_generations` RENAME TO `generations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `generations_slug_unique` ON `generations` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_generations_created` ON `generations` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_generations_status_created` ON `generations` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_generations_provider_request_id` ON `generations` (`provider_request_id`);--> statement-breakpoint
CREATE INDEX `idx_generations_slug` ON `generations` (`slug`);