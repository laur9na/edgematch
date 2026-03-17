-- Phase 8.5: Add instagram_handle, profile_photo_url, media_urls to athletes
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS instagram_handle  text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS media_urls        text[] DEFAULT '{}';
