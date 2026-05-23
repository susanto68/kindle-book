import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findDuplicate, saveBookMetadata } from "./firebase.js";
import type { SourceCandidate } from "./types.js";
import { generateAISummary, normalizeBook } from "./utils.js";

type LegacyGroup = {
  class?: string;
  books?: Array<{
    title?: string;
    author?: string;
    file?: string;
    epubFile?: string;
    cover?: string;
    category?: string;
    format?: string;
  }>;
};

async function readLegacyFile(path: string): Promise<LegacyGroup[]> {
  try {
    const text = await readFile(resolve(path), "utf8");
    const data = JSON.parse(text) as LegacyGroup[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function toCandidate(group: LegacyGroup, book: NonNullable<LegacyGroup["books"]>[number]): SourceCandidate {
  const file = book.epubFile || book.file || "";
  const isEpub = /\.epub($|\?)/i.test(file);
  const isPdf = /\.pdf($|\?)/i.test(file);
  return {
    source: "GitHub Legacy Library",
    sourceId: `${group.class || "library"}-${book.title || file}`,
    sourceUrl: file,
    title: book.title || file.split("/").pop() || "Untitled Book",
    author: book.author || "Unknown",
    categoryHint: book.category || group.class || "Education",
    epubUrl: isEpub ? file : undefined,
    pdfUrl: isPdf ? file : undefined,
    coverUrl: book.cover,
    language: "english",
    subjects: [group.class || "Education"],
    license: "unknown",
    publicDomain: false,
    copyrightStatus: "Manual legacy upload; verify rights before Firebase migration"
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const groups = [...(await readLegacyFile("books.json")), ...(await readLegacyFile("books.gutenberg.json"))];
  let prepared = 0;
  let skipped = 0;

  for (const group of groups) {
    for (const legacyBook of group.books || []) {
      const candidate = toCandidate(group, legacyBook);
      const summary = await generateAISummary(candidate);
      const normalized = normalizeBook(candidate, summary);
      if (dryRun) {
        prepared += 1;
        console.log(`[dry-run] ${normalized.title}`);
        continue;
      }
      const duplicate = await findDuplicate(normalized);
      if (duplicate) {
        skipped += 1;
        continue;
      }
      await saveBookMetadata(normalized);
      prepared += 1;
    }
  }

  console.log(`Migration prepared ${prepared} records; skipped ${skipped} duplicates.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
