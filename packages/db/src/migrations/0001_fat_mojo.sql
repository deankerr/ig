CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`endpoint` text NOT NULL,
	`input` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`output_url` text,
	`content_type` text,
	`error_code` text,
	`error_message` text,
	`fal_request_id` text,
	`fal_metrics` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_artifacts_created` ON `artifacts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_artifacts_status_created` ON `artifacts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_artifacts_fal_request_id` ON `artifacts` (`fal_request_id`);