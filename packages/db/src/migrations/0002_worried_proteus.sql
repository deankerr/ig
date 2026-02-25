-- Make artifacts.model nullable. Same tags-backup strategy as 0001.

DROP INDEX IF EXISTS `idx_tags_target`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_tags_tag`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_tags_tag_value`;--> statement-breakpoint

CREATE TABLE `__backup_tags` AS SELECT * FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint

DROP INDEX IF EXISTS `idx_art_created`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_art_generation`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_art_model_created`;--> statement-breakpoint

CREATE TABLE `__new_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text,
	`model` text,
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
);--> statement-breakpoint

INSERT INTO `__new_artifacts`("id", "generation_id", "model", "r2_key", "content_type", "width", "height", "seed", "cost", "metadata", "created_at", "deleted_at") SELECT "id", "generation_id", "model", "r2_key", "content_type", "width", "height", "seed", "cost", "metadata", "created_at", "deleted_at" FROM `artifacts`;--> statement-breakpoint

DROP TABLE `artifacts`;--> statement-breakpoint
ALTER TABLE `__new_artifacts` RENAME TO `artifacts`;--> statement-breakpoint

CREATE INDEX `idx_art_created` ON `artifacts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_art_generation` ON `artifacts` (`generation_id`);--> statement-breakpoint
CREATE INDEX `idx_art_model_created` ON `artifacts` (`model`,`created_at`);--> statement-breakpoint

CREATE TABLE `tags` (
	`tag` text NOT NULL,
	`value` text,
	`target_id` text NOT NULL,
	PRIMARY KEY(`tag`, `target_id`),
	FOREIGN KEY (`target_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

INSERT INTO `tags`("tag", "value", "target_id") SELECT "tag", "value", "target_id" FROM `__backup_tags`;--> statement-breakpoint
DROP TABLE `__backup_tags`;--> statement-breakpoint

CREATE INDEX `idx_tags_target` ON `tags` (`target_id`);--> statement-breakpoint
CREATE INDEX `idx_tags_tag` ON `tags` (`tag`);--> statement-breakpoint
CREATE INDEX `idx_tags_tag_value` ON `tags` (`tag`,`value`);