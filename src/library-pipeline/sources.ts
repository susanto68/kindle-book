import { PIPELINE_CONFIG } from "./config.js";
import type { PipelineRunContext, SearchSeed, SourceCandidate, SourceConnector } from "./types.js";
import { fetchJson, inferLanguage } from "./utils.js";

interface GutendexBook {
  id: number;
  title: string;
  authors?: Array<{ name: string }>;
  subjects?: string[];
  languages?: string[];
  summaries?: string[];
  copyright?: boolean;
  formats?: Record<string, string>;
}

interface GutendexResponse {
  results?: GutendexBook[];
}

function gutendexFormat(book: GutendexBook, contains: string): string | undefined {
  return Object.entries(book.formats || {}).find(([type]) => type.includes(contains))?.[1];
}

async function searchGutenberg(seed: SearchSeed): Promise<SourceCandidate[]> {
  const query = new URLSearchParams({
    search: seed.topic,
    languages: seed.language ? seed.language.slice(0, 2) : "en"
  });
  const data = await fetchJson<GutendexResponse>(`https://gutendex.com/books/?${query.toString()}`);
  return (data.results || [])
    .filter((book) => book.copyright === false)
    .map((book) => ({
      source: "Project Gutenberg",
      sourceId: String(book.id),
      sourceUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
      title: book.title,
      author: book.authors?.map((author) => author.name).join(", "),
      description: book.summaries?.[0] || "",
      language: book.languages?.[0] || "en",
      subjects: book.subjects || [],
      categoryHint: seed.category || seed.topic,
      epubUrl: gutendexFormat(book, "epub"),
      htmlUrl: gutendexFormat(book, "text/html"),
      textUrl: gutendexFormat(book, "text/plain"),
      coverUrl: gutendexFormat(book, "image/jpeg"),
      license: "public-domain",
      publicDomain: true,
      copyrightStatus: "Project Gutenberg public-domain record"
    }));
}

interface InternetArchiveDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
  language?: string | string[];
  description?: string | string[];
  subject?: string | string[];
  licenseurl?: string;
}

interface InternetArchiveResponse {
  response?: { docs?: InternetArchiveDoc[] };
}

function asText(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(", ") : value || "";
}

function asList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function searchInternetArchive(seed: SearchSeed): Promise<SourceCandidate[]> {
  const q = `mediatype:texts AND (${seed.topic}) AND (licenseurl:*creativecommons* OR licenseurl:*publicdomain* OR collection:opensource)`;
  const params = new URLSearchParams({
    q,
    fl: "identifier,title,creator,language,description,subject,licenseurl",
    rows: String(Math.max(PIPELINE_CONFIG.booksPerSource, 5)),
    output: "json"
  });
  const data = await fetchJson<InternetArchiveResponse>(`https://archive.org/advancedsearch.php?${params.toString()}`);
  return (data.response?.docs || []).map((doc) => {
    const sourceUrl = `https://archive.org/details/${doc.identifier}`;
    return {
      source: "Internet Archive",
      sourceId: doc.identifier,
      sourceUrl,
      title: doc.title || doc.identifier,
      author: asText(doc.creator),
      description: asText(doc.description),
      language: asList(doc.language)[0],
      subjects: asList(doc.subject),
      categoryHint: seed.category || seed.topic,
      epubUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.epub`,
      pdfUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`,
      coverUrl: `https://archive.org/services/img/${doc.identifier}`,
      license: doc.licenseurl?.includes("publicdomain") ? "public-domain" : "open-access",
      publicDomain: Boolean(doc.licenseurl?.includes("publicdomain")),
      copyrightStatus: doc.licenseurl || "Open Internet Archive item; verify item metadata before publishing"
    };
  });
}

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  language?: string[];
  subject?: string[];
  cover_i?: number;
  ia?: string[];
  public_scan_b?: boolean;
}

interface OpenLibraryResponse {
  docs?: OpenLibraryDoc[];
}

async function searchOpenLibrary(seed: SearchSeed): Promise<SourceCandidate[]> {
  const params = new URLSearchParams({
    q: seed.topic,
    has_fulltext: "true",
    public_scan: "true",
    limit: String(Math.max(PIPELINE_CONFIG.booksPerSource, 5))
  });
  const data = await fetchJson<OpenLibraryResponse>(`https://openlibrary.org/search.json?${params.toString()}`);
  return (data.docs || [])
    .filter((doc) => doc.public_scan_b)
    .map((doc) => {
      const ia = doc.ia?.[0];
      return {
        source: "Open Library",
        sourceId: doc.key.replace(/^\/works\//, ""),
        sourceUrl: `https://openlibrary.org${doc.key}`,
        title: doc.title,
        author: doc.author_name?.join(", "),
        language: doc.language?.[0],
        subjects: doc.subject || [],
        categoryHint: seed.category || seed.topic,
        epubUrl: ia ? `https://archive.org/download/${ia}/${ia}.epub` : undefined,
        pdfUrl: ia ? `https://archive.org/download/${ia}/${ia}.pdf` : undefined,
        coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
        license: "open-access",
        publicDomain: false,
        copyrightStatus: "Open Library public-scan/open-access metadata"
      };
    });
}

interface WikiSearchResponse {
  query?: {
    search?: Array<{ pageid: number; title: string; snippet?: string }>;
  };
}

async function searchWikisource(seed: SearchSeed): Promise<SourceCandidate[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: seed.topic,
    format: "json",
    origin: "*",
    srlimit: String(Math.max(PIPELINE_CONFIG.booksPerSource, 5))
  });
  const data = await fetchJson<WikiSearchResponse>(`https://en.wikisource.org/w/api.php?${params.toString()}`);
  return (data.query?.search || []).map((page) => ({
    source: "Wikisource",
    sourceId: String(page.pageid),
    sourceUrl: `https://en.wikisource.org/wiki/${encodeURIComponent(page.title.replace(/\s+/g, "_"))}`,
    title: page.title,
    description: page.snippet?.replace(/<[^>]*>/g, "") || "",
    language: "en",
    subjects: ["Wikisource", seed.topic],
    categoryHint: seed.category || seed.topic,
    htmlUrl: `https://en.wikisource.org/wiki/${encodeURIComponent(page.title.replace(/\s+/g, "_"))}`,
    license: "public-domain",
    publicDomain: true,
    copyrightStatus: "Wikisource public-domain or freely licensed text"
  }));
}

