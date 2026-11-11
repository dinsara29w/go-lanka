-- The client's eight main destinations, so the map, home page and AI tour builder have real
-- places to work with from the start. Photos are the bundled files in public/places/ (see
-- /credits for their sources). Admins can edit or replace everything in /admin/destinations.
-- Existing destinations with the same slug are left untouched.

INSERT INTO destinations
  (name, slug, region, description, hero_image, hero_image_alt, map_region_id, lat, lng, best_season, highlights)
VALUES
  (
    'Colombo', 'colombo', 'West coast',
    'Sri Lanka''s busy commercial capital, where colonial buildings, street markets, temples and the seafront sit side by side. Most journeys start or end here.',
    '/places/colombo.jpg', 'Colombo skyline and seafront', 'colombo', 6.927100, 79.861200,
    'December to March',
    ARRAY['Galle Face Green', 'Gangaramaya Temple', 'Pettah market', 'Lotus Tower']
  ),
  (
    'Pinnawala', 'pinnawala', 'Central Sri Lanka',
    'A village best known for its elephant orphanage, where rescued elephants are cared for and walk down to the river to bathe. An easy stop between Colombo and Kandy.',
    '/places/pinnawala.jpg', 'Elephants at the Pinnawala Elephant Orphanage', 'kegalle', 7.300900, 80.387100,
    'Year round',
    ARRAY['Elephant orphanage', 'Elephants bathing in the river', 'Stop between Colombo and Kandy']
  ),
  (
    'Kandy', 'kandy', 'Hill country',
    'The last royal capital, set around a lake in the hills. Home to the Temple of the Sacred Tooth Relic, botanical gardens and traditional dance.',
    '/places/kandy.jpg', 'Temple of the Sacred Tooth Relic in Kandy', 'kandy', 7.290600, 80.633700,
    'Year round',
    ARRAY['Temple of the Sacred Tooth Relic', 'Kandy Lake', 'Royal Botanic Gardens, Peradeniya', 'Cultural dance show']
  ),
  (
    'Sigiriya', 'sigiriya', 'Cultural Triangle',
    'The towering Lion Rock fortress rises out of the jungle, with frescoes, mirror wall and water gardens. Nearby Pidurangala Rock gives a famous sunrise view of it.',
    '/places/sigiriya.jpg', 'Sigiriya Lion Rock rising above the jungle', 'matale', 7.957000, 80.760300,
    'January to April',
    ARRAY['Sigiriya Lion Rock', 'Water gardens', 'Pidurangala sunrise hike']
  ),
  (
    'Anuradhapura', 'anuradhapura', 'Cultural Triangle',
    'Sri Lanka''s first great capital and a sacred city, with giant white stupas, ancient ponds and the revered Sri Maha Bodhi tree. Mornings are best, before the heat.',
    '/places/anuradhapura.jpg', 'Ruwanwelisaya stupa in Anuradhapura', 'anuradhapura', 8.311400, 80.403700,
    'Year round, mornings are best',
    ARRAY['Ruwanwelisaya stupa', 'Sri Maha Bodhi tree', 'Jetavanaramaya', 'Ancient ruins by bicycle']
  ),
  (
    'Nuwara Eliya', 'nuwara-eliya', 'Hill country',
    'A cool hill town among tea estates, often called Little England. Green slopes, lakes, waterfalls and colonial-era villas.',
    '/places/nuwara-eliya.jpg', 'Tea plantations near Nuwara Eliya', 'nuwara-eliya', 6.949700, 80.789100,
    'January to April',
    ARRAY['Tea estate visit', 'Gregory Lake', 'Waterfalls', 'Cool-weather walks']
  ),
  (
    'Ella', 'ella', 'Hill country',
    'A small hill village with big views: the Nine Arch Bridge, Little Adam''s Peak and Ella Rock. The scenic train ride through tea country ends here.',
    '/places/ella.jpg', 'Nine Arch Bridge in Ella', 'badulla', 6.866700, 81.046600,
    'January to April',
    ARRAY['Nine Arch Bridge', 'Little Adam''s Peak', 'Ella Rock hike', 'Scenic train ride']
  ),
  (
    'Down South', 'down-south', 'South coast',
    'The southern coast: the walled Galle Fort, palm-lined beaches, surf towns and whale watching off Mirissa. The relaxed end of most journeys.',
    '/places/down-south.jpg', 'Beach on the south coast', 'galle', 6.026700, 80.217000,
    'December to April',
    ARRAY['Galle Fort', 'Mirissa whale watching', 'Unawatuna beach', 'Beach time']
  )
ON CONFLICT (slug) DO NOTHING;
