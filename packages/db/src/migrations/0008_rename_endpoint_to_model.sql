-- Rename endpoint column to model in generations table
ALTER TABLE generations RENAME COLUMN endpoint TO model;

-- Rename endpoint column to model in presets table
ALTER TABLE presets RENAME COLUMN endpoint TO model;
