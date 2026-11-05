# Theme of the Year calendar

Build spec for the second CMS module. The admin who publishes notes also runs the school year calendar shown on `/theme-of-the-year`. The plan goes up first. Photos follow after each event.

The module is built inside `CL001-WSA-Blog-CMS`, next to the blog, with the same server, database, login and packages. The blog module (`SPEC.md`) keeps working exactly as it does now. The only blog files touched are the three shared lines listed in [Files](#13-files).

This spec covers local development only. Hosting is decided after the review ([14](#14-hosting-later)).

Build order: migration and seed, public API, website loader (so the public page keeps working with seeded data), admin screens, photo upload.

---

## 1. Purpose

Today every event on `/theme-of-the-year` lives in `src/data/theme-year.ts`, so any change needs a developer and a redeploy. The "Event photos · After the event" panel is always empty.

With this module the school admin, without a developer:

1. **Plans**: adds each event to the calendar with its date, strand, grades and "The plan" text.
2. **Promotes**: publishes it, and parents see it as upcoming.
3. **Proves**: after the event, adds up to 6 photos and a short recap. The event then shows as completed.

The admin also manages the monthly theme lines, the filters, the all-year rhythm cards, and search and share text for the page and for each event.

## 2. Words

| Word | Meaning |
| --- | --- |
| Year | One academic year, such as `2026–27`, with its theme name (`Roots to Wings`), first month and last month. Only one year is *current*. |
| Month line | The text shown for each month, such as `Strong Roots · Integrity`. |
| Filter | A filter group, such as `Strand` or `Grade`, and its options, such as `Major Events` or `Grade 1`. |
| Strand | The main filter. Each event has exactly one strand option, and its colour paints the card. This is the existing "Filter by strand". |
| Event | One dated item on the calendar. It can span several days (`15–23 July`). |
| Plan | What the admin writes before the event: title, subtitle, body, "What happens" points. |
| Recap | What the admin adds after the event: photos and an optional short paragraph. |
| Rhythm item | A card in "All year · the steady rhythm", which has no date. |
| Today | The date in `Asia/Kolkata`, as in the blog spec. |

## 3. People

| Who | What they need |
| --- | --- |
| Parent (current) | Open the page on a phone, land on **this month**, see what is coming for their child's grade, and see photos from events that are done. Share one event on WhatsApp. |
| Prospective parent | See that the year is real and full. Completed events with photos are the proof. |
| School admin | One sign-in, then choose Notes or Calendar. See at a glance which past events still need photos. Upload phone photos without resizing them first. |
| Search engines and link previews | A proper title, description and image for the page and for a shared event link. |

There are no teacher or parent accounts.

## 4. Included

- After sign-in, a home screen with two choices: **Notes** and **Calendar**. The header has both links, so the admin can switch at any time.
- A calendar dashboard showing what needs attention.
- Events: create, edit, save draft, preview, publish, unpublish, cancel, and delete a draft.
- Recap: up to **6 photos** per event, each with alt text, an order and an optional caption, plus a recap paragraph and a consent tick.
- SEO: a search title and search description for the page, and for each event, filled in from the headline and subtitle the same way the blog does it.
- Month lines: edit the line for each month.
- Filters: add, rename, reorder and hide groups and options. Strand options get a colour from the brand palette only.
- Rhythm items: add, edit, reorder and hide, with an optional photo.
- Page settings: theme name, year label, share image.
- Years: create the next year and make it current. Filters and rhythm items are copied to the new year. Events are not.
- Seed: everything in `theme-year.ts` today is copied into the database once, so the page looks the same on day one.

## 5. Left out

- Teacher logins, roles, a second admin, approval steps, revision history, an audit log.
- A separate public page per event. A shared event uses a link to the same page ([7.5](#75-share-one-event)).
- A page builder. The hero copy and the closing band stay in the website code.
- Free colour picking.
- Video, PDF attachments, comments, likes, RSVP, reminders, email or WhatsApp sending.
- SEO editing for other website pages.
- Showing past years on the site. Old years stay in the database, but only the current year is public.
- Hosting, domains, CDN and object storage, until the review.

## 6. Decisions

### 6.1 Database: same database, 5 new tables

Use the same `wellspringscms` database and add five tables whose names start with `cal_`.

- One `admins` table, so one login and one cookie open both Notes and Calendar.
- One backup and one migration runner (`schema_migrations`).
- The blog tables are not touched.

Small lists live inside the row they belong to. Month lines sit on the year, and an event's filter options sit on the event. Anything with its own life (photos, rhythm cards) gets its own table. See [9. Data](#9-data).

### 6.2 Photos: stored the same way as blog covers

Photos are not stored in Postgres. Images inside the database would make it, and every backup of it, grow quickly, and every image request would go through the database.

They are stored exactly the way the blog stores covers:

- Sharp re-encodes each upload to WebP and removes camera data, including the GPS location of the school. The original is not kept.
- The file is saved in `uploads/calendar/` (gitignored, already under `uploads/`) with a random name.
- The database stores only the **path**, such as `/api/calendar/photos/3f9a….webp`, plus width, height, alt text and order.
- The CMS serves the files at `/api/calendar/photos/:name` with `Cache-Control: public, max-age=31536000, immutable`. A replaced photo gets a new name, so the browser never shows an old copy from its cache.
- The website builds the full image link the same way `cms-blog.ts` does: `CMS_API_URL` + path. There is no new environment variable.

Size: 100 events × 6 photos × 2 sizes is about 150–200 MB a year on disk.

### 6.3 Changes show immediately

- The website renders `/theme-of-the-year` on the server and reads the CMS on every request, the same as the blog.
- `GET /api/calendar` sends `Cache-Control: no-cache` with an ETag, which Express adds by default. When nothing has changed, the reply is a tiny `304` instead of the full calendar.
- A publish therefore shows when the parent next opens or refreshes the page.

### 6.4 Admin UI style

The admin screens use the same server-rendered HTML as the notes admin, with the same `admin.css` tokens (paper, ink, Lora, Inter, JetBrains Mono, sage, coral, sun) and the same nonce CSP. There is no React app, build step or new package.

The preview reuses the website's own look: month rail, event card and the two-column overlay ("The plan" / "Event photos").

## 7. Requirements

### 7.1 Event lifecycle

Stored fields: `status` (`draft`, `published` or `cancelled`) and `recap_published` (yes or no).

The admin sees a derived state:

| State | Rule | On the site |
| --- | --- | --- |
| Draft | `status = draft` | Not shown. |
| Upcoming | published, end date today or later | Shown with an **Upcoming** tag (**Today** on the day). The photos panel says "Photos will be added after the event." |
| Needs photos | published, end date before today, recap not published | Shown with no tag and the same photos line. **Listed on the dashboard as a to-do.** |
| Completed | published and recap published | Shown with a **Photos** tag and a count. The overlay shows the carousel and the recap. |
| Cancelled | `status = cancelled` | Shown with a **Cancelled** tag and greyed out. |

Rules:

- A recap can be published only on or after the event's start date, with at least one photo and the consent tick.
- When the date of a published event changes, the editor asks "Show 'Moved from 12 Aug' on the site?". If the admin says yes, `moved_from` is set.
- A published event is unpublished or cancelled, never deleted. A draft can be deleted after confirmation, and its photo files are deleted with it.
- Unpublishing the recap hides the photos but keeps them.

### 7.2 Event fields

| Field | Rule |
| --- | --- |
| Title | Required. 1–90 characters. |
| Subtitle | 0–120 characters. |
| Start date | Required, and inside the year's months. |
| End date | Optional. If set, on or after the start date. The card shows `15–23 Jul`. |
| Strand | Required. One active option of the Strand filter. |
| Other filter options | Zero or more options from the other active filter groups. |
| Grades label | 0–40 characters, such as `Nursery – Grade 2`, shown as typed. The editor suggests one from the chosen Grade options. |
| The plan (body) | Required for publish. 1–1200 characters. Plain text with paragraph breaks, no HTML. |
| What happens | 0–6 points, each 1–140 characters. |
| Recap | 0–600 characters. |
| Photos | 0–6, see [7.3](#73-photos). |
| Photo consent | A tick: "Every child shown has photo consent on file with the school." Required to publish the recap. It is cleared when a photo is added after publish. |
| Search title | See [7.4](#74-seo). |
| Search description | See [7.4](#74-seo). |
| Slug | Made from the date and the title (`2026-08-05-market-day`), with `-2` added on a clash. It is locked once published, so shared links keep working. |

### 7.3 Photos

- **At most 6 photos are stored per event.** The admin may select more files at once, for example 20, but only the free slots are uploaded (6 minus the photos already there). The rest are skipped and the screen says so: *"6 photos per event. 14 were not uploaded."* The server also refuses a 7th photo, so the limit holds even if the page's own check is bypassed.
- Accepted: JPEG, PNG and WebP, up to 5 MB each, the same limit as blog covers.
- The browser sends one request per photo, one after another, and shows progress for each. One failed file does not stop the rest.
- Each photo is saved in two sizes: 1600 px on the long edge for the overlay and 640 px for thumbnails and the share image. Both are WebP at quality 80, with camera data removed.
- Alt text is required (1–160 characters) and is pre-filled with "Photo from {title}". The caption is optional (0–120 characters). The admin orders photos by dragging, or with up and down buttons on mobile.
- The helper text under captions reads *Don't write children's full names.*
- The website's empty-state line changes from "Up to 20 photos…" to "Up to 6 photos…".

### 7.4 SEO

Same approach as the blog: the search fields are filled automatically, and the admin changes them only when needed.

**For each event:**

| Field | Rule |
| --- | --- |
| Search title | 0–200 characters. On save, if empty, it is filled with `{title} — Roots to Wings | Wellsprings Academy`. A counter warns above 60. |
| Search description | 0–300 characters. On save, if empty, it is filled from the subtitle, or else the first 155 characters of the body. A counter warns above 155. |

These fields are used when a shared event link is opened ([7.5](#75-share-one-event)).

**For the page** (one set per year):

| Field | Rule |
| --- | --- |
| Search title | 1–200 characters. The seed uses the current `pageMeta` title. |
| Search description | 1–300 characters. The seed uses the current `pageMeta` description. |
| Share image | One uploaded photo, cropped to 1200×630, with alt text. Without one, the current hero image is used. |

Both editors show a Google-style preview of title and description. The canonical URL stays `/theme-of-the-year`. `sitemap.xml` does not change.

### 7.5 Share one event

- The page reads `?month=2026-08&event=2026-08-05-market-day`. Opening the overlay or changing the month updates the URL with `replace`, so the back button still leaves the page.
- When `event` is in the URL, the server-rendered `<head>` uses the event's search title and search description, and the first recap photo (640 px) as the share image. With no photo, it falls back to the page share image.
- The overlay has a **Copy link** button.

### 7.6 Filters

- A filter group has a name (`Strand`, `Grade`), an order, "show on site" (yes or no) and active (yes or no). Exactly one group is the **main** one (Strand). It is required on every event, and its options carry colours.
- An option has a name (1–40 characters), an order, active (yes or no), and, for Strand only, a colour key.
- Colour keys name the ink and surface pairs that the website already uses in `CATEGORY_COLOR` and `CATEGORY_SURFACE` (`src/data/theme-year.ts`). The shades are not uniform, so the website keeps this table in code and the CMS stores only the key. The admin picks from swatches, never a hex field.

  | Key | Ink (tag, dot, border) | Surface (card, chip) | Used today by |
  | --- | --- | --- | --- |
  | `sage` | `--sage-700` | `--sage-200` | Field Visits & Stay Over |
  | `coral` | `--coral-600` | `--coral-200` | Important Academic Days |
  | `grey` | `--grey-700` | `--grey-200` | Holidays |
  | `sun` | `--sun-700` | `--sun-200` | Major Events |
  | `slate` | `--slate-1000` | `--grey-200` | Celebration |

- Two strand options may share a colour key. The editor shows a hint, not an error.
- An option in use can't be deleted, only hidden. The code checks this before deleting. A hidden option disappears from the filter row, but its events stay visible.
- On the site, filters show as chip rows: Strand first, as today, then one row for each other group with "show on site" on. Each row picks one value or "All". Rows combine with AND. The month counts follow the filters, as today.

### 7.7 Public page behaviour

- It opens on **the current Kolkata month** when that month is in the year, otherwise on the first month.
- The hero eyebrow `Theme of the Year · {year label}` and the theme name come from the year. *The code says `2027–28` (the eyebrow, the file comments and the body of "New Academic Session Commences"), but the events run 11 May 2026 – 10 April 2027. Confirm the label with the school. The seed copies event text verbatim, so if the label changes, the admin also edits that one event body.*
- Month lines come from the year.
- The rhythm section reads rhythm items, with a real photo when one is set and otherwise the current placeholder.
- If the CMS is down, the hero and closing band still render. The calendar section shows "The calendar is not available right now." and the rhythm section is hidden. There is no fallback to `theme-year.ts`, the same rule as the blog.

### 7.8 Dashboard

`/admin/calendar` shows for the current year:

1. **Needs photos**: past events without a published recap, oldest first, each with an "Add photos" button.
2. **Coming up**: the next 14 days.
3. **Drafts**.
4. Event counts per month, by state.

## 8. Responsive and performance

**Targets:** Lighthouse 90+ on `/theme-of-the-year` for performance, accessibility, best practices and SEO, on mobile and desktop. The admin screens work on a 375 px phone.

### Public page

- The calendar data is in the first HTML response (server-rendered). Nothing loads afterwards just to show the month.
- One API call per page view: `GET /api/calendar` returns the whole year, about 60 KB before gzip, and photos are sent only as paths.
- Card images and carousel thumbnails use the 640 px file. The 1600 px file loads only for the overlay's active slide, with the next slide preloaded.
- Every `<img>` has `width` and `height` from the database, so the layout does not jump. Images below the fold use `loading="lazy"` and `decoding="async"`.
- Photos are WebP with immutable caching, so a returning visitor downloads nothing again.
- No new JavaScript library on the website. Filter, month and overlay changes run in the browser on the data already loaded.
- The layout keeps the current responsive behaviour: the month rail scrolls sideways on phones and sits as a column on desktop, the overlay is a bottom sheet on phones, and the chip rows wrap. New chip rows follow the same classes.
- Accessibility: the overlay traps focus and closes on Escape, as it does today. Tags are text, not colour only. Every photo has alt text.

### Admin

- Photos are uploaded one at a time, so a slow phone connection never sends one huge request.
- List screens show only the selected month's events, not the whole year.
- Every control has a visible label, errors sit in a live region, and drag order has an up and down button alternative.

### API

- An index on `(year_id, status, start_date)` supports the public read. The whole read is about 3 queries.

## 9. Data

Migration `db/migrations/004_calendar.sql`. **Five tables.** Every key is a `uuid` with `gen_random_uuid()`, and every table has `created_at` / `updated_at` like `blog_posts`.

| Table | Holds |
| --- | --- |
| `cal_years` | Year, theme, page SEO, share image, **month lines** |
| `cal_filters` | Filter groups **and** their options (`parent_id`), with strand colours |
| `cal_events` | Each event, with its plan, recap, SEO and **filter options** |
| `cal_photos` | Event photos (max 6 per event) |
| `cal_rhythm` | "All year" cards |

```sql
create table cal_years (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 20),
  theme_name text not null check (char_length(theme_name) between 1 and 40),
  first_month date not null,                 -- first day of first month
  last_month date not null,                  -- first day of last month
  month_lines jsonb not null default '{}',   -- {"2026-06": "Strong Roots · Integrity", ...}
  is_current boolean not null default false,
  seo_title text not null default '' check (char_length(seo_title) <= 200),
  seo_description text not null default '' check (char_length(seo_description) <= 300),
  share_image text,
  share_image_alt text not null default '' check (char_length(share_image_alt) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_month >= first_month)
);
create unique index cal_years_one_current on cal_years (is_current) where is_current;

-- Groups have parent_id null. Options point to their group.
create table cal_filters (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references cal_years(id) on delete cascade,
  parent_id uuid references cal_filters(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 40),
  is_main boolean not null default false,    -- groups only: the Strand group
  show_on_site boolean not null default true,-- groups only
  color_key text check (color_key is null or color_key in ('sage','coral','grey','sun','slate')),
  sort smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year_id, parent_id, name)
);
create unique index cal_filters_one_main on cal_filters (year_id) where is_main;

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
  option_ids uuid[] not null default '{}',   -- other filter options; checked in code
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
  unique (year_id, slug)
);
create index cal_events_public on cal_events (year_id, status, start_date);
create index cal_events_options on cal_events using gin (option_ids);

create table cal_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references cal_events(id) on delete cascade,
  file text not null,                        -- /api/calendar/photos/<hex>.webp
  thumb text not null,                       -- /api/calendar/photos/<hex>-w640.webp
  width integer not null,
  height integer not null,
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
  photo text,
  photo_alt text not null default '' check (char_length(photo_alt) <= 160),
  sort smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Rules checked in code, inside the save transaction:

- `strand_id` is an option of the main group. Every entry in `option_ids` is an option of a non-main group in the same year.
- An option can't be deleted while any event uses it (`strand_id = $1 or $1 = any(option_ids)`) or any rhythm card uses it.
- At most 6 photos per event: `select … for update` on the event row, then count, then insert.
- Deleting a photo row removes its two files after the commit. A startup sweep removes files in `uploads/calendar/` that no row references and that are older than one day.
- There are no database triggers, the same as the blog. Every `update` sets `updated_at = now()` itself.
- Making a year current runs in one transaction: clear `is_current` on all years, then set it on the chosen one. The partial unique index stops two current years.

The blog's `GET /api/uploads/:name` only matches `^[a-f0-9]{32}\.webp$` at the top of `uploads/`, so it can never serve a file from `uploads/calendar/`, and the calendar route never serves blog covers.

## 10. API

### Public (read-only, no cookie)

`GET /api/calendar` returns the whole current year:

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
    "seoTitle": "…", "seoDescription": "…",
    "recap": "…",
    "photos": [{ "src": "/api/calendar/photos/….webp", "thumb": "/api/calendar/photos/…-w640.webp", "width": 1600, "height": 1067, "alt": "…", "caption": "" }]
  }],
  "rhythm": [{ "strandId": "…", "when": "Every morning", "title": "…", "body": "…", "caption": "…", "photo": null, "photoAlt": "" }]
}
```

- Only published and cancelled events are included. `photos` and `recap` are empty unless the recap is published.
- `state` is worked out on the server from the Kolkata date.
- Hidden options and hidden groups are left out of `strands` and `filters`.
- `Cache-Control: no-cache` with an ETag.

`GET /api/calendar/photos/:name` serves files from `uploads/calendar/`. The name must match `^[a-f0-9]{32}(-w640)?\.webp$`. The response is cached as immutable and sends `nosniff`.

### Admin (same `requireAdmin` and `rejectCrossSite` as notes)

Screens use form posts, like notes. Photo work uses small JSON endpoints, and every body is checked with Zod in `src/calendar/schemas.ts`.

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/api/admin/calendar/events/:id/photos` | Upload one multipart file (max 5 MB). Returns `409` with "6 photos per event." when the event is full. |
| PATCH | `/api/admin/calendar/photos/:id` | Change the alt text and caption. |
| POST | `/api/admin/calendar/events/:id/photos/order` | Set the photo order: `{ ids: [...] }` |
| DELETE | `/api/admin/calendar/photos/:id` | Delete a photo. |
| POST | `/api/admin/calendar/settings/share-image` | Upload one file, cropped to 1200×630. |

## 11. Admin screens

| Screen | Path | Contents |
| --- | --- | --- |
| Home | `/admin/home` | Two cards, **Notes from school** and **Theme of the Year calendar**, each with a one-line status. |
| Calendar dashboard | `/admin/calendar` | As in [7.8](#78-dashboard). Year switcher when there is more than one year. |
| Events | `/admin/calendar/events` | The website-style month rail, event cards with state tags, filters by strand and state, and **New event**. |
| Event editor | `/admin/calendar/events/:id` | Tabs: **The plan**, **After the event** (photos, recap) and **SEO**. A sticky bar holds Save draft, Preview, Publish / Unpublish, Cancel event, and Delete (drafts only). A line names whatever is missing before Publish. |
| Preview | `/admin/calendar/events/:id/preview` | The card and the overlay as on the site, with "Only you can see this." |
| Months | `/admin/calendar/months` | One line per month. |
| Filters | `/admin/calendar/filters` | Groups and their options, as in [7.6](#76-filters). |
| All-year rhythm | `/admin/calendar/rhythm` | The rhythm card list. |
| Page & SEO | `/admin/calendar/settings` | Theme name, year label, page search title and description, share image. |
| Years | `/admin/calendar/years` | **Create next year**, **Make current**. |

## 12. Seed

`src/calendar/seed.ts` copies the current website data verbatim. It runs only when `cal_years` is empty.

| From `theme-year.ts` | To |
| --- | --- |
| The year | `cal_years`: label `2026–27` (*confirm*), theme `Roots to Wings`, May 2026 – April 2027, current. The page SEO comes from the current `pageMeta`. |
| `MONTHS[].sub` | `cal_years.month_lines` |
| `CATEGORY_COLOR` keys | `cal_filters`: one main group `Strand` and its five options, with the colour keys from the table in [7.6](#76-filters). |
| `EVENTS` | `cal_events`, `published`, slug locked. Each slug is the date plus the title, with `-2` on a clash (for example the several "Field Visit" rows). `category` → `strand_id`, `grades` → `grades_label`, `highlights` as is. Search fields are filled by the rule in [7.4](#74-seo). The `image` placeholder and the empty `photos` are not copied. |
| Date ranges | Today a range lives only in the subtitle (`15–23 July · …`). When a subtitle starts with `D–D Month`, the seed sets `end_date` and leaves the subtitle as it is. Lists such as `25, 26, 27 and 29 May` stay single-day. |
| `ALL_YEAR` | `cal_rhythm`, in the same order, no photo. |
| — | `cal_filters`: group `Grade` (hidden on the site) with the options Nursery, K1, K2, Grade 1–8, Staff, Parents. Events are not tagged with Grade options. The admin tags them after turning the row on. |

The seed runs in one transaction. If any row fails, nothing is written and the server stops with the row's title in the log.

## 13. Files

New files inside `CL001-WSA-Blog-CMS`:

| File | What it is |
| --- | --- |
| `db/migrations/004_calendar.sql` | The five tables from [9](#9-data). |
| `src/calendar/db.ts` | Queries, using `getPool()` from `src/db.ts`. |
| `src/calendar/schemas.ts` | Zod checks for every form and JSON body. |
| `src/calendar/photos.ts` | Two-size save, share-image crop, delete, sweep. It follows the pattern of `src/photos.ts` without changing that file. |
| `src/calendar/public-routes.ts` | `/api/calendar` and `/api/calendar/photos/:name`. |
| `src/calendar/admin-routes.ts` | The screens and endpoints from [10](#10-api) and [11](#11-admin-screens). |
| `src/calendar/html.ts` | Templates, using `page()` and `esc` from `src/html.ts`. |
| `src/calendar/seed.ts` | The seed from [12](#12-seed). |
| `src/calendar/seed-data.ts` | `EVENTS`, `ALL_YEAR` and the month lines, copied once from the website's `theme-year.ts` (the CMS can't import the website's image imports). |
| `src/calendar/calendar.css` | Styles for the calendar screens only. |

Shared blog files, with only these lines changed:

| File | Change |
| --- | --- |
| `src/index.ts` | Mount the calendar routes, run the calendar seed and sweep, create `uploads/calendar`. |
| `src/admin-routes.ts` | After sign-in, and on `/admin` when signed in, go to `/admin/home` instead of `/admin/notes`. The `/admin/home` screen itself lives in `src/calendar/admin-routes.ts`. |
| `src/admin.css` | The header nav wraps on narrow phones, now that it has five links. |
| `src/html.ts` | Header nav: `Home · Notes · Calendar · Password · Sign out`. The logo links to `/admin/home` instead of `/admin/notes`. |

Website (`CL001-Wellsprings-website`), read-only and additive:

| File | Change |
| --- | --- |
| `src/lib/cms-calendar.ts` (new) | `loadCalendar` server function, built like `cms-blog.ts`: `CMS_API_URL`, a 4 s timeout, every field checked, `CMS_API_URL` placed before photo paths, and `{ ok: false }` on any problem. |
| `src/routes/theme-of-the-year.tsx` | `validateSearch` (`month`, `event`), `loader: loadCalendar`, `head` from the CMS SEO fields ([7.4](#74-seo), [7.5](#75-share-one-event)), hero label from the year, rhythm from the API, and the CMS-down state. |
| `src/components/theme/YearCalendar.tsx` | Data comes in as props. Colours come from the colour key. Adds extra filter rows, state tags, date range, "Moved from", Copy link, URL sync, and the "Up to 6 photos" text. The current layout and classes stay. |
| `src/components/page/ImagePlaceholder.tsx` | An optional `color` prop. Without it, it behaves exactly as now, so blog cards don't change. |
| `src/data/theme-year.ts` | Stays, as the seed source and for `CATEGORY_COLOR`. The calendar no longer renders from it. |

There are no new npm packages and no new environment variables. *Also: the website's uncommitted `.env.example` lists `CMS_API_URL` twice. Remove one.*

**Rollback point:** the working blog is already committed in this repository (`WSA Blog CMS (Local)`). Build the calendar on a branch, so `main` keeps the blog as it is.

## 14. Hosting (later)

Not part of this build. To decide after the review. These notes apply to the blog and the calendar alike, because both store photos the same way:

- `CMS_API_URL` must be the CMS's public `https` address, or image links point to `localhost`.
- `uploads/` must be on a disk that survives redeploys.
- The server's upload limit must allow 5 MB photos (nginx default is 1 MB).

## 15. Done when

Run the CMS on 3002 against the migrated `wellspringscms`, and the website on 8080.

1. **Nothing broke.** `/blog` and one article behave exactly as before. A note can still be created, published and unpublished, as in `SPEC.md` §16.
2. **Day one looks the same.** Signed out, `/theme-of-the-year` shows the same events, month lines, strand colours and rhythm cards as the current static page, but opens on the current month.
3. **One login, two modules.** Sign in once and land on Home. Calendar shows only calendar screens, and Notes shows only notes. The header switches between them.
4. **Plan → promote.** A draft event for next week is not on the site. Publish it, refresh, and it shows with **Upcoming**.
5. **Prove.** From **Needs photos**, open a past event and select 10 photos. 6 are uploaded and the screen says 4 were not. Reorder them, edit one alt text, tick consent and publish the recap. On the site the card shows **Photos · 6**, and the overlay shows the carousel and the recap. The event leaves **Needs photos**.
6. **Rules hold.** No recap publish without consent or photos. A 7th photo is refused by the server. A future event can't publish a recap. A published event offers Unpublish and Cancel, not Delete. A cancelled event shows **Cancelled**.
7. **Filters.** Add strand option `Sports` (colour sun) and tag an event with it: the chip appears and filters. Turn on `Grade`, then tag events: the Grade row filters, and the counts update. Hide `Sports`: the chip disappears, and the event stays. Deleting an option in use is refused.
8. **SEO.** A new event's search title and description are filled in on save. Edit them, then open its shared link: the page source shows them as `<title>`, `og:title`, `og:description`, and the first photo as `og:image`. Change the page search title: the website `<title>` changes on refresh. The canonical URL is `/theme-of-the-year`.
9. **Share.** Copy link, open it in a new tab: the same month and overlay open.
10. **Responsive and fast.** At 375 px, 768 px and 1280 px the page has no sideways scroll, the month rail and overlay behave as today, and the admin photo tab works by touch. Lighthouse scores 90+ in all four categories on mobile. Images have width and height set, and photos below the fold load lazily.
11. **CMS down.** Stop the CMS: the page still loads with the "not available" line, and nothing from `theme-year.ts` appears.
12. **Photos are clean.** A downloaded photo has no EXIF/GPS data and is at most 1600 px on its long edge.
13. **Git.** `git status` in the CMS does not list `.env` or anything under `uploads/`.

## 16. Open questions for the school

Answers change seed data only, not the build.

1. **Year label.** `2026–27` (matches the dates) or `2027–28` (what the page says now)? See [7.7](#77-public-page-behaviour).
2. **Grade options.** Is Nursery, K1, K2, Grade 1–8, Staff, Parents the right list? The current labels also use `Pre-primary`, `New admissions`, `Students` and `Whole school`.
3. **Photo consent.** Who confirms consent before the admin ticks the box, and is a class-level consent list enough?
4. **Cancelled events.** Should a cancelled event stay visible with its tag (as specified) or disappear from the site?

## 17. As built

Notes from the build, where the code adds detail to the sections above.

- **Public payload.** Each event and rhythm card also carries `strandName` and `strandColor`, so an event whose strand option is hidden still gets its colour.
- **New photo after consent.** Adding a photo clears the consent tick. If the recap was already published, it is hidden until the admin ticks consent and publishes it again, so an unchecked photo is never public. Deleting the last photo also hides the recap.
- **Recap rules in the database too.** A check constraint stops `recap_published` unless consent is ticked and the event is published. Unpublishing or cancelling an event hides its recap.
- **Rhythm photos.** `POST /api/admin/calendar/rhythm/:id/photo` uploads one photo, cropped to 800×600.
- **Which year the admin edits.** The year is kept in a signed cookie (`wsa_cal_year`), set from the Years screen. Without one, the current year is used.
- **File clean-up.** A photo file is deleted only when no row in any year still points to it, because a new year shares its rhythm photos with the year it was copied from.
- **`/life`.** This page also renders `YearCalendar`. Without CMS data, the component still renders `theme-year.ts` exactly as before.
- **Website loader.** The loader runs when a visitor arrives on the page (`shouldReload: cause === "enter"`). Month, filter and overlay changes only rewrite the URL with `history.replaceState`, so they never fetch the calendar again. `head` reads `event` from the URL.
- **Payload size.** The seeded year is about 88 KB before gzip, larger than the 60 KB estimate in [8](#8-responsive-and-performance), because every event carries its full plan text.
