import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const ROOT = process.cwd();
const GUTENDEX_API = "https://gutendex.com/books/";
const METADATA_PATH = path.join(ROOT, "books.gutenberg.json");
const CACHE_PATH = path.join(ROOT, "books", ".gutenberg-cache.json");
const DEFAULT_MAX_PER_CATEGORY = Number.parseInt(process.env.GUTENBERG_MAX_PER_CATEGORY || "1", 10);
const DEFAULT_MAX_TOTAL = Number.parseInt(process.env.GUTENBERG_MAX_TOTAL || "2", 10);
const DEFAULT_MIN_TOTAL_BOOKS = Number.parseInt(process.env.GUTENBERG_MIN_TOTAL_BOOKS || "50", 10);
const MAX_GITHUB_FILE_BYTES = Number.parseInt(process.env.GUTENBERG_MAX_FILE_BYTES || String(95 * 1024 * 1024), 10);
const REQUEST_HEADERS = {
  accept: "application/json",
  "user-agent": "SirGangulyDigitalLibrary/1.0 (+https://books.sirganguly.com)"
};

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
  maxTotal: Number.parseInt(args.get("max-total") || String(DEFAULT_MAX_TOTAL), 10),
  minTotalBooks: Number.parseInt(args.get("min-total-books") || String(DEFAULT_MIN_TOTAL_BOOKS), 10)
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

  const currentBookCount = countMetadataBooks(metadata);
  console.log(`Gutenberg metadata contains ${currentBookCount} books. Target minimum: ${options.minTotalBooks}.`);

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

function countMetadataBooks(metadata) {
  return metadata.reduce((total, group) => total + ((group.books || []).length), 0);
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
    if (cache.failed?.[item.id]?.reason === "too-large") continue;

    const title = item.title || `Gutenberg Book ${item.id}`;
    const titleKey = normalizeKey(title);
    if (knownTitles.has(titleKey)) continue;

    const epubSize = await getRemoteFileSize(epubUrl);
    if (epubSize && epubSize > MAX_GITHUB_FILE_BYTES) {
      rememberFailed(cache, item, "too-large", `EPUB is ${formatBytes(epubSize)}; GitHub limit guard is ${formatBytes(MAX_GITHUB_FILE_BYTES)}.`);
      console.warn(`Skipping ${item.id}: ${title} (${formatBytes(epubSize)} exceeds GitHub file limit guard).`);
      continue;
    }

    const author = (item.authors || []).map((person) => person.name).filter(Boolean).join(", ") || "Project Gutenberg";
    const baseName = `${item.id}-${slugify(title).slice(0, 72)}`;
    const categoryDir = path.join(ROOT, "books", "Gutenberg", category.folder);
    const epubPath = path.join(categoryDir, `${baseName}.epub`);
    const coverUrl = findFormatUrl(item.formats, "image/jpeg");
    const coverPath = coverUrl ? path.join(categoryDir, `${baseName}.jpg`) : "";

    console.log(`Downloading ${item.id}: ${title}`);
    if (!options.dryRun) {
      await mkdir(categoryDir, { recursive: true });
      try {
        await downloadFile(epubUrl, epubPath, { maxBytes: MAX_GITHUB_FILE_BYTES });
      } catch (error) {
        rememberFailed(cache, item, error.code === "ERR_FILE_TOO_LARGE" ? "too-large" : "download-failed", error.message);
        console.warn(`Skipping ${item.id}: ${title} (${error.message})`);
        continue;
      }
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

function rememberFailed(cache, item, reason, message) {
  cache.failed ||= {};
  cache.failed[item.id] = {
    reason,
    message,
    title: item.title || `Gutenberg Book ${item.id}`,
    updatedAt: new Date().toISOString()
  };
}

async function fetchCategoryBooks(category) {
  const primary = await fetchGutendexResults(category.topic, "topic").catch((error) => {
    console.warn(`Skipping primary Gutendex topic "${category.topic}": ${error.message}`);
    return [];
  });
  if (primary.length) return primary;
  return fetchGutendexResults(category.search || category.name, "search").catch((error) => {
    console.warn(`Skipping fallback Gutendex search "${category.search || category.name}": ${error.message}`);
    return [];
  });
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
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, { headers: REQUEST_HEADERS });
    if (response.ok) {
      return response.json();
    }

    const shouldRetry = [403, 429, 500, 502, 503, 504].includes(response.status);
    if (!shouldRetry || attempt === maxAttempts) {
      throw new Error(`Request failed ${response.status}: ${url}`);
    }

    const delayMs = 1000 * attempt;
    console.warn(`Gutendex request returned ${response.status}; retrying in ${delayMs}ms (${attempt}/${maxAttempts})`);
    await sleep(delayMs);
  }
  throw new Error(`Request failed: ${url}`);
}

async function getRemoteFileSize(url) {
  try {
    const response = await fetch(url, { headers: REQUEST_HEADERS, method: "HEAD" });
    if (!response.ok) {
      return 0;
    }
    return Number.parseInt(response.headers.get("content-length") || "0", 10) || 0;
  } catch (error) {
    console.warn(`Could not check file size for ${url}: ${error.message}`);
    return 0;
  }
}

async function downloadFile(url, targetPath, options = {}) {
  if (await hasUsableFile(targetPath)) {
    console.log(`Skipping existing file: ${toRepoPath(targetPath)}`);
    return;
  }

  const tmpPath = `${targetPath}.part`;
  try {
    const response = await fetch(url, { headers: REQUEST_HEADERS });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed ${response.status}: ${url}`);
    }
    const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10) || 0;
    if (options.maxBytes && contentLength > options.maxBytes) {
      throw tooLargeError(contentLength, options.maxBytes);
    }
    await pipeline(response.body, createWriteStream(tmpPath));
    if (options.maxBytes) {
      const info = await stat(tmpPath);
      if (info.size > options.maxBytes) {
        throw tooLargeError(info.size, options.maxBytes);
      }
    }
    await rename(tmpPath, targetPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    throw error;
  }
}

function tooLargeError(size, maxBytes) {
  const error = new Error(`Downloaded file is ${formatBytes(size)}; max allowed is ${formatBytes(maxBytes)}.`);
  error.code = "ERR_FILE_TOO_LARGE";
  return error;
}

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
