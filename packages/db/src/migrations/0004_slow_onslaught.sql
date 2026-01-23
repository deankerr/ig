ALTER TABLE `models` RENAME COLUMN "date" TO "upstream_created_at";--> statement-breakpoint
ALTER TABLE `models` RENAME COLUMN "updated_at" TO "upstream_updated_at";--> statement-breakpoint
ALTER TABLE `models` RENAME COLUMN "synced_at" TO "local_updated_at";--> statement-breakpoint
DROP INDEX `idx_models_sync_status`;--> statement-breakpoint
ALTER TABLE `models` DROP COLUMN `pricing_synced_at`;--> statement-breakpoint
ALTER TABLE `models` DROP COLUMN `sync_status`;