import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const ROOT = process.cwd();
const GUTENDEX_API = "https://gutendex.com/books/";
const METADATA_PATH = path.join(ROOT, "books.gutenberg.json");
const CACHE_PATH = path.join(ROOT, "books", ".gutenberg-cache.json");
const DEFAULT_MAX_PER_CATEGORY = Number.parseInt(process.env.GUTENBERG_MAX_PER_CATEGORY || "1", 10);
const DEFAULT_MAX_TOTAL = Number.parseInt(process.env.GUTENBERG_MAX_TOTAL || "20", 10);

const CATEGORIES = [
  { name: "Literature", folder: "Literature", topic: "literature", search: "classic literature" },
  { name: "Science", folder: "Science", topic: "science", search: "science" },
  { name: "Computer Science", folder: "Computer_Science", topic: "computer", search: "computer science" },
  { name: "Artificial Intelligence", folder: "Artificial_Intelligence", topic: "artificial intelligence", search: "artificial intelligence" },
  { name: "Mathematics", folder: "Mathematics", topic: "mathematics", search: "mathematics" },
  { name: "Physics", folder: "Physics", topic: "physics", search: "physics" },
  { name: "Chemistry", folder: "Chemistry", topic: "chemistry", search: "chemistry" },
  { name: "Biology", folder: "Biology", topic: "biology", search: "biology" },
  { name: "History", folder: "History", topic: "history", search: "history" },
  { name: "Geography", folder: "Geography", topic: "geography", search: "geography" },
  { name: "Civics", folder: "Civics", topic: "civics", search: "civics government" },
  { name: "Motivation", folder: "Motivation", topic: "success", search: "motivation success" },
  { name: "Bhagavad Gita & Spiritual Wisdom", folder: "Bhagavad_Gita", topic: "religion", search: "bhagavad gita spiritual wisdom" },
  { name: "Philosophy", folder: "Philosophy", topic: "philosophy", search: "philosophy" },
  { name: "Interview Preparation", folder: "Interview_Preparation", topic: "interview", search: "interview career" },
  { name: "General Knowledge", folder: "General_Knowledge", topic: "knowledge", search: "general knowledge" },
  { name: "Children Books", folder: "Children_Books", topic: "children", search: "children books" },
  { name: "Programming", folder: "Programming", topic: "programming", search: "computer programming" },
  { name: "Career Guidance", folder: "Career_Guidance", topic: "career", search: "career guidance" }
];

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const options = {
  dryRun: args.get("dry-run") === "true",
  maxPerCategory: Number.parseInt(args.get("max-per-category") || String(DEFAULT_MAX_PER_CATEGORY), 10),
  maxTotal: Number.parseInt(args.get("max-total") || String(DEFAULT_MAX_TOTAL), 10)
};

async function main() {
  const metadata = await readJson(METADATA_PATH, []);
  const cache = await readJson(CACHE_PATH, { downloadedIds: [], failed: {} });
  const knownIds = new Set(cache.downloadedIds || []);
  const knownTitles = new Set();

  metadata.forEach((group) => {
    (group.books || []).forEach((book) => {
      if (book.gutenbergId) knownIds.add(Number(book.gutenbergId));
      knownTitles.add(normalizeKey(book.title));
    });
  });

  let downloaded = 0;
  for (const category of CATEGORIES) {
    if (downloaded >= options.maxTotal) break;
    const room = Math.min(options.maxPerCategory, options.maxTotal - downloaded);
    const added = await updateCategory(category, metadata, cache, knownIds, knownTitles, room);
    downloaded += added;
  }

  sortMetadata(metadata);
  if (!options.dryRun) {
    await writeJson(METADATA_PATH, metadata);
    cache.downloadedIds = Array.from(knownIds).sort((a, b) => a - b);
    cache.updatedAt = new Date().toISOString();
    await mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await writeJson(CACHE_PATH, cache);
  }

  console.log(`Gutenberg update complete. New books: ${downloaded}. Dry run: ${options.dryRun}`);
}

