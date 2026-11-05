create table admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text,
  excerpt text not null default '',
  body text[] not null default '{}',
  pillar text,
  date_label text not null default '',
  author text not null default '',
  cover_image text,
  cover_width integer,
  cover_height integer,
  image_alt text not null default '',
  caption text not null default '',
  publish_date date not null,
  status text not null default 'draft',
  featured boolean not null default false,
  photo_consent boolean not null default false,
  name_consent boolean not null default false,
  seo_title text,
  seo_description text,
  slug_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_title_len check (char_length(title) between 1 and 120),
  constraint blog_posts_excerpt_len check (char_length(excerpt) <= 300),
  constraint blog_posts_date_label_len check (char_length(date_label) <= 40),
  constraint blog_posts_author_len check (char_length(author) <= 80),
  constraint blog_posts_alt_len check (char_length(image_alt) <= 200),
  constraint blog_posts_caption_len check (char_length(caption) <= 160),
  constraint blog_posts_seo_title_len check (seo_title is null or char_length(seo_title) <= 120),
  constraint blog_posts_seo_description_len check (seo_description is null or char_length(seo_description) <= 300),
  constraint blog_posts_slug_len check (slug is null or char_length(slug) <= 80),
  constraint blog_posts_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint blog_posts_status_check check (status in ('draft', 'published')),
  constraint blog_posts_pillar_check check (pillar is null or pillar in ('think', 'build', 'belong')),
  constraint blog_posts_body_count check (cardinality(body) <= 8),
  constraint blog_posts_slug_unique unique (slug)
);

create unique index blog_posts_one_featured on blog_posts (featured) where featured;
create index blog_posts_public_order on blog_posts (status, publish_date desc);
