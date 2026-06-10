-- Insert default system categories (user_id = null, is_default = true)
insert into public.categories (id, user_id, name, color, is_default) values
  (gen_random_uuid(), null, 'Tools & Apps',   '#378ADD', true),
  (gen_random_uuid(), null, 'Courses',         '#1D9E75', true),
  (gen_random_uuid(), null, 'Opportunities',   '#BA7517', true),
  (gen_random_uuid(), null, 'Inspiration',     '#7F77DD', true),
  (gen_random_uuid(), null, 'Resources',       '#639922', true),
  (gen_random_uuid(), null, 'News & Trends',   '#D85A30', true),
  (gen_random_uuid(), null, 'Locations',       '#D4537E', true),
  (gen_random_uuid(), null, 'Reference',       '#888780', true);
