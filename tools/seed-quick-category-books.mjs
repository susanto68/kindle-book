import { readFile, writeFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const CATEGORY_SEARCHES = [
  ["Stories for Kids", "fairy tales children"],
  ["College Learning", "education learning"],
  ["Future Technology", "technology invention"],
  ["Robotics", "robot machine"],
  ["Machine Learning", "artificial intelligence machine"],
  ["Study Skills", "study education"],
  ["Productivity", "efficiency work"]
];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=") || "true"];
  })
);

const limitPerCategory = Number(args.get("limit") || 5);
const outputPath = args.get("output") || "books.quick.json";
const serviceAccountPath = args.get("service-account");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

function findFormat(formats, prefix) {
  return Object.entries(formats || {}).find(([mime, url]) => (
    mime.toLowerCase().startsWith(prefix) && typeof url === "string" && !url.endsWith(".zip")
  ))?.[1] || "";
}

async function fetchCategory(category, search) {
  const params = new URLSearchParams({
    languages: "en",
    mime_type: "application/epub+zip",
    search,
    sort: "popular"
  });
  const response = await fetch(`https://gutendex.com/books/?${params}`);
  if (!response.ok) {
    throw new Error(`Gutendex failed for ${category}: ${response.status}`);
  }

  const data = await response.json();
  return (Array.isArray(data.results) ? data.results : [])
    .filter((item) => item.copyright !== true)
    .slice(0, limitPerCategory)
    .map((item) => {
      const formats = item.formats || {};
      const epubUrl = findFormat(formats, "application/epub+zip");
      const htmlUrl = findFormat(formats, "text/html");
      const textUrl = findFormat(formats, "text/plain");
      const file = textUrl || htmlUrl || epubUrl;
      const format = textUrl ? "text" : (htmlUrl ? "html" : "epub");
      const author = Array.isArray(item.authors) && item.authors.length
        ? item.authors.map((person) => person.name).join(", ")
        : "Project Gutenberg";
      const subjects = [...(item.subjects || []), ...(item.bookshelves || [])].filter(Boolean);
      return {
        id: `quick-gutenberg-${item.id}`,
        title: item.title || "Untitled Gutenberg Book",
        author,
        file,
        epubFile: epubUrl,
        htmlFile: htmlUrl,
        textFile: textUrl,
        cover: findFormat(formats, "image/jpeg"),
        year: "Public domain",
        category,
        format,
        source: "quick-gutenberg",
        sourceUrl: `https://www.gutenberg.org/ebooks/${item.id}`,
        gutenbergId: item.id,
        subjects,
        downloads: item.download_count || 0,
        canDownload: true
      };
    })
    .filter((book) => book.file);
}

function toFirestoreBook(book) {
  const now = new Date().toISOString();
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    language: "english",
    category: book.category,
    tags: [book.category, ...book.subjects].slice(0, 30),
    description: `${book.title} is a free public-domain book from Project Gutenberg for student reading.`,
    cover_url: book.cover || "",
    epub_url: book.epubFile || "",
    pdf_url: "",
    html_url: book.htmlFile || "",
    text_url: book.textFile || "",
    audio_url: "",
    source: "Project Gutenberg",
    source_id: String(book.gutenbergId),
    source_url: book.sourceUrl,
    public_domain: true,
    copyright_status: "Public domain via Project Gutenberg metadata",
    pages: 0,
    downloads: 0,
    views: 0,
    rating: 0,
    search_keywords: Array.from(new Set(`${book.title} ${book.author} ${book.category} ${book.subjects.join(" ")}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3))).slice(0, 80),
    ai_summary: `${book.title} is a free public-domain book selected for ${book.category}. It is available for quick student reading through the digital library.`,
    checksum: `gutenberg-${book.gutenbergId}`,
    title_author_key: slugify(`${book.title}-${book.author}`),
    created_at: now,
    updated_at: now,
    updated_timestamp: FieldValue.serverTimestamp()
  };
}

async function writeFirestore(groups) {
  if (!serviceAccountPath) {
    return 0;
  }

  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, "utf8"));
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }

  const db = getFirestore();
  let count = 0;
  for (const group of groups) {
    for (const book of group.books) {
      await db.collection("books").doc(book.id).set(toFirestoreBook(book), { merge: true });
      count += 1;
    }
  }
  return count;
}

async function main() {
  const fromJson = args.get("from-json");
  const groups = fromJson
    ? JSON.parse(await readFile(String(fromJson), "utf8"))
    : [];

  if (!fromJson) {
    for (const [category, search] of CATEGORY_SEARCHES) {
      const books = await fetchCategory(category, search);
      groups.push({ class: `Quick Access - ${category}`, books });
    }
  }

  await writeFile(outputPath, `${JSON.stringify(groups, null, 2)}\n`, "utf8");
  const firebaseCount = await writeFirestore(groups);
  console.log(`Wrote ${groups.reduce((sum, group) => sum + group.books.length, 0)} quick books to ${outputPath}.`);
  if (serviceAccountPath) {
    console.log(`Upserted ${firebaseCount} quick books to Firestore.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
