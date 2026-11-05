-- Theme of the Year calendar (CALENDAR_SPEC.md §9). Blog tables are not touched.

create table cal_years (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 20),
  theme_name text not null check (char_length(theme_name) between 1 and 40),
  first_month date not null check (extract(day from first_month) = 1),
  last_month date not null check (extract(day from last_month) = 1),
  month_lines jsonb not null default '{}' check (jsonb_typeof(month_lines) = 'object'),
  is_current boolean not null default false,
  seo_title text not null default '' check (char_length(seo_title) <= 200),
  seo_description text not null default '' check (char_length(seo_description) <= 300),
  share_image text check (share_image is null or share_image ~ '^/api/calendar/photos/[a-f0-9]{32}\.webp$'),
  share_image_alt text not null default '' check (char_length(share_image_alt) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_month >= first_month)
);
create unique index cal_years_one_current on cal_years (is_current) where is_current;
create unique index cal_years_label on cal_years (label);

-- Groups have parent_id null. Options point to their group.
create table cal_filters (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references cal_years(id) on delete cascade,
  parent_id uuid references cal_filters(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 40),
  is_main boolean not null default false,
  show_on_site boolean not null default true,
  color_key text check (color_key is null or color_key in ('sage','coral','grey','sun','slate')),
  sort smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or is_main = false)
);
create unique index cal_filters_name on cal_filters (year_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create unique index cal_filters_one_main on cal_filters (year_id) where is_main;
create index cal_filters_parent on cal_filters (parent_id, sort);

create table cal_events (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references cal_years(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  slug_locked boolean not null default false,
  title text not null check (char_length(title) between 1 and 90),
  subtitle text not null default '' check (char_length(subtitle) <= 120),
  start_date date not null,
  end_date date,
  moved_from date,
  strand_id uuid not null references cal_filters(id) on delete restrict,
  option_ids uuid[] not null default '{}',
  grades_label text not null default '' check (char_length(grades_label) <= 40),
  body text not null default '' check (char_length(body) <= 1200),
  highlights text[] not null default '{}' check (cardinality(highlights) <= 6),
  recap text not null default '' check (char_length(recap) <= 600),
  recap_published boolean not null default false,
  photo_consent boolean not null default false,
  seo_title text not null default '' check (char_length(seo_title) <= 200),
  seo_description text not null default '' check (char_length(seo_description) <= 300),
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (recap_published = false or (photo_consent and status = 'published')),
  unique (year_id, slug)
);
create index cal_events_public on cal_events (year_id, status, start_date);
create index cal_events_options on cal_events using gin (option_ids);
create index cal_events_strand on cal_events (strand_id);

create table cal_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references cal_events(id) on delete cascade,
  file text not null check (file ~ '^/api/calendar/photos/[a-f0-9]{32}\.webp$'),
  thumb text not null check (thumb ~ '^/api/calendar/photos/[a-f0-9]{32}-w640\.webp$'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt text not null check (char_length(alt) between 1 and 160),
  caption text not null default '' check (char_length(caption) <= 120),
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);
create index cal_photos_event on cal_photos (event_id, sort);

create table cal_rhythm (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references cal_years(id) on delete cascade,
  strand_id uuid not null references cal_filters(id) on delete restrict,
  when_label text not null check (char_length(when_label) between 1 and 40),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 300),
  caption text not null default '' check (char_length(caption) <= 60),
  photo text check (photo is null or photo ~ '^/api/calendar/photos/[a-f0-9]{32}\.webp$'),
  photo_alt text not null default '' check (char_length(photo_alt) <= 160),
  sort smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cal_rhythm_year on cal_rhythm (year_id, sort);
