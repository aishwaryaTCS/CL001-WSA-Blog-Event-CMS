# Theme of the Year calendar

Build spec for the second CMS module. The same admin who publishes notes also runs the school year calendar on `/theme-of-the-year`. First the plan goes up, then the photos after each event.

The module is built inside `CL001-WSA-Blog-CMS`, next to the blog. Same server, same database, same login, same packages. The blog module (`SPEC.md`) keeps working as it does now. The only blog files it touches are the three shared lines listed in [Files](#14-files).

Build order: migration and seed, public API, website loader (so the public page keeps working with seeded data), admin screens, photo upload, then hosting.

---

## 1. Purpose

Today every event on `/theme-of-the-year` lives in `src/data/theme-year.ts`. A developer has to edit and redeploy for each change, and the "Event photos · After the event" panel is always empty.

With this module the school admin, without a developer:

1. **Plans**: puts each event on the calendar with its date, strand, grades, and "The plan" text.
2. **Promotes**: publishes it, so parents see it as upcoming.
3. **Proves**: after the event, adds up to 20 photos and a short recap. The event is then shown as completed.

The admin also manages the monthly theme lines, the filter strands, the all-year rhythm cards, and the page's search and share text.

## 2. Words

| Word | Meaning |
| --- | --- |
| Year | One academic year, such as `2026–27`, with its theme name (`Roots to Wings`), first month, and last month. Only one year is *current*. |
| Month | One month of the current year, with its line, such as `Strong Roots · Integrity`. |
| Strand | The main category and its colour, such as `Field Visits & Stay Over`. Each event has one strand. This is the existing "Filter by strand". |
| Filter group | An extra filter that the admin adds, such as `Grade`. It has options, such as `Nursery`, `Grade 1`, and so on. An event can have several options. |
| Event | One dated item on the calendar. It can span several days (`15–23 July`). |
| Plan | The part of an event the admin writes before it happens: title, subtitle, body, "What happens" points. |
| Recap | The part the admin adds after it happens: photos and an optional short paragraph. |
| Rhythm item | A card in "All year · the steady rhythm", which has no date. |
| Today | The date in `Asia/Kolkata`, as in the blog spec. |

## 3. People

| Who | What they need |
| --- | --- |
| Parent (current) | Open the page on a phone, land on **this month**, see what is coming for their child's grade, and see photos from the events that are done. Share one event on WhatsApp. |
| Prospective parent | See that the year is real and full. Completed events with photos are the proof. |
| School admin | One sign-in. Choose Notes or Calendar. See at a glance which past events still need photos. Upload a batch of phone photos without resizing them first. |
| Search engines and link previews | A proper title, description and image for the page and for a shared event link. |

There are no teacher or parent accounts.

## 4. Included

- After sign-in, a home screen with two choices: **Notes** and **Calendar**. The header has both links, so the admin can switch at any time.
- Calendar dashboard: what needs attention.
- Events: create, edit, save draft, preview, publish, unpublish, cancel, delete a draft.
- Recap: up to 20 photos per event, with alt text, order, and an optional caption, plus a recap paragraph and a consent tick.
- Months: edit the line for each month.
- Strands: add, rename, recolour (from the brand palette only), reorder, hide.
- Filter groups: add a group (for example `Grade`) and its options, choose if it shows on the site, reorder, hide.
- Rhythm items: add, edit, reorder, hide, with an optional photo.
- Page settings: theme name, year label, search title, search description, share image.
- Years: create the next year and make it current. Strands, filter groups, and rhythm items are copied. Events are not.
- Seed: everything in `theme-year.ts` today is copied into the database once, so the page looks the same on day one.

## 5. Left out

Kept out on purpose, so the module stays small:

- Teacher logins, roles, a second admin, approval steps, revision history, an audit log.
- A separate public page per event. A shared event uses a link to the same page (see [7.4](#74-share-one-event)).
- A drag-and-drop page builder. Hero copy and the closing band stay in the website code.
- Free colour picking. Strands use brand colour pairs only.
- Video, PDF attachments, comments, likes, RSVP, reminders, email, or WhatsApp sending.
- Site-wide SEO editing for other pages. Other pages keep their `pageMeta` in code. (See [15. Later](#15-later-if-the-school-asks).)
- Showing past years on the site. Old years stay in the database, but only the current year is public.

## 6. Decisions

### 6.1 Database: same database, new tables

**Use the same `wellspringscms` database, with new tables that start with `cal_`.**

- One admin login means one `admins` table and one cookie. With a second database, the calendar would need its own login or a second connection only to check the session.
- One backup and one restore cover everything. One migration runner (`schema_migrations`) keeps working.
- The blog tables are not touched. The `cal_` prefix keeps the two modules apart in pgAdmin.
- A separate database only makes sense when a different team, server, or security boundary owns the data. That is not the case here.

A Postgres schema (`calendar.events`) would also work, but the blog uses plain tables in `public`. For a project this size, keeping one convention matters more.

### 6.2 Photos: files on disk, paths in Postgres

Postgres *can* store images (`bytea` or large objects). **Don't do it.**

- Every photo would be read through the database. The database and every backup would grow by gigabytes each year. With 100 events × 20 photos × about 300 KB, that is about 600 MB a year.
- Images in the database can't be cached by nginx or a CDN as easily as plain files.

Do what the blog already does:

- Sharp re-encodes every upload to WebP and removes camera data (GPS location of children's school). The original is not kept.
- Files are saved under `uploads/calendar/` with random names. The database stores the path, width, height, alt text, and order.
- The CMS serves them at `/api/calendar/photos/:name` with `Cache-Control: public, max-age=31536000, immutable`. A replaced photo gets a new name, so caching never shows an old one.
- **Hosting rule:** `uploads/` must be on a persistent disk (a VPS disk or a mounted volume). Platforms with a disk that resets on deploy (most free container hosts) would delete the photos. If the school hosts on one of those, swap `savePhoto()` to an S3-compatible bucket (Cloudflare R2, DigitalOcean Spaces). Only the URL stored in the database changes, and the pages stay the same. That is the same promise the blog spec makes.

### 6.3 Photo URLs on the live site

This is the step that usually breaks after hosting.

The website builds image URLs from `CMS_API_URL`. Locally that is `http://localhost:3002`, which a parent's phone cannot open. In production:

- Run the CMS at a public HTTPS address, for example `https://cms.wellspringsacademy.in`.
- The calendar API returns **relative** photo paths (`/api/calendar/photos/abc.webp`). The website adds `CMS_PUBLIC_URL` in front of them. Server-to-server reads use `CMS_API_URL`, which can stay internal (`http://127.0.0.1:3002`).
- The blog builds its cover URLs from `CMS_API_URL`. If that stays internal in production, blog covers will break the same way. The simple fix, with no blog code change: in production set `CMS_API_URL` to the public CMS address as well.

### 6.4 "Reflected immediately"

- The website renders `/theme-of-the-year` on the server and reads the CMS on every request, as the blog does.
- `GET /api/calendar` sends `Cache-Control: no-cache` with an ETag. Express adds the ETag by default. Every request checks with the CMS, and an unchanged calendar costs only a `304` response.
- Photo files are cached forever because their names never repeat.
- Result: a publish shows on the site when the parent next opens or refreshes the page.

### 6.5 Admin UI style

The calendar admin uses the same server-rendered HTML as the notes admin, with the same `admin.css` tokens (paper, ink, Lora, Inter, JetBrains Mono, sage, coral, sun) and the same nonce CSP. There is no React app, build step, or new package.

The editor preview reuses the website's own look: the month rail, the event card, and the two-column overlay ("The plan" / "Event photos"). The admin sees exactly what parents will see.

## 7. Requirements

### 7.1 Event lifecycle

Stored fields: `status` (`draft`, `published`, or `cancelled`) and `recap_published` (yes or no).

The admin sees a derived state:

| State | Rule | On the site |
| --- | --- | --- |
| Draft | `status = draft` | Not shown. |
| Upcoming | published, and the end date is today or later | Shown. The card has an **Upcoming** tag, or **Today** on the day. The photos panel says "Photos will be added after the event." |
| Needs photos | published, the end date is before today, and the recap is not published | Shown with no tag. The photos panel uses the same line. **Listed on the dashboard as a to-do.** |
| Completed | published, and the recap is published | Shown with a **Photos** tag and the photo count. The overlay shows the carousel and the recap. |
| Cancelled | `status = cancelled` | Shown with a **Cancelled** tag and greyed out. A parent who saw it earlier is not left guessing. |

Rules:

- A recap can be published only on or after the event's start date, and only with at least one photo and the consent tick.
- When the admin changes the date of a published event, the editor asks "Show 'Moved from 12 Aug' on the site?". If yes, `moved_from` is set and the card shows it.
- A published event is unpublished or cancelled, never deleted. A draft can be deleted after confirmation, and its photo files are deleted with it.
- Unpublishing the recap hides the photos but keeps them.

### 7.2 Event fields

| Field | Rule |
| --- | --- |
| Title | Required. 1–90 characters. |
| Subtitle | 0–120 characters. The italic line under the title. |
| Start date | Required. It must be inside the year's months. |
| End date | Optional. If set, it must be on or after the start date. The card shows `15–23 Jul`. Today a range like this is written into the subtitle by hand. |
| Strand | Required. One active strand. |
| Filter options | Zero or more options from active filter groups. |
| Grades label | 0–40 characters, such as `Nursery – Grade 2`, shown as typed. The editor suggests a label from the chosen Grade options, and the admin can change it. |
| The plan (body) | Required for publish. 1–1200 characters. Plain text with paragraph breaks only, no HTML. |
| What happens | 0–6 points, each 1–140 characters. |
| Recap | 0–600 characters. Shown above the photos once the recap is published. |
| Photos | 0–20. Each has alt text (required, 1–160 characters, pre-filled as "Photo from {title}") and an optional caption (0–120 characters). The order is set by dragging, or with up and down buttons on mobile. |
| Photo consent | A tick: "Every child shown has photo consent on file with the school." It is required to publish the recap. It is cleared when a photo is added after a publish. |
| Slug | Made from the date and the title (`2026-08-05-market-day`), with `-2` added on a clash. It is locked once published, so shared links keep working. |

Photo upload:

- JPEG, PNG, WebP, or HEIC from a phone, if Sharp on the host supports HEIC. Otherwise the error asks for JPEG. Up to 10 MB each.
- The admin can select many files at once. The browser sends **one request per photo**, one after another, and shows progress for each file. One failed file does not stop the rest.
- Each photo is saved in two sizes: 1600 px on the long edge (shown in the overlay) and 640 px (the carousel thumbnail and the share image). Both are WebP at quality 80 with camera data removed.

### 7.3 Strands and filter groups

- Strand: a name (1–40 characters), a colour key, an order, and active (yes or no).
- The colour key is chosen from brand pairs that already exist in the website's `src/styles.css`. Today these are `sage` (`--sage-700` / `--sage-200`), `coral`, `grey`, `sun`, and `slate`. The admin sees swatches, never a hex field. The text on each colour must pass WCAG AA contrast, so only pairs checked once by the developer are offered.
- Filter group: a name (`Grade`), an order, "show on site" (yes or no), and options (name and order).
- A strand or option that is in use can't be deleted, only hidden. A hidden strand disappears from the filter, but its events stay visible under it.
- On the site, filters are chip rows: the strand row (as today), then one row for each visible filter group. Each row picks one value or "All". Rows combine with AND. The month counts follow the filters, as they do today.

### 7.4 Share one event

Parents share one event on WhatsApp. That needs a link that opens it.

- The page reads `?month=2026-08&event=2026-08-05-market-day` from the URL. Opening the overlay or changing the month updates the URL with `replace`, so the back button still leaves the page.
- When `event` is in the URL, the server-rendered `<head>` uses the event title as the share title, the subtitle as the share description, and the first recap photo (640 px) as the share image. Without a photo, it uses the page's share image.
- The canonical URL stays `/theme-of-the-year`, so search engines index one page, not a hundred near-copies.
- The overlay gets a **Copy link** button. It copies the link only and tracks nothing new.

### 7.5 Public page behaviour

- It opens on **the current Kolkata month** when that month is in the current year, otherwise on the first month. Today the page always opens on June 2026.
- The hero eyebrow `Theme of the Year · {year label}` and the theme name come from the year. *Note: the code says `2027–28`, but the events run from May 2026 to April 2027. Confirm the right label with the school.*
- Month lines come from the months table.
- The rhythm section reads rhythm items. A real photo is shown when one is set, otherwise the current placeholder.
- If the CMS is down, the hero and the closing band still render. The calendar section shows "The calendar is not available right now." The rhythm section is hidden. The page does not fall back to `theme-year.ts`. That is the same rule as the blog, so the site never shows old dates as if they were current.

### 7.6 Page SEO and settings

One settings row per year:

| Field | Rule |
| --- | --- |
| Theme name | 1–40 characters (`Roots to Wings`). |
| Year label | 1–20 characters (`2026–27`). |
| Search title | 1–70 characters. A counter warns above 60. |
| Search description | 1–160 characters. A counter warns above 155. |
| Share image | One uploaded photo (1200×630 crop), with alt text. Without one, the current hero image is used. |

The editor shows a Google-style preview of the title and description.

### 7.7 Dashboard

`/admin/calendar` shows, for the current year:

1. **Needs photos**: past events with no published recap, oldest first, each with an "Add photos" button. This is the screen the admin uses most.
2. **Coming up**: the next 14 days.
3. **Drafts**.
4. A count of events per month, by state.

## 8. Admin screens

All screens are under `/admin`, behind `requireAdmin`, with `noindex` and `no-store` (already applied to `/admin*` in `index.ts`).

| Screen | Path | Contents |
| --- | --- | --- |
| Home | `/admin/home` | Two large cards, **Notes from school** and **Theme of the Year calendar**, each with a one-line status ("3 drafts", "5 events need photos"). |
| Calendar dashboard | `/admin/calendar` | As in [7.7](#77-dashboard). A year switcher sits at the top when there is more than one year. |
| Events | `/admin/calendar/events` | The same month rail as the website on the left. The right side lists event cards with state tags. Filters: strand and state. Button: **New event**. |
| Event editor | `/admin/calendar/events/:id` | Two tabs matching the overlay: **The plan** and **After the event** (photos and recap). Sticky bar: Save draft, Preview, Publish / Unpublish, Cancel event, and Delete for drafts. A line names whatever is missing before Publish ("Add a body"). |
| Preview | `/admin/calendar/events/:id/preview` | The card and the overlay exactly as on the site, with "Only you can see this." |
| Months | `/admin/calendar/months` | One row per month with its line. Saved with one button. |
| Strands & filters | `/admin/calendar/filters` | Strands list and filter groups, as in [7.3](#73-strands-and-filter-groups). |
| All-year rhythm | `/admin/calendar/rhythm` | Card list: strand, "when" (`Every morning`), title, body, caption, photo, order, active. |
| Page & SEO | `/admin/calendar/settings` | As in [7.6](#76-page-seo-and-settings). |
| Years | `/admin/calendar/years` | List, **Create next year** (label, theme, first month, last month), **Make current**. |

Mobile: every screen works at 375 px wide. The admin will often add photos from a phone right after an event, so the photo tab must be easy to use with a thumb.

Accessibility: every control has a visible label, errors are in a live region, and the drag order has up and down buttons as a keyboard alternative.

## 9. Data

Migration `db/migrations/004_calendar.sql`. All tables use `uuid` keys with `gen_random_uuid()`, plus `created_at` and `updated_at`, the same as `blog_posts`.

```sql
create table cal_years (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 20),
  theme_name text not null check (char_length(theme_name) between 1 and 40),
  first_month date not null,            -- first day of first month
  last_month date not null,             -- first day of last month
  is_current boolean not null default false,
  seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (seo_description is null or char_length(seo_description) <= 160),
  share_image text, share_image_alt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_month >= first_month)
);
create unique index cal_years_one_current on cal_years (is_current) where is_current;

create table cal_months (
  year_id uuid not null references cal_years(id) on delete cascade,
  month date not null,                  -- first day of month
  line text not null default '' check (char_length(line) <= 80),
  primary key (year_id, month)
);

create table cal_strands (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references cal_years(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color_key text not null check (color_key in ('sage','coral','grey','sun','slate')),
  sort smallint not null default 0,
  active boolean not null default true,
  unique (year_id, name)
);

create table cal_filter_groups (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references cal_years(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  sort smallint not null default 0,
  show_on_site boolean not null default true,
  active boolean not null default true,
  unique (year_id, name)
);

create table cal_filter_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references cal_filter_groups(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  sort smallint not null default 0,
  active boolean not null default true,
  unique (group_id, name)
);

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
  strand_id uuid not null references cal_strands(id) on delete restrict,
  grades_label text not null default '' check (char_length(grades_label) <= 40),
  body text not null default '' check (char_length(body) <= 1200),
  highlights text[] not null default '{}' check (cardinality(highlights) <= 6),
  recap text not null default '' check (char_length(recap) <= 600),
  recap_published boolean not null default false,
  photo_consent boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  unique (year_id, slug)
);
create index cal_events_public on cal_events (year_id, status, start_date);

create table cal_event_options (
  event_id uuid not null references cal_events(id) on delete cascade,
  option_id uuid not null references cal_filter_options(id) on delete restrict,
  primary key (event_id, option_id)
);

create table cal_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references cal_events(id) on delete cascade,
  file text not null,                   -- /api/calendar/photos/<hex>.webp
  thumb text not null,                  -- /api/calendar/photos/<hex>-w640.webp
  width integer not null, height integer not null,
  alt text not null check (char_length(alt) between 1 and 160),
  caption text not null default '' check (char_length(caption) <= 120),
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);
create index cal_photos_event on cal_photos (event_id, sort);

create table cal_rhythm (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references cal_years(id) on delete cascade,
  strand_id uuid not null references cal_strands(id) on delete restrict,
  when_label text not null check (char_length(when_label) between 1 and 40),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 300),
  caption text not null default '' check (char_length(caption) <= 60),
  photo text, photo_alt text not null default '',
  sort smallint not null default 0,
  active boolean not null default true
);
```

The 20-photo limit is checked in code, inside the same transaction as the insert, with `select … for update` on the event row.

When a photo row is deleted, its two files are removed after the commit. A startup sweep removes files in `uploads/calendar/` that no row references and that are older than one day. That covers uploads abandoned mid-edit.

## 10. API

### Public (read-only, no cookie)

`GET /api/calendar` returns the whole current year in one response. About 100 events is around 60 KB before gzip.

```json
{
  "year": { "label": "2026–27", "theme": "Roots to Wings", "seoTitle": "…", "seoDescription": "…", "shareImage": "/api/calendar/photos/….webp", "shareImageAlt": "…" },
  "today": "2026-11-05",
  "months": [{ "key": "2026-05", "line": "Before the Session · Preparation" }],
  "strands": [{ "id": "…", "name": "Major Events", "color": "sun" }],
  "filters": [{ "id": "…", "name": "Grade", "options": [{ "id": "…", "name": "Grade 1" }] }],
  "events": [{
    "slug": "2026-08-05-market-day", "title": "Market Day", "subtitle": "…",
    "start": "2026-08-05", "end": null, "movedFrom": null,
    "strandId": "…", "optionIds": ["…"], "grades": "Whole school",
    "body": "…", "highlights": ["…"], "state": "completed",
    "recap": "…", "photos": [{ "src": "…", "thumb": "…", "width": 1600, "height": 1067, "alt": "…", "caption": "" }]
  }],
  "rhythm": [{ "strandId": "…", "when": "Every morning", "title": "…", "body": "…", "caption": "…", "photo": null }]
}
```

- It returns published and cancelled events only. `photos` and `recap` are empty unless the recap is published.
- `state` is calculated on the server with the Kolkata date, so every visitor sees the same thing.
- Hidden strands, options, and groups with "show on site" off are not sent to the filter lists.
- `Cache-Control: no-cache`, with an ETag.

`GET /api/calendar/photos/:name` serves files from `uploads/calendar/`. The name must match `^[a-f0-9]{32}(-w640)?\.webp$`. The response sends `immutable` caching and `X-Content-Type-Options: nosniff`.

### Admin (cookie required, same `requireAdmin` and `rejectCrossSite`)

Form posts render HTML pages, as the notes screens do. Only photo upload and reordering use small JSON endpoints:

| Method | Path | Does |
| --- | --- | --- |
| POST | `/api/admin/calendar/events/:id/photos` | One multipart file. Returns the photo row. 10 MB limit. |
| PATCH | `/api/admin/calendar/photos/:id` | Alt text and caption. |
| POST | `/api/admin/calendar/events/:id/photos/order` | `{ ids: [...] }` |
| DELETE | `/api/admin/calendar/photos/:id` | Removes the row, then the files. |
| POST | `/api/admin/calendar/settings/share-image` | One file, cropped to 1200×630. |

Every body is checked with Zod in `src/calendar/schemas.ts`.

## 11. Website changes (`CL001-Wellsprings-website`)

Read-only and additive. Other pages are not touched.

| File | Change |
| --- | --- |
| `src/lib/cms-calendar.ts` (new) | `loadCalendar` server function, built like `cms-blog.ts`. It reads `CMS_API_URL` with a 4 s timeout, checks every field, and adds `CMS_PUBLIC_URL` in front of photo paths. It returns `{ ok: false }` on any problem. |
| `src/routes/theme-of-the-year.tsx` | It gains `validateSearch` (`month`, `event`) and `loader: loadCalendar`. `head` uses the CMS search fields and event share data ([7.4](#74-share-one-event)). The hero label comes from the year. The rhythm section reads `data.rhythm`. It handles CMS-down ([7.5](#75-public-page-behaviour)). |
| `src/components/theme/YearCalendar.tsx` | Data comes in as props instead of imports. Strand colours come from `color` key → `var(--{key}-700)` / `var(--{key}-200)`. It gains the extra filter rows, the state tags, the date range, "Moved from", Copy link, and the URL sync. The layout and classes stay the same. |
| `src/components/page/ImagePlaceholder.tsx` | It gains an optional `color` prop. Without it, it behaves exactly as now, which keeps the blog cards unchanged. |
| `src/data/theme-year.ts` | It stays, as the seed source and for `CATEGORY_COLOR`, which `ImagePlaceholder` uses. The calendar no longer renders from it. |
| `.env.example` | It gains `CMS_PUBLIC_URL=http://localhost:3002`. *Also: your uncommitted edit adds the `CMS_API_URL` block twice. Remove one.* |

## 12. Hosting and security

### Layout

One small Linux VPS (2 GB RAM is enough) runs everything. The site gets nothing from a separate host.

| Process | Port | Public as |
| --- | --- | --- |
| Website (Nitro) | 8080 | `https://wellspringsacademy.in` |
| CMS | 3002 | `https://cms.wellspringsacademy.in` (admin, public API, photos) |
| Postgres | 5432 | localhost only, never public |

nginx in front, with Let's Encrypt TLS, HTTP to HTTPS redirect, and gzip for JSON. Both Node processes run under systemd or pm2 and restart on failure.

### Must-do items for hosting (easy to miss)

1. **nginx `client_max_body_size 12m;`** on the CMS server block. The default 1 MB rejects every phone photo.
2. **`proxy_set_header Host $host;`**. `rejectCrossSite` compares `Origin` with `Host`, and without this header every admin save returns 403.
3. **`app.set("trust proxy", 1)`** in the CMS. Without it, every request seems to come from nginx's IP, so one person's failed logins lock out everyone, and secure cookies can misbehave. This is a one-line shared change, listed in [Files](#14-files).
4. **Run in production mode** so the session cookie is `Secure`. Check how `cookieOptions(...)` is called in `admin-routes.ts` and set the matching environment variable on the host.
5. **Persistent `uploads/`**: on the VPS disk, owned by the app user, outside the code folder or symlinked, so a redeploy (`git pull`) never deletes it.
6. **`CMS_PUBLIC_URL`** (website) set to the public CMS address, and `CMS_API_URL` set to the same address or to `http://127.0.0.1:3002` ([6.3](#63-photo-urls-on-the-live-site)).
7. **Database user**: create `wellsprings_app` with rights on `wellspringscms` only. Never connect the app as `postgres`. Use a strong password, and keep `listen_addresses = 'localhost'`.
8. **Secrets**: `COOKIE_SECRET` is 32+ random bytes, set on the host. Never use the local `.env`. After the first boot creates the admin, remove `ADMIN_PASSWORD` from the host environment and change the password in the admin.
9. **Robots**: the CMS subdomain serves `robots.txt` with `Disallow: /`. Admin pages already send `noindex`.
10. **Backups**: a nightly `pg_dump wellspringscms` plus a copy of `uploads/`, kept for 14 days, stored off the server. Do one test restore before launch. Photos and rows have to be restored together.
11. **Node version**: the CMS starts with `--experimental-strip-types`, so it needs Node 22.6+ on the host, the same version used locally.
12. **Firewall**: open only ports 22, 80, and 443.

### Child safety

- Camera data (including GPS) is removed from every photo. The original is never stored.
- Photos are capped at 1600 px, so full-resolution images of children are never on the web.
- The consent tick is needed before any photo goes public.
- Captions and alt text are for describing the activity. The helper text says: *Don't write children's full names.*
- File names are random, and the photo folder has no index or listing route.

### Before starting

**`CL001-WSA-Blog-CMS` is not a git repository yet.** Run `git init` and commit the working blog before writing any calendar code. That gives you a rollback point if a shared file breaks the blog.

## 13. Seed

`src/calendar/seed.ts` copies the current website data verbatim, with no rewriting:

| From `theme-year.ts` | To |
| --- | --- |
| The year | `cal_years`: label `2026–27` (*confirm, see [7.5](#75-public-page-behaviour)*), theme `Roots to Wings`, May 2026 – April 2027, current. SEO fields: the current `pageMeta` title and description. |
| `MONTHS[].sub` | `cal_months.line` |
| `CATEGORY_COLOR` keys | `cal_strands`, with colours sage / coral / grey / sun / slate in the same order. |
| `EVENTS` | `cal_events`, `published`. Each slug is the date plus the title. Ranges such as "15–23 July", already written in subtitles, stay in the subtitle. The admin can set end dates later. There are no photos. |
| `ALL_YEAR` | `cal_rhythm` |
| — | One filter group, `Grade`, with options Nursery, K1, K2, Grade 1–8, Staff, Parents. It is hidden on the site until the admin tags events with it. |

The seed runs only when `cal_years` is empty. Later boots never overwrite the admin's edits.

## 14. Files

New, inside `CL001-WSA-Blog-CMS`:

| File | What it is |
| --- | --- |
| `db/migrations/004_calendar.sql` | The tables in [9](#9-data). |
| `src/calendar/db.ts` | Queries. It uses `getPool()` from `src/db.ts`. |
| `src/calendar/schemas.ts` | Zod for every form and JSON body. |
| `src/calendar/photos.ts` | `savePhoto` (two sizes, inside fit), share-image crop, delete, startup sweep. It reuses the multipart reader pattern from `src/photos.ts` without changing that file. |
| `src/calendar/public-routes.ts` | `/api/calendar` and `/api/calendar/photos/:name`. |
| `src/calendar/admin-routes.ts` | Screens and endpoints from [8](#8-admin-screens) and [10](#10-api). |
| `src/calendar/html.ts` | Templates. It uses `page()` and `esc` from `src/html.ts`. |
| `src/calendar/seed.ts` | [13](#13-seed). |
| `src/calendar/calendar.css` | Styles for the calendar screens only, appended after `admin.css`. |

Shared blog files, with only these lines changed:

| File | Change |
| --- | --- |
| `src/index.ts` | Mount the calendar routes, run the calendar seed and sweep, create `uploads/calendar`, add `trust proxy`. |
| `src/admin-routes.ts` | After sign-in, and on `/admin` when signed in, redirect to `/admin/home` instead of `/admin/notes`. Add the `/admin/home` route. |
| `src/html.ts` | Header nav: `Home · Notes · Calendar · Password · Sign out`. |

Nothing else in the notes code, the notes tables, or the `/api/blog` responses changes. Add no new npm packages.

## 15. Later, if the school asks

Not part of this build, and listed only so they aren't forgotten:

- "Add to my calendar" (`.ics`) per event for parents.
- A small "This month at Wellsprings" strip on the homepage, reading the same API.
- A read-only archive of past years with their photos.
- Site-wide SEO fields for other pages, which would mean every page reads its `head` from the CMS.

## 16. Done when

Run the CMS on 3002 against the migrated `wellspringscms` database, and the website on 8080.

1. **Nothing broke.** `/blog` and one article look and behave exactly as before. Notes can be created, published, and unpublished as in `SPEC.md` §16.
2. **Day one looks the same.** Signed out, `/theme-of-the-year` shows the same events, month lines, strand colours, and rhythm cards as the current static page, except that it opens on the current month.
3. **One login, two modules.** Sign in once and land on Home. Open Calendar and see only calendar screens. Open Notes and see only notes. The header switches between them without signing in again.
4. **Plan → promote.** Create an event for next week as a draft: it is not on the site. Publish it: it appears with **Upcoming** after a page refresh, with no deploy.
5. **Prove.** Open a past event from **Needs photos**. Upload 12 phone photos in one selection, reorder them, edit one alt text, tick consent, and publish the recap. On the site the card shows **Photos · 12**, and the overlay shows the carousel and the recap. The event leaves **Needs photos**.
6. **Rules hold.** The recap can't be published without the consent tick or with no photos. A 21st photo is refused. A future event can't get a published recap. A published event offers Unpublish and Cancel, but not Delete. A cancelled event shows **Cancelled**.
7. **Filters.** Add strand `Sports` (colour sun) and tag an event with it: the chip appears and filters the month view. Turn on group `Grade`, then tag events: the Grade row filters, and the month counts update. Hide the strand: the chip disappears, but the event stays.
8. **Share.** Open an event, then Copy link. Opened in a new tab, the same month and the same overlay show. The page source has the event's title and its first photo as `og:image`. The canonical URL is `/theme-of-the-year`.
9. **SEO.** Change the search title in Page & SEO: the website `<title>` changes on refresh.
10. **CMS down.** Stop the CMS: the page still loads, the calendar section shows the unavailable line, and nothing from `theme-year.ts` appears.
11. **Photos are clean.** A downloaded photo has no EXIF/GPS and is at most 1600 px on its long edge.
12. **Git.** `git status` in the CMS does not list `.env` or anything under `uploads/`.
