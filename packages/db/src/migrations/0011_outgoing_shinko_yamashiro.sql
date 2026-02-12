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
CREATE INDEX `idx_tags_tag_value` ON `tags` (`tag`,`value`);