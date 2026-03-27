-- Add photo_url column to logistics.venues for venue photo display

alter table logistics.venues
  add column if not exists photo_url text;
