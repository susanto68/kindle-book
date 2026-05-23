export type SupportedLanguage =
  | "english"
  | "hindi"
  | "bengali"
  | "sanskrit"
  | "tamil"
  | "urdu"
  | "marathi";

export type LibraryCategory =
  | "Spiritual"
  | "Hinduism"
  | "Buddhism"
  | "Jainism"
  | "Philosophy"
  | "Indian History"
  | "Sanskrit Literature"
  | "Bengali Literature"
  | "Hindi Literature"
  | "Science"
  | "Mathematics"
  | "AI & Technology"
  | "Ayurveda"
  | "Yoga"
  | "Meditation"
  | "Education"
  | "Literature"
  | "Ancient Civilizations"
  | "World History"
  | "Culture"
  | "Health & Wellness";

export type BookFormat = "epub" | "pdf" | "html" | "text";
export type LicenseType = "public-domain" | "cc-by" | "cc-by-sa" | "cc0" | "open-access" | "unknown";

export interface SourceCandidate {
  source: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  author?: string;
  description?: string;
  language?: string;
  subjects?: string[];
  tags?: string[];
  categoryHint?: string;
  epubUrl?: string;
  pdfUrl?: string;
  htmlUrl?: string;
  textUrl?: string;
  coverUrl?: string;
  license: LicenseType;
  publicDomain: boolean;
  copyrightStatus: string;
  pages?: number;
}

export interface NormalizedBook {
  id: string;
  title: string;
  author: string;
  language: SupportedLanguage;
  category: LibraryCategory;
  tags: string[];
  description: string;
  cover_url: string;
  epub_url: string;
  pdf_url: string;
  html_url: string;
  text_url: string;
  audio_url: string;
  source: string;
  source_id: string;
  source_url: string;
  public_domain: boolean;
  copyright_status: string;
  pages: number;
  downloads: number;
  views: number;
  rating: number;
  search_keywords: string[];
  ai_summary: string;
  checksum: string;
  title_author_key: string;
  created_at: string;
  updated_at: string;
}

export interface SearchSeed {
  topic: string;
  category?: LibraryCategory;
  language?: SupportedLanguage;
  reason: "default" | "trending" | "manual";
}

export interface PipelineRunContext {
  dryRun: boolean;
  maxBooks: number;
  booksPerSource: number;
  languages: SupportedLanguage[];
  seeds: SearchSeed[];
}

export interface PipelineRunResult {
  source: string;
  fetched: number;
  accepted: number;
  skipped: number;
  uploaded: number;
  errors: string[];
}

export interface SourceConnector {
  name: string;
  search(seed: SearchSeed, context: PipelineRunContext): Promise<SourceCandidate[]>;
}
