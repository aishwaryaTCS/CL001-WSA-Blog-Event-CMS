import { readFile } from "node:fs/promises";
import cookieParser from "cookie-parser";
import express from "express";
import { prepareAuth, hashPassword, rejectCrossSite } from "./auth.ts";
import { mountAdmin } from "./admin-routes.ts";
import { adminCount, createAdmin, migrate, openDatabase, seedNotes } from "./db.ts";
import { ensureUploads } from "./photos.ts";
import { mountPublic } from "./public-routes.ts";
import { ROOT } from "./root.ts";
import { COPY } from "./schemas.ts";
import path from "node:path";

async function loadEnv(): Promise<void> {
  let text = "";
  try {
    text = await readFile(path.join(ROOT, ".env"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function missing(keys: string[]): string[] {
  return keys.filter((key) => !process.env[key]);
}

async function main(): Promise<void> {
  await loadEnv();
  const required = missing(["DATABASE_URL", "COOKIE_SECRET"]);
  if (required.length) {
    for (const key of required) console.error(`Missing ${key}`);
    process.exit(1);
  }

  await ensureUploads();
  await openDatabase(process.env.DATABASE_URL ?? "");
  await migrate();
  await prepareAuth();

  if ((await adminCount()) === 0) {
    const needed = missing(["ADMIN_EMAIL", "ADMIN_PASSWORD"]);
    if (needed.length) {
      for (const key of needed) console.error(`Missing ${key}`);
      process.exit(1);
    }
    const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (!email || !password) {
      if (!email) console.error("Missing ADMIN_EMAIL");
      if (!password) console.error("Missing ADMIN_PASSWORD");
      process.exit(1);
    }
    await createAdmin(email, await hashPassword(password));
  }

  await seedNotes();

  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser(process.env.COOKIE_SECRET));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(express.json({ limit: "100kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    if (req.path.startsWith("/admin") || req.path.startsWith("/api/admin")) {
      res.setHeader("X-Robots-Tag", "noindex");
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });
  app.use(rejectCrossSite);
  mountPublic(app);
  mountAdmin(app);
  app.get("/", (_req, res) => {
    res.redirect("/admin");
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: COPY.notFound });
  });
  app.use((_req, res) => {
    res.redirect("/admin");
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Request failed.");
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: "Something went wrong." });
  });

  const port = Number(process.env.PORT || 3002);
  app.listen(port, () => {
    console.log(`Listening on ${port}`);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Startup failed.";
  console.error(message.includes("://") ? "Startup failed." : message);
  process.exit(1);
});
