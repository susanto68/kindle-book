import type { LibraryCategory, SupportedLanguage } from "./types.js";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  "english",
  "hindi",
  "bengali",
  "sanskrit",
  "tamil",
  "urdu",
  "marathi"
];

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  "Spiritual",
  "Hinduism",
  "Buddhism",
  "Jainism",
  "Philosophy",
  "Indian History",
  "Sanskrit Literature",
  "Bengali Literature",
  "Hindi Literature",
  "Science",
  "Mathematics",
  "AI & Technology",
  "Ayurveda",
  "Yoga",
  "Meditation",
  "Education",
  "Literature",
  "Ancient Civilizations",
  "World History",
  "Culture",
  "Health & Wellness"
];

export const DEFAULT_TOPICS = [
  "bhagavad gita",
  "yoga",
  "ayurveda",
  "vedas",
  "upanishads",
  "premchand",
  "tagore",
  "science",
  "mathematics",
  "artificial intelligence",
  "computer programming",
  "indian history",
  "buddhism",
  "jainism",
  "sanskrit literature",
  "bengali literature",
  "hindi literature",
  "world history",
  "health",
  "education"
];

function splitList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const envLanguages = splitList(process.env.LIBRARY_LANGUAGES) as SupportedLanguage[];

export const PIPELINE_CONFIG = {
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqFallbackModels: splitList(process.env.GROQ_FALLBACK_MODELS).length
    ? splitList(process.env.GROQ_FALLBACK_MODELS)
    : ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"],
  maxBooksPerRun: Number(process.env.LIBRARY_MAX_BOOKS_PER_RUN || 25),
  booksPerSource: Number(process.env.LIBRARY_BOOKS_PER_SOURCE || 3),
  enableDliConnector: process.env.ENABLE_DLI_CONNECTOR === "true",
  metadataOnly: process.env.LIBRARY_METADATA_ONLY !== "false",
  languages: envLanguages.length ? envLanguages : SUPPORTED_LANGUAGES
};

export function hasFirebaseAdminConfig(): boolean {
  return Boolean(
    PIPELINE_CONFIG.projectId &&
      PIPELINE_CONFIG.clientEmail &&
      PIPELINE_CONFIG.privateKey
  );
}

export function hasFirebaseStorageConfig(): boolean {
  return Boolean(PIPELINE_CONFIG.storageBucket && !PIPELINE_CONFIG.metadataOnly);
}
