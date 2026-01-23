ALTER TABLE `models` ADD `thumbnail_animated_url` text;--> statement-breakpoint
ALTER TABLE `models` ADD `model_url` text NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `github_url` text;--> statement-breakpoint
ALTER TABLE `models` ADD `is_favorited` integer;--> statement-breakpoint
ALTER TABLE `models` ADD `date` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `group_key` text;--> statement-breakpoint
ALTER TABLE `models` ADD `group_label` text;