CREATE TABLE `artifacts` (
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
	`deleted_at` integer,
	FOREIGN KEY (`generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_art_created` ON `artifacts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_art_generation` ON `artifacts` (`generation_id`);--> statement-breakpoint
CREATE INDEX `idx_art_model_created` ON `artifacts` (`model`,`created_at`);--> statement-breakpoint
CREATE TABLE `generations` (
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
CREATE INDEX `idx_gen_created` ON `generations` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_gen_model_created` ON `generations` (`model`,`created_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`tag` text NOT NULL,
	`value` text,
	`target_id` text NOT NULL,
	PRIMARY KEY(`tag`, `target_id`),
	FOREIGN KEY (`target_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tags_target` ON `tags` (`target_id`);--> statement-breakpoint
CREATE INDEX `idx_tags_tag` ON `tags` (`tag`);--> statement-breakpoint
CREATE INDEX `idx_tags_tag_value` ON `tags` (`tag`,`value`);