async function searchSacredTexts(seed: SearchSeed): Promise<SourceCandidate[]> {
  const spiritual = /\b(gita|veda|upanishad|hindu|buddh|jain|spiritual|sacred|yoga)\b/i.test(seed.topic);
  if (!spiritual) return [];
  return [
    {
      source: "Sacred Texts Archive",
      sourceId: `sacred-${seed.topic.toLowerCase().replace(/\W+/g, "-")}`,
      sourceUrl: "https://sacred-texts.com/",
      title: `Sacred Texts collection: ${seed.topic}`,
      author: "Various",
      description: "Public-domain sacred text collection entry for manual/legal review and catalog expansion.",
      language: inferLanguage(seed.language),
      subjects: ["Sacred texts", seed.topic],
      categoryHint: seed.category || "Spiritual",
      htmlUrl: "https://sacred-texts.com/",
      license: "public-domain",
      publicDomain: true,
      copyrightStatus: "Public-domain archive index; individual texts should be reviewed before bulk import"
    }
  ];
}

async function searchDigitalLibraryOfIndia(): Promise<SourceCandidate[]> {
  if (!PIPELINE_CONFIG.enableDliConnector) {
    return [];
  }
  return [];
}

async function searchGitaSupersite(seed: SearchSeed): Promise<SourceCandidate[]> {
  if (!/\b(gita|bhagavad|krishna|spiritual|hindu)\b/i.test(seed.topic)) {
    return [];
  }
  return [
    {
      source: "Gita Supersite",
      sourceId: "bhagavad-gita-supersite",
      sourceUrl: "https://www.gitasupersite.iitk.ac.in/",
      title: "Bhagavad Gita",
      author: "Vyasa",
      description: "Bhagavad Gita text and commentaries from the IIT Kanpur Gita Supersite.",
      language: "sanskrit",
      subjects: ["Bhagavad Gita", "Hinduism", "Spiritual wisdom"],
      categoryHint: "Hinduism",
      htmlUrl: "https://www.gitasupersite.iitk.ac.in/",
      license: "open-access",
      publicDomain: true,
      copyrightStatus: "Open educational spiritual text source; verify commentary licenses before import"
    }
  ];
}

async function searchOpenStax(seed: SearchSeed): Promise<SourceCandidate[]> {
  if (!/\b(science|math|physics|chemistry|biology|education|college|statistics|algebra)\b/i.test(seed.topic)) {
    return [];
  }
  const title = seed.topic.includes("math") ? "OpenStax Mathematics" : "OpenStax Science";
  return [
    {
      source: "OpenStax",
      sourceId: `openstax-${seed.topic.toLowerCase().replace(/\W+/g, "-")}`,
      sourceUrl: "https://openstax.org/subjects",
      title,
      author: "OpenStax",
      description: "OpenStax provides peer-reviewed open textbooks under Creative Commons licenses.",
      language: "english",
      subjects: ["Open textbook", seed.topic],
      categoryHint: seed.category || "Education",
      htmlUrl: "https://openstax.org/subjects",
      license: "cc-by",
      publicDomain: false,
      copyrightStatus: "Creative Commons Attribution open textbook"
    }
  ];
}

interface DoabResult {
  id?: string;
  title?: string;
  authors?: string[];
  language?: string;
  abstract?: string;
  subjects?: string[];
  license?: string;
  url?: string;
}

async function searchDoab(seed: SearchSeed): Promise<SourceCandidate[]> {
  const params = new URLSearchParams({
    query: seed.topic,
    page: "0",
    size: String(Math.max(PIPELINE_CONFIG.booksPerSource, 5))
  });
  const data = await fetchJson<DoabResult[] | { results?: DoabResult[] }>(
    `https://directory.doabooks.org/rest/search?${params.toString()}`
  );
  const results = Array.isArray(data) ? data : data.results || [];
  return results.map((item, index) => ({
    source: "DOAB",
    sourceId: item.id || `doab-${seed.topic}-${index}`,
    sourceUrl: item.url || "https://directory.doabooks.org/",
    title: item.title || `DOAB open-access book: ${seed.topic}`,
    author: item.authors?.join(", "),
    description: item.abstract || "",
    language: item.language,
    subjects: item.subjects || [seed.topic],
    categoryHint: seed.category || seed.topic,
    htmlUrl: item.url,
    license: item.license?.toLowerCase().includes("cc-by-sa") ? "cc-by-sa" : "open-access",
    publicDomain: false,
    copyrightStatus: item.license || "DOAB open-access book"
  }));
}

export const sourceConnectors: SourceConnector[] = [
  { name: "Project Gutenberg", search: searchGutenberg },
  { name: "Internet Archive", search: searchInternetArchive },
  { name: "Open Library", search: searchOpenLibrary },
  { name: "Wikisource", search: searchWikisource },
  { name: "Sacred Texts Archive", search: searchSacredTexts },
  { name: "Digital Library of India", search: searchDigitalLibraryOfIndia },
  { name: "Gita Supersite", search: searchGitaSupersite },
  { name: "OpenStax", search: searchOpenStax },
  { name: "DOAB", search: searchDoab }
];
