import { createHash } from "node:crypto";
import type { LibraryCategory, NormalizedBook, SourceCandidate, SupportedLanguage } from "./types.js";

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  en: "english",
  eng: "english",
  english: "english",
  hi: "hindi",
  hin: "hindi",
  hindi: "hindi",
  bn: "bengali",
  ben: "bengali",
  bengali: "bengali",
  bangla: "bengali",
  sa: "sanskrit",
  san: "sanskrit",
  sanskrit: "sanskrit",
  ta: "tamil",
  tam: "tamil",
  tamil: "tamil",
  ur: "urdu",
  urd: "urdu",
  urdu: "urdu",
  mr: "marathi",
  mar: "marathi",
  marathi: "marathi"
};

const CATEGORY_PATTERNS: Array<[LibraryCategory, RegExp]> = [
  ["AI & Technology", /\b(ai|artificial intelligence|machine learning|computer|technology|programming|robotics)\b/i],
  ["Hinduism", /\b(hindu|veda|upanishad|gita|krishna|rama|mahabharata|ramayana|puran)\b/i],
  ["Buddhism", /\b(buddha|buddhist|buddhism|dhamma|tripitaka)\b/i],
  ["Jainism", /\b(jain|jainism|mahavira)\b/i],
  ["Spiritual", /\b(spiritual|religion|sacred|scripture|wisdom|devotion)\b/i],
  ["Yoga", /\b(yoga|asana|pranayama)\b/i],
  ["Ayurveda", /\b(ayurveda|ayurvedic|medicine)\b/i],
  ["Meditation", /\b(meditation|mindfulness)\b/i],
  ["Indian History", /\b(india|indian|bharat|mughal|maurya|gupta|ashoka|bengal)\b/i],
  ["Sanskrit Literature", /\b(sanskrit|kalidasa)\b/i],
  ["Bengali Literature", /\b(bengali|bangla|tagore|rabindranath)\b/i],
  ["Hindi Literature", /\b(hindi|premchand|kabir|tulsidas)\b/i],
  ["Science", /\b(science|physics|chemistry|biology|astronomy|nature)\b/i],
  ["Mathematics", /\b(mathematics|algebra|geometry|calculus|arithmetic)\b/i],
  ["Philosophy", /\b(philosophy|ethics|logic|metaphysics)\b/i],
  ["Ancient Civilizations", /\b(ancient|civilization|egypt|greek|roman|mesopotamia)\b/i],
  ["World History", /\b(world history|europe|america|war|empire)\b/i],
  ["Culture", /\b(culture|custom|folklore|tradition)\b/i],
  ["Health & Wellness", /\b(health|wellness|fitness|nutrition)\b/i],
  ["Education", /\b(education|student|school|learning|textbook)\b/i],
  ["Literature", /\b(literature|fiction|poem|poetry|novel|story|drama|children)\b/i]
];

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 96) || "book";
}

export function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function checksumText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function inferLanguage(value?: string): SupportedLanguage {
  if (!value) {
    return "english";
  }
  const normalized = value.toLowerCase().trim();
  return LANGUAGE_ALIASES[normalized] || "english";
}

export function inferCategory(candidate: SourceCandidate): LibraryCategory {
  const haystack = [
    candidate.categoryHint,
    candidate.title,
    candidate.author,
    candidate.description,
    ...(candidate.subjects || []),
    ...(candidate.tags || [])
  ]
    .filter(Boolean)
    .join(" ");

  return CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(haystack))?.[0] || "Literature";
}

export function isLegallyAllowed(candidate: SourceCandidate): boolean {
  return (
    candidate.publicDomain ||
    candidate.license === "public-domain" ||
    candidate.license === "cc0" ||
    candidate.license === "cc-by" ||
    candidate.license === "cc-by-sa" ||
    candidate.license === "open-access"
  );
}

export function buildSearchKeywords(book: Pick<NormalizedBook, "title" | "author" | "category" | "language" | "tags">): string[] {
  const pieces = [book.title, book.author, book.category, book.language, ...book.tags];
  const words = new Set<string>();
  pieces
    .join(" ")
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length >= 3)
    .forEach((word) => words.add(word));
  return Array.from(words).slice(0, 80);
}

export async function generateAISummary(candidate: SourceCandidate, openAiApiKey?: string): Promise<string> {
  const fallback = candidate.description?.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!openAiApiKey) {
    return fallback || `${candidate.title} is a legally free ${candidate.categoryHint || "learning"} book for digital library readers.`;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `Write a 2 sentence student-friendly summary for this public-domain/open-access book. Title: ${candidate.title}. Author: ${candidate.author || "Unknown"}. Subjects: ${(candidate.subjects || []).join(", ")}. Description: ${candidate.description || ""}`
      })
    });
    if (!response.ok) {
      return fallback || "";
    }
    const json = (await response.json()) as { output_text?: string };
    return json.output_text?.trim().slice(0, 900) || fallback || "";
  } catch {
    return fallback || "";
  }
}

export function normalizeBook(candidate: SourceCandidate, openAiSummary: string): NormalizedBook {
  const title = candidate.title.trim();
  const author = candidate.author?.trim() || "Unknown";
  const language = inferLanguage(candidate.language);
  const category = inferCategory(candidate);
  const tags = Array.from(new Set([category, ...(candidate.subjects || []), ...(candidate.tags || [])].filter(Boolean))).slice(0, 30);
  const titleAuthorKey = normalizeKey(`${title} ${author}`);
  const id = `${slugify(candidate.source)}-${candidate.sourceId ? slugify(candidate.sourceId) : checksumText(titleAuthorKey).slice(0, 12)}`;
  const now = new Date().toISOString();
  const book: NormalizedBook = {
    id,
    title,
    author,
    language,
    category,
    tags,
    description: candidate.description || "",
    cover_url: candidate.coverUrl || "",
    epub_url: candidate.epubUrl || "",
    pdf_url: candidate.pdfUrl || "",
    html_url: candidate.htmlUrl || "",
    text_url: candidate.textUrl || "",
    audio_url: "",
    source: candidate.source,
    source_id: candidate.sourceId,
    source_url: candidate.sourceUrl,
    public_domain: candidate.publicDomain,
    copyright_status: candidate.copyrightStatus,
    pages: candidate.pages || 0,
    downloads: 0,
    views: 0,
    rating: 0,
    search_keywords: [],
    ai_summary: openAiSummary,
    checksum: checksumText(`${candidate.source}:${candidate.sourceId}:${titleAuthorKey}`),
    title_author_key: titleAuthorKey,
    created_at: now,
    updated_at: now
  };
  book.search_keywords = buildSearchKeywords(book);
  return book;
}

export function toStoragePath(kind: "book" | "cover" | "metadata", book: NormalizedBook, extension: string): string {
  const language = slugify(book.language);
  const category = slugify(book.category);
  if (kind === "cover") {
    return `covers/${language}/${category}/${book.id}.${extension}`;
  }
  if (kind === "metadata") {
    return `metadata/${book.id}.json`;
  }
  return `books/${language}/${category}/${book.id}.${extension}`;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "SirGangulyDigitalLibrary/1.0 (+https://books.sirganguly.com)"
    }
  });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function downloadBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export function extensionFromUrl(url: string, fallback: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const match = clean.match(/\.([a-z0-9]{2,5})$/i);
  return (match?.[1] || fallback).toLowerCase().replace("jpeg", "jpg");
}

export function contentTypeForExtension(extension: string): string {
  const ext = extension.toLowerCase();
  if (ext === "epub") return "application/epub+zip";
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "html" || ext === "htm") return "text/html; charset=utf-8";
  if (ext === "txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}
