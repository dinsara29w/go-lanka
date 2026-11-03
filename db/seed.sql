-- Non-destructive baseline settings. Client-specific values are entered in admin.
INSERT INTO site_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;
