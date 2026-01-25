ALTER TABLE `models` RENAME COLUMN `local_updated_at` TO `model_synced_at`;--> statement-breakpoint
ALTER TABLE `models` ADD `pricing_synced_at` integer;