async function updateCategory(category, metadata, cache, knownIds, knownTitles, maxNew) {
  if (maxNew <= 0) return 0;
  const books = await fetchCategoryBooks(category);
  const group = getMetadataGroup(metadata, category);
  let added = 0;

  for (const item of books) {
    if (added >= maxNew) break;
    if (!item || item.copyright === true || knownIds.has(item.id)) continue;

    const epubUrl = findFormatUrl(item.formats, "application/epub+zip");
    if (!epubUrl) continue;

    const title = item.title || `Gutenberg Book ${item.id}`;
    const titleKey = normalizeKey(title);
    if (knownTitles.has(titleKey)) continue;

    const author = (item.authors || []).map((person) => person.name).filter(Boolean).join(", ") || "Project Gutenberg";
    const baseName = `${item.id}-${slugify(title).slice(0, 72)}`;
    const categoryDir = path.join(ROOT, "books", "Gutenberg", category.folder);
    const epubPath = path.join(categoryDir, `${baseName}.epub`);
    const coverUrl = findFormatUrl(item.formats, "image/jpeg");
    const coverPath = coverUrl ? path.join(categoryDir, `${baseName}.jpg`) : "";

    console.log(`Downloading ${item.id}: ${title}`);
    if (!options.dryRun) {
      await mkdir(categoryDir, { recursive: true });
      await downloadFile(epubUrl, epubPath);
      if (coverUrl) {
        await downloadFile(coverUrl, coverPath);
      }
    }

    group.books.push({
      title,
      file: toRepoPath(epubPath),
      cover: coverPath ? toRepoPath(coverPath) : "",
      author,
      year: "Public domain",
      category: category.name,
      format: "epub",
      source: "gutenberg-downloaded",
      gutenbergId: item.id,
      subjects: [...(item.subjects || []), ...(item.bookshelves || [])].filter(Boolean),
      language: (item.languages || ["en"])[0] || "en",
      downloadedAt: new Date().toISOString()
    });

    knownIds.add(item.id);
    knownTitles.add(titleKey);
    delete cache.failed?.[item.id];
    added += 1;
  }

  return added;
}

async function fetchCategoryBooks(category) {
  const primary = await fetchGutendexResults(category.topic, "topic");
  if (primary.length) return primary;
  return fetchGutendexResults(category.search || category.name, "search");
}

async function fetchGutendexResults(value, mode) {
  const params = new URLSearchParams({
    languages: "en",
    mime_type: "application/epub+zip",
    sort: "popular"
  });
  params.set(mode, value);
  const data = await fetchJson(`${GUTENDEX_API}?${params.toString()}`);
  return Array.isArray(data.results) ? data.results : [];
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${url}`);
  }
  return response.json();
}

async function downloadFile(url, targetPath) {
  if (await hasUsableFile(targetPath)) {
    console.log(`Skipping existing file: ${toRepoPath(targetPath)}`);
    return;
  }

  const tmpPath = `${targetPath}.part`;
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed ${response.status}: ${url}`);
    }
    await pipeline(response.body, createWriteStream(tmpPath));
    await rename(tmpPath, targetPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    throw error;
  }
}

async function hasUsableFile(filePath) {
  try {
    const info = await stat(filePath);
    return info.size > 0;
  } catch {
    return false;
  }
}

function findFormatUrl(formats = {}, mimeStart) {
  const entry = Object.entries(formats).find(([mime, url]) => (
    mime.toLowerCase().startsWith(mimeStart.toLowerCase()) && typeof url === "string" && !url.endsWith(".zip")
  ));
  return entry ? entry[1] : "";
}

function getMetadataGroup(metadata, category) {
  const className = `Gutenberg - ${category.name}`;
  let group = metadata.find((entry) => entry.class === className);
  if (!group) {
    group = { class: className, books: [] };
    metadata.push(group);
  }
  return group;
}

function sortMetadata(metadata) {
  metadata.sort((a, b) => a.class.localeCompare(b.class));
  metadata.forEach((group) => {
    group.books.sort((a, b) => a.title.localeCompare(b.title));
  });
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return String(value || "book")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
    .toLowerCase() || "book";
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
