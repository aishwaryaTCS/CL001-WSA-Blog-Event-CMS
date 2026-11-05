import { z } from "zod";
import { kolkataToday } from "../schemas.ts";

export { kolkataToday };

export const MAX_PHOTOS = 6;
export const COLOR_KEYS = ["sage", "coral", "grey", "sun", "slate"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
export type EventStatus = "draft" | "published" | "cancelled";
export type EventState = "draft" | "upcoming" | "today" | "needs-photos" | "completed" | "cancelled";

/** Ink and surface for each colour key, matching the website's CATEGORY_COLOR / CATEGORY_SURFACE. */
export const COLOR_TOKENS: Record<ColorKey, { ink: string; surface: string }> = {
  sage: { ink: "var(--sage-700)", surface: "var(--sage-200)" },
  coral: { ink: "var(--coral-600)", surface: "var(--coral-200)" },
  grey: { ink: "var(--grey-700)", surface: "var(--grey-200)" },
  sun: { ink: "var(--sun-700)", surface: "var(--sun-200)" },
  slate: { ink: "var(--slate-1000)", surface: "var(--grey-200)" },
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PHOTO_NAME = /^[a-f0-9]{32}(-w640)?\.webp$/;
export const PHOTO_PATH = /^\/api\/calendar\/photos\/[a-f0-9]{32}\.webp$/;
export const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export const CAL_COPY = {
  titleRequired: "Add a title.",
  strandRequired: "Choose a strand.",
  bodyRequired: "Write the plan before publishing.",
  dateRequired: "Choose a start date.",
  dateOutside: "The date must be inside the year's months.",
  endBeforeStart: "The end date must be on or after the start date.",
  badOption: "Choose filter options from the lists.",
  highlightCount: "At most 6 points under What happens.",
  highlightCap: "Each point must be 140 characters or fewer.",
  recapEarly: "The recap can be published on or after the event's start date.",
  recapPhotos: "Add at least one photo before publishing the recap.",
  recapConsent: "Tick photo consent before publishing the recap.",
  recapNotPublished: "Publish the event before publishing its recap.",
  photosFull: "6 photos per event.",
  photoRejected: "Photo must be a JPEG, PNG, or WebP under 5 MB.",
  altRequired: "Describe the photo (alt text).",
  deletePublished: "Unpublish or cancel a published event. Only drafts can be deleted.",
  optionInUse: "This option is in use. Hide it instead.",
  groupHasOptions: "Delete or move this group's options first.",
  mainGroup: "The Strand group can't be hidden or deleted.",
  nameTaken: "That name is already used here.",
  colorRequired: "Choose a colour for the strand option.",
  labelTaken: "A year with that label already exists.",
  eventsOutside: "Some events fall outside these months. Move them first.",
  saved: "Saved.",
  draftSaved: "Draft saved.",
  published: "Published.",
  unpublished: "Unpublished. It is off the site.",
  cancelled: "Cancelled. It shows on the site as cancelled.",
  recapPublished: "Recap published.",
  recapUnpublished: "Recap hidden. The photos are kept.",
  notFound: "Not found.",
} as const;

// ---- Small helpers -----------------------------------------------------

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function monthKeys(firstMonth: string, lastMonth: string): string[] {
  const keys: string[] = [];
  let [year, month] = firstMonth.slice(0, 7).split("-").map(Number);
  const end = lastMonth.slice(0, 7);
  for (let guard = 0; guard < 36; guard++) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    keys.push(key);
    if (key >= end) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

export function lastDayOfMonth(monthStart: string): string {
  const [year, month] = monthStart.slice(0, 7).split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

export function slugBase(date: string, title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return words ? `${date}-${words}` : date;
}

export function autoEventSeoTitle(title: string, theme: string): string {
  return `${title} — ${theme} | Wellsprings Academy`.slice(0, 200);
}

export function autoEventSeoDescription(subtitle: string, body: string): string {
  const source = subtitle.trim() || body.replace(/\s+/g, " ").trim();
  return source.slice(0, subtitle.trim() ? 300 : 155);
}

export function eventState(
  row: { status: EventStatus; start_date: string; end_date: string | null; recap_published: boolean },
  today: string,
): EventState {
  if (row.status === "draft") return "draft";
  if (row.status === "cancelled") return "cancelled";
  if (row.recap_published) return "completed";
  const end = row.end_date ?? row.start_date;
  if (end < today) return "needs-photos";
  if (row.start_date <= today && today <= end) return "today";
  return "upcoming";
}

export const STATE_LABEL: Record<EventState, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  today: "Today",
  "needs-photos": "Needs photos",
  completed: "Completed",
  cancelled: "Cancelled",
};

// ---- Form parsing ------------------------------------------------------

function text(value: unknown): string {
  if (Array.isArray(value)) return text(value[value.length - 1]);
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" && value ? [value] : [];
}

function tick(value: unknown): boolean {
  const raw = text(value);
  return raw === "on" || raw === "true" || raw === "1" || raw === "yes";
}

export type EventIntent =
  | "save"
  | "publish"
  | "unpublish"
  | "cancel"
  | "recap-publish"
  | "recap-unpublish";

export const EVENT_INTENTS: EventIntent[] = ["save", "publish", "unpublish", "cancel", "recap-publish", "recap-unpublish"];

export type EventInput = {
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string | null;
  strandId: string;
  optionIds: string[];
  gradesLabel: string;
  body: string;
  highlights: string[];
  recap: string;
  photoConsent: boolean;
  showMoved: boolean;
  seoTitle: string;
  seoDescription: string;
  intent: EventIntent;
};

/** Raw form values, kept so a rejected form re-renders with what the admin typed. */
export function eventFormValues(body: unknown): EventInput {
  const source = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const intentRaw = text(source.intent);
  const intent = (EVENT_INTENTS as string[]).includes(intentRaw) ? (intentRaw as EventIntent) : "save";
  const endDate = text(source.endDate).trim();
  return {
    title: text(source.title).trim(),
    subtitle: text(source.subtitle).trim(),
    startDate: text(source.startDate).trim(),
    endDate: endDate || null,
    strandId: text(source.strandId).trim(),
    optionIds: [...new Set(list(source.optionIds).map((id) => id.trim()))],
    gradesLabel: text(source.gradesLabel).trim(),
    body: text(source.body).trim(),
    highlights: text(source.highlights)
      .split("\n")
      .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
      .filter(Boolean),
    recap: text(source.recap).trim(),
    photoConsent: tick(source.photoConsent),
    showMoved: tick(source.showMoved),
    seoTitle: text(source.seoTitle).trim(),
    seoDescription: text(source.seoDescription).trim(),
    intent,
  };
}

/** Shape checks that hold for every save, draft or not. Rules that need the database live in admin-routes. */
export function eventShapeProblem(input: EventInput): string | null {
  if (!input.title) return CAL_COPY.titleRequired;
  if (input.title.length > 90) return "Title must be 90 characters or fewer.";
  if (input.subtitle.length > 120) return "Subtitle must be 120 characters or fewer.";
  if (!input.startDate || !isIsoDate(input.startDate)) return CAL_COPY.dateRequired;
  if (input.endDate !== null && !isIsoDate(input.endDate)) return "Use a real end date.";
  if (input.endDate !== null && input.endDate < input.startDate) return CAL_COPY.endBeforeStart;
  if (!UUID.test(input.strandId)) return CAL_COPY.strandRequired;
  if (input.optionIds.some((id) => !UUID.test(id)) || input.optionIds.length > 40) return CAL_COPY.badOption;
  if (input.gradesLabel.length > 40) return "Grades must be 40 characters or fewer.";
  if (input.body.length > 1200) return "The plan must be 1,200 characters or fewer.";
  if (input.highlights.length > 6) return CAL_COPY.highlightCount;
  if (input.highlights.some((line) => line.length > 140)) return CAL_COPY.highlightCap;
  if (input.recap.length > 600) return "Recap must be 600 characters or fewer.";
  if (input.seoTitle.length > 200) return "Search title must be 200 characters or fewer.";
  if (input.seoDescription.length > 300) return "Search description must be 300 characters or fewer.";
  return null;
}

// ---- JSON bodies -------------------------------------------------------

export const photoMetaSchema = z
  .object({
    alt: z.string().trim().min(1, CAL_COPY.altRequired).max(160, "Alt text must be 160 characters or fewer."),
    caption: z.string().trim().max(120, "Caption must be 120 characters or fewer.").default(""),
  })
  .strict();

export const photoOrderSchema = z.object({ ids: z.array(z.string().regex(UUID)).min(1).max(MAX_PHOTOS) }).strict();

export const altSchema = z
  .object({ alt: z.string().trim().max(160, "Alt text must be 160 characters or fewer.").default("") })
  .strict();

// ---- Other forms -------------------------------------------------------

export function formText(body: unknown, key: string): string {
  const source = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return text(source[key]).trim();
}

export function formTick(body: unknown, key: string): boolean {
  const source = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return tick(source[key]);
}

export const settingsSchema = z.object({
  themeName: z.string().trim().min(1, "Add the theme name.").max(40, "Theme name must be 40 characters or fewer."),
  label: z.string().trim().min(1, "Add the year label.").max(20, "Year label must be 20 characters or fewer."),
  seoTitle: z.string().trim().min(1, "Add a search title.").max(200, "Search title must be 200 characters or fewer."),
  seoDescription: z
    .string()
    .trim()
    .min(1, "Add a search description.")
    .max(300, "Search description must be 300 characters or fewer."),
  shareImageAlt: z.string().trim().max(160, "Share image alt text must be 160 characters or fewer."),
});

export const yearSchema = z
  .object({
    label: z.string().trim().min(1, "Add the year label.").max(20, "Year label must be 20 characters or fewer."),
    themeName: z.string().trim().min(1, "Add the theme name.").max(40, "Theme name must be 40 characters or fewer."),
    firstMonth: z.string().regex(MONTH_KEY, "Choose the first month."),
    lastMonth: z.string().regex(MONTH_KEY, "Choose the last month."),
  })
  .refine((value) => value.lastMonth >= value.firstMonth, { message: "The last month must be after the first." })
  .refine((value) => monthKeys(`${value.firstMonth}-01`, `${value.lastMonth}-01`).length <= 24, {
    message: "A year can have at most 24 months.",
  });

export const filterNameSchema = z
  .string()
  .trim()
  .min(1, "Add a name.")
  .max(40, "Names must be 40 characters or fewer.");

export const rhythmSchema = z.object({
  strandId: z.string().regex(UUID, CAL_COPY.strandRequired),
  whenLabel: z.string().trim().min(1, "Add when it happens.").max(40, "When must be 40 characters or fewer."),
  title: z.string().trim().min(1, "Add a title.").max(60, "Title must be 60 characters or fewer."),
  body: z.string().trim().min(1, "Add the text.").max(300, "Text must be 300 characters or fewer."),
  caption: z.string().trim().max(60, "Caption must be 60 characters or fewer."),
  photoAlt: z.string().trim().max(160, "Alt text must be 160 characters or fewer."),
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form.";
}
