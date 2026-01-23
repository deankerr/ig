ALTER TABLE `models` ADD `pricing_synced_at` integer;--> statement-breakpoint
ALTER TABLE `models` ADD `sync_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `sync_error` text;--> statement-breakpoint
CREATE INDEX `idx_models_sync_status` ON `models` (`sync_status`);