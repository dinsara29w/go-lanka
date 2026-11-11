-- Up Migration
-- Fill in missing map coordinates for the main destinations (used by the route map and PDF quotation).
-- Existing coordinates are never overwritten.
UPDATE destinations d
SET lat = COALESCE(d.lat, v.lat), lng = COALESCE(d.lng, v.lng)
FROM (VALUES
  ('colombo', 6.9271, 79.8612),
  ('pinnawala', 7.3009, 80.3871),
  ('anuradhapura', 8.3114, 80.4037),
  ('sigiriya', 7.957, 80.7603),
  ('kandy', 7.2906, 80.6337),
  ('nuwara-eliya', 6.9497, 80.7891),
  ('ella', 6.8667, 81.0466),
  ('down-south', 6.0267, 80.217)
) AS v(slug, lat, lng)
WHERE d.slug = v.slug AND (d.lat IS NULL OR d.lng IS NULL);
