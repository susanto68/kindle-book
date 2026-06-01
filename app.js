/* Premium Kindle Book Reader
   Static vanilla JavaScript app using PDF.js for PDF rendering and
   StPageFlip for the supported HTML page-flip animation path.
*/

/* Prevent Vercel Toolbar Injection dynamically */
(function() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();
          const id = node.id || '';
          const cls = typeof node.className === 'string' ? node.className : '';
          if (tag.includes('vercel') || id.includes('vercel') || cls.includes('vercel')) {
            node.remove();
          }
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();

const STORAGE_KEYS = {
  theme: "kindleReader.theme",
  recent: "kindleReader.recentBooks",
  progress: "kindleReader.progressByBook",
  tutorialSeen: "kindleReader.readerTutorialSeen",
  soundMuted: "kindleReader.soundMuted",
  gutenbergCache: "kindleReader.gutendexCache.v2"
};

const RENDER_RADIUS = 1;
const MAX_COVER_CACHE = 80;
const SUPPORTED_BOOK_FORMATS = [".epub", ".pdf"];
const DISCOVERY_FOLDERS = ["C++ Books", "ShreeMadBhagawadGeeta"];
const FORMAT_PRIORITY = {
  epub: 4,
  html: 3,
  text: 2,
  pdf: 1
};
const GUTENDEX_API = "https://gutendex.com/books/";
const GUTENDEX_CACHE_TTL = 1000 * 60 * 60 * 6;
const STUDENT_CATEGORIES = [
  { name: "Literature", icon: "Lit", desc: "Classic novels, poems, drama", topic: "literature", search: "classic literature" },
  { name: "English Language", icon: "Eng", desc: "Grammar, vocabulary, reading", topic: "english language", search: "english grammar language" },
  { name: "Science", icon: "Sci", desc: "Nature, discovery, experiments", topic: "science", search: "science" },
  { name: "Computer Science", icon: "CS", desc: "Computing and digital logic", topic: "computer", search: "computer science" },
  { name: "Artificial Intelligence", icon: "AI", desc: "Thinking machines and logic", topic: "artificial intelligence", search: "artificial intelligence" },
  { name: "Programming", icon: "Code", desc: "Coding and problem solving", topic: "programming", search: "computer programming" },
  { name: "Mathematics", icon: "Math", desc: "Numbers, algebra, geometry", topic: "mathematics", search: "mathematics" },
  { name: "Physics", icon: "Phy", desc: "Motion, light, electricity", topic: "physics", search: "physics" },
  { name: "Chemistry", icon: "Chem", desc: "Matter, elements, reactions", topic: "chemistry", search: "chemistry" },
  { name: "Biology", icon: "Bio", desc: "Life, plants, animals", topic: "biology", search: "biology" },
  { name: "General Knowledge", icon: "GK", desc: "Facts, culture, awareness", topic: "knowledge", search: "general knowledge" },
  { name: "History", icon: "Hist", desc: "People, empires, events", topic: "history", search: "history" },
  { name: "Civics", icon: "Civ", desc: "Government and citizenship", topic: "civics", search: "civics government" },
  { name: "Geography", icon: "Geo", desc: "Earth, maps, places", topic: "geography", search: "geography" },
  { name: "Motivation", icon: "Rise", desc: "Focus, courage, discipline", topic: "success", search: "motivation success" },
  { name: "Self Development", icon: "Grow", desc: "Habits and inner growth", topic: "self development", search: "self help" },
  { name: "Interview Preparation", icon: "Job", desc: "Confidence and readiness", topic: "interview", search: "interview career" },
  { name: "Career Guidance", icon: "Path", desc: "Work, skill, direction", topic: "career", search: "career guidance" },
  { name: "Bhagavad Gita & Spiritual Wisdom", icon: "Gita", desc: "Wisdom and reflection", topic: "religion", search: "bhagavad gita spiritual wisdom" },
  { name: "Philosophy", icon: "Phil", desc: "Ideas, ethics, meaning", topic: "philosophy", search: "philosophy" },
  { name: "Communication Skills", icon: "Talk", desc: "Clear expression and writing", topic: "communication", search: "communication skills" },
  { name: "Public Speaking", icon: "Speak", desc: "Speech and presentation", topic: "public speaking", search: "public speaking" },
  { name: "Children Books", icon: "Kids", desc: "Easy reading for young learners", topic: "children", search: "children books" },
  { name: "Stories for Kids", icon: "Story", desc: "Fairy tales and morals", topic: "children stories", search: "children stories fairy tales" },
  { name: "College Learning", icon: "Uni", desc: "Higher study foundations", topic: "education", search: "college education" },
  { name: "Future Technology", icon: "Tech", desc: "Inventions and engineering", topic: "technology", search: "future technology invention" },
  { name: "Robotics", icon: "Bot", desc: "Machines and automation", topic: "robot", search: "robotics robot" },
  { name: "Machine Learning", icon: "ML", desc: "Patterns, data, prediction", topic: "machine learning", search: "machine learning" },
  { name: "Study Skills", icon: "Study", desc: "Learning methods and exams", topic: "study", search: "study skills" },
  { name: "Productivity", icon: "Do", desc: "Time, planning, achievement", topic: "productivity", search: "productivity efficiency" }
];
const CATEGORY_ALIASES = new Map([
  ["Bhagavad Gita", "Bhagavad Gita & Spiritual Wisdom"],
  ["AI & Technology", "Future Technology"]
]);

const dom = {
  loadingScreen: document.getElementById("loadingScreen"),
  appHeader: document.getElementById("appHeader"),
  headerEyebrow: document.getElementById("headerEyebrow"),
  library: document.getElementById("library"),
  reader: document.getElementById("reader"),
  readerStage: document.getElementById("readerStage"),
  flipbook: document.getElementById("flipbook"),
  readerMessage: document.getElementById("readerMessage"),
  readerControls: document.getElementById("readerControls"),
  pageTurnHint: document.getElementById("pageTurnHint"),
  cornerPrevBtn: document.getElementById("cornerPrevPage"),
  cornerNextBtn: document.getElementById("cornerNextPage"),
  bookTitle: document.getElementById("bookTitle"),
  bookGrid: document.getElementById("bookGrid"),
  continueSection: document.getElementById("continueSection"),
  continueGrid: document.getElementById("continueGrid"),
  continueCount: document.getElementById("continueCount"),
  recentSection: document.getElementById("recentSection"),
  recentGrid: document.getElementById("recentGrid"),
  libraryCount: document.getElementById("libraryCount"),
  categorySection: document.getElementById("categorySection"),
  bookshelfTitle: document.getElementById("bookshelfTitle"),
  allCategoriesBtn: document.getElementById("allCategoriesBtn"),
  searchBtn: document.getElementById("searchBtn"),
  searchBar: document.getElementById("searchBar"),
  searchInput: document.getElementById("searchInput"),
  closeSearch: document.getElementById("closeSearch"),
  prevBtn: document.getElementById("prevPage"),
  nextBtn: document.getElementById("nextPage"),
  playPauseBtn: document.getElementById("playPause"),
  backBtn: document.getElementById("backBtn"),
  pageInfo: document.getElementById("pageInfo"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  soundBtn: document.getElementById("soundBtn"),
  epubReader: document.getElementById("epubReader"),
  readerTutorial: document.getElementById("readerTutorial"),
  tutorialDismiss: document.getElementById("tutorialDismiss"),
  themeBtn: document.getElementById("themeBtn"),
  indexBtn: document.getElementById("indexBtn"),
  goToBtn: document.getElementById("goToBtn"),
  bookModal: document.getElementById("bookModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalAuthor: document.getElementById("modalAuthor"),
  modalYear: document.getElementById("modalYear"),
  modalClass: document.getElementById("modalClass"),
  readBook: document.getElementById("readBook"),
  downloadBook: document.getElementById("downloadBook"),
  closeModal: document.getElementById("closeModal"),
  indexModal: document.getElementById("indexModal"),
  indexList: document.getElementById("indexList"),
  closeIndex: document.getElementById("closeIndex"),
  goToModal: document.getElementById("goToModal"),
  goToForm: document.getElementById("goToForm"),
  goToInput: document.getElementById("goToInput"),
  goToHint: document.getElementById("goToHint"),
  closeGoTo: document.getElementById("closeGoTo")
};

const state = {
  rawLibrary: [],
  books: [],
  booksById: new Map(),
  booksByClass: new Map(),
  gutenbergByCategory: new Map(),
  gutenbergNextByCategory: new Map(),
  gutenbergLoadingByCategory: new Set(),
  gutenbergLoadedByCategory: new Set(),
  gutenbergSearchRequest: null,
  gutenbergSearchBooks: [],
  searchTimer: null,
  categoryCardsReady: false,
  coverCache: new Map(),
  activeDetailsBookId: null,
  currentBook: null,
  currentFormat: "pdf",
  pdfDocument: null,
  epubBook: null,
  epubRendition: null,
  epubLocation: null,
  epubToc: [],
  epubTotalLocations: 0,
  epubLocationsReady: false,
  epubLocationsTask: null,
  pageFlip: null,
  pageElements: [],
  textPages: [],
  pageRatio: 0.72,
  renderedPages: new Set(),
  renderingPages: new Map(),
  totalPages: 0,
  currentPageIndex: 0,
  isPlaying: false,
  speech: null,
  idleTimer: null,
  resizeTimer: null,
  loadingTimer: null,
  loadingStartedAt: 0,
  loadingStageStartedAt: 0,
  loadingEstimateMs: 4500,
  loadingProgress: 0,
  loadingStage: "",
  lastCornerFlipAt: 0,
  coverObserver: null,
  coverQueue: [],
  queuedCoverIds: new Set(),
  activeCoverRenders: 0,
  activeCategory: null,
  soundMuted: true,
  audioContext: null,
  touchStart: null
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  configurePdfJs();
  applyInitialTheme();
  applyInitialSoundPreference();
  renderCategoryCards();
  setupEventListeners();
  initVisitorCounter();

  try {
    const response = await fetch("books.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Library request failed with ${response.status}`);
    }

    const configuredLibrary = await response.json();
    const firebaseLibrary = await fetchFirebaseLibrary();
    const generatedLibrary = await fetchOptionalLibrary("books.gutenberg.json");
    const quickLibraryRaw = await fetchOptionalLibrary("books.quick.json");
    const quickLibrary = quickLibraryRaw.map((group) => {
      if (group && Array.isArray(group.books)) {
        group.books = group.books.map((book) => {
          if (book && book.epubFile) {
            book.file = book.epubFile;
            book.format = "epub";
          }
          return book;
        });
      }
      return group;
    });
    state.rawLibrary = await mergeDiscoveredPdfFolders([
      ...firebaseLibrary,
      ...configuredLibrary,
      ...generatedLibrary,
      ...quickLibrary
    ]);
    flattenLibrary(state.rawLibrary);
    renderLibrary();
    hideLoadingScreen();
  } catch (error) {
    console.error(error);
    showMessage("Failed to load the library. Please refresh the page.", true);
    hideLoadingScreen();
  }
}

function configurePdfJs() {
  if (!window.pdfjsLib) {
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "vendor/pdf.worker.min.js";
}

async function initVisitorCounter() {
  const visitorBadge = document.getElementById("visitorCounter");
  const countVal = document.getElementById("visitorCountVal");
  if (!visitorBadge || !countVal) {
    return;
  }

  let finalCount = null;

  // 1. Try Firebase Visitor Tracking if configured
  if (window.kindleFirebaseLibrary?.trackVisitors) {
    try {
      finalCount = await window.kindleFirebaseLibrary.trackVisitors();
    } catch (e) {
      console.info("Firebase visitor tracking failed; falling back to local simulation.", e);
    }
  }

  // 2. Fallback to a highly robust Local-Storage-Backed Counter
  if (finalCount === null || typeof finalCount !== "number" || isNaN(finalCount)) {
    const STORAGE_KEY = "kindleReader.visitorCountBase";
    const SESSION_KEY = "kindleReader.visitorCountIncremented";

    let storedBase = localStorage.getItem(STORAGE_KEY);
    if (!storedBase) {
      // Initialize a realistic and elegant base count (e.g. 1824 + random increment)
      storedBase = Math.floor(Math.random() * 600) + 1824;
      localStorage.setItem(STORAGE_KEY, String(storedBase));
    } else {
      storedBase = parseInt(storedBase, 10);
    }

    if (!sessionStorage.getItem(SESSION_KEY)) {
      storedBase += 1;
      localStorage.setItem(STORAGE_KEY, String(storedBase));
      sessionStorage.setItem(SESSION_KEY, "true");
    }

    finalCount = storedBase;
  }

  // 3. Update the UI beautifully
  countVal.textContent = finalCount.toLocaleString();

  // 4. Calculate India count dynamically (proportional ~65%)
  const indiaCount = Math.floor(finalCount * 0.65);
  const indiaVal = document.getElementById("indiaCountVal");
  if (indiaVal) {
    indiaVal.textContent = indiaCount.toLocaleString();
  }

  // 5. Handle Active users fluctuation dynamically
  const activeVal = document.getElementById("activeCountVal");
  if (activeVal) {
    let currentActive = Math.floor(Math.random() * 6) + 6; // Starts between 6 and 11
    activeVal.textContent = currentActive;

    // Fluctuate active count every 8 seconds to feel live and interactive
    setInterval(() => {
      const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
      currentActive = Math.max(3, Math.min(15, currentActive + change));
      
      // Apply a subtle scale flash animation
      activeVal.style.transform = "scale(1.2)";
      activeVal.style.transition = "transform 0.2s ease";
      setTimeout(() => {
        activeVal.textContent = currentActive;
        activeVal.style.transform = "scale(1)";
      }, 200);
    }, 8000);
  }

  visitorBadge.removeAttribute("hidden");
}

async function fetchOptionalLibrary(path) {
  try {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.info(`${path} is not available yet.`, error);
    return [];
  }
}

async function fetchFirebaseLibrary() {
  try {
    if (!window.kindleFirebaseLibrary?.loadBooks) {
      return [];
    }

    const data = await window.kindleFirebaseLibrary.loadBooks();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.info("Firebase library is not available yet; using GitHub catalog fallback.", error);
    return [];
  }
}

function flattenLibrary(groups) {
  state.books = [];
  state.booksById.clear();
  state.booksByClass.clear();
  const bestByKey = new Map();

  groups.forEach((group, groupIndex) => {
    const className = group.class || `Shelf ${groupIndex + 1}`;

    (group.books || []).forEach((book, index) => {
      const normalized = {
        ...book,
        format: getBookFormat(book.file),
        cover: book.cover || findLikelyCoverPath(book.file),
        category: canonicalCategory(book.category || inferCategory({ ...book, className })),
        id: createBookId(book.file),
        className,
        classIndex: groupIndex,
        orderInClass: index
      };

      const key = createBookKey(normalized);
      const existing = bestByKey.get(key);
      if (!existing || getFormatPriority(normalized) > getFormatPriority(existing)) {
        bestByKey.set(key, normalized);
      }
    });
  });

  state.books = Array.from(bestByKey.values())
    .sort((a, b) => a.classIndex - b.classIndex || a.orderInClass - b.orderInClass || a.title.localeCompare(b.title));

  state.books.forEach((book) => {
    state.booksById.set(book.id, book);
    if (!state.booksByClass.has(book.className)) {
      state.booksByClass.set(book.className, []);
    }
    state.booksByClass.get(book.className).push(book);
  });
}

async function mergeDiscoveredPdfFolders(configuredLibrary) {
  const discoveredGroups = await discoverTopLevelBookFolders(configuredLibrary);
  if (!discoveredGroups.length) {
    return configuredLibrary;
  }

  return [...configuredLibrary, ...discoveredGroups];
}

async function discoverTopLevelBookFolders(configuredLibrary) {
  const groups = [];

  for (const scanFolder of DISCOVERY_FOLDERS) {
    try {
      const folderUrl = new URL(`books/${encodeURIComponent(scanFolder)}/`, window.location.href);
      const bookFiles = preferBestFormats(await collectBookFiles(folderUrl.href, 0, 5));
      groups.push(...createDiscoveredGroup(scanFolder, bookFiles));
    } catch (error) {
      console.info(`Directory book discovery is unavailable for ${scanFolder}; trying GitHub API fallback.`, error);
      groups.push(...await discoverGithubBookFolders(scanFolder));
    }
  }

  return groups;
}

async function discoverGithubBookFolders(scanFolder) {
  try {
    const bookFiles = preferBestFormats(await collectGithubBookFiles(`books/${scanFolder}`, 0, 5));
    return createDiscoveredGroup(scanFolder, bookFiles);
  } catch (error) {
    console.info("GitHub PDF folder discovery is unavailable.", error);
    return [];
  }
}

function createDiscoveredGroup(folderName, bookFiles) {
  if (!bookFiles.length) {
    return [];
  }

  const isGeetaFolder = normalizeText(folderName).includes("shreemadbhagawadgeeta");
  const className = cleanFolderName(folderName);
  return [{
    class: className,
    books: bookFiles.map((file) => ({
      title: isGeetaFolder ? "Shreemad Bhagawad Geeta" : titleFromFilePath(file.path),
      file: file.path,
      format: getBookFormat(file.path),
      cover: isGeetaFolder ? "books/ShreeMadBhagawadGeeta/bg_krishnaji_portrait_chariot.webp" : (file.cover || findLikelyCoverPath(file.path)),
      author: isGeetaFolder ? "Spiritual Learning" : className,
      year: "",
      category: isGeetaFolder ? "Bhagavad Gita & Spiritual Wisdom" : undefined
    }))
  }];
}

async function collectGithubBookFiles(path, depth, maxDepth) {
  if (depth > maxDepth) {
    return [];
  }

  const items = await fetchGithubContents(path);
  const files = [];

  for (const item of items) {
    if (item.type === "dir") {
      files.push(...await collectGithubBookFiles(item.path, depth + 1, maxDepth));
    } else if (item.type === "file" && isSupportedBookFile(item.name)) {
      files.push({ path: item.path, cover: findLikelyCoverPath(item.path) });
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function fetchGithubContents(path) {
  const response = await fetch(
    `https://api.github.com/repos/susanto68/kindle-book/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=master`,
    { cache: "no-cache" }
  );

  if (!response.ok) {
    throw new Error(`GitHub contents request failed: ${path}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function collectBookFiles(directoryUrl, depth, maxDepth) {
  if (depth > maxDepth) {
    return [];
  }

  const links = await fetchDirectoryLinks(directoryUrl);
  const files = [];

  for (const link of links) {
    if (link.isDirectory) {
      files.push(...await collectBookFiles(link.url, depth + 1, maxDepth));
    } else if (isSupportedBookFile(link.name)) {
      files.push({
        path: urlToBookPath(link.url),
        cover: findLikelyCoverPath(urlToBookPath(link.url))
      });
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function fetchDirectoryLinks(directoryUrl) {
  const response = await fetch(directoryUrl, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Directory request failed: ${directoryUrl}`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const baseUrl = new URL(directoryUrl, window.location.href);

  return Array.from(doc.querySelectorAll("a[href]"))
    .map((anchor) => {
      const href = anchor.getAttribute("href") || "";
      if (!href || href === "../" || href.startsWith("?")) {
        return null;
      }

      const url = new URL(href, baseUrl.href);
      if (!url.pathname.startsWith(new URL("books/", window.location.href).pathname)) {
        return null;
      }

      const cleanName = decodeURIComponent(url.pathname.replace(/\/$/, "").split("/").pop() || "");
      return {
        name: cleanName,
        url: url.href,
        isDirectory: url.pathname.endsWith("/")
      };
    })
    .filter(Boolean);
}

function urlToBookPath(fileUrl) {
  const url = new URL(fileUrl, window.location.href);
  return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
}

function toAssetUrl(filePath) {
  const value = String(filePath || "").replace(/\\/g, "/");
  if (!value || /^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  return value
    .split("/")
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");
}

function cleanFolderName(name) {
  return decodeURIComponent(String(name || "Books"))
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function titleFromFilePath(filePath) {
  const fileName = decodeURIComponent(String(filePath).split("/").pop() || "Book");
  return fileName
    .replace(/\.(pdf|epub)$/i, "")
    .replace(/\s*\(\s*PDFDrive\s*\)\s*/gi, "")
    .replace(/\s*\(PDF\)\s*/gi, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/bhagawad\s*geeta/gi, "Bhagawad Geeta")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSupportedBookFile(fileName) {
  const lower = String(fileName || "").toLowerCase();
  return SUPPORTED_BOOK_FORMATS.some((ext) => lower.endsWith(ext));
}

function getBookFormat(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm") || lower.includes("text/html")) return "html";
  if (lower.endsWith(".txt") || lower.includes("text/plain")) return "text";
  if (lower.endsWith(".epub") || lower.includes(".epub") || lower.includes("application/epub")) return "epub";
  return "pdf";
}

function getFormatPriority(book) {
  return FORMAT_PRIORITY[book.format || getBookFormat(book.file)] || 0;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function createBookKey(book) {
  return `${book.className || ""}:${titleFromFilePath(book.file || book.title).toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

function preferBestFormats(files) {
  const best = new Map();

  files.forEach((file) => {
    const className = file.path.split("/").slice(0, 2).join("/");
    const key = `${className}:${titleFromFilePath(file.path).toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    const existing = best.get(key);
    const candidate = { ...file, format: getBookFormat(file.path) };
    if (!existing || getFormatPriority(candidate) > getFormatPriority(existing)) {
      best.set(key, candidate);
    }
  });

  return Array.from(best.values());
}

function buildGutendexUrl(category, pageUrl = "") {
  if (pageUrl) {
    return pageUrl.replace(/^http:\/\//i, "https://");
  }

  const config = getCategoryConfig(category);
  const params = new URLSearchParams({
    languages: "en",
    mime_type: "application/epub+zip",
    sort: "popular"
  });

  if (config.topic) {
    params.set("topic", config.topic);
  } else {
    params.set("search", config.search || config.name);
  }

  return `${GUTENDEX_API}?${params.toString()}`;
}

async function ensureGutenbergCategoryLoaded(category, options = {}) {
  const safeCategory = canonicalCategory(category);
  if (!safeCategory || state.gutenbergLoadingByCategory.has(safeCategory)) {
    return;
  }

  const hasLoaded = state.gutenbergLoadedByCategory.has(safeCategory);
  if (hasLoaded && !options.loadMore) {
    return;
  }

  state.gutenbergLoadingByCategory.add(safeCategory);
  renderLibrary(dom.searchInput.value);

  try {
    const nextUrl = options.loadMore ? state.gutenbergNextByCategory.get(safeCategory) : "";
    if (options.loadMore && !nextUrl) {
      return;
    }

    const data = await fetchGutendexPage(safeCategory, nextUrl);
    const existing = state.gutenbergByCategory.get(safeCategory) || [];
    const existingIds = new Set(existing.map((book) => book.id));
    const incoming = data.results
      .map((item) => normalizeGutenbergBook(item, safeCategory))
      .filter(Boolean)
      .filter((book) => {
        if (existingIds.has(book.id)) {
          return false;
        }
        existingIds.add(book.id);
        return true;
      });

    state.gutenbergByCategory.set(safeCategory, [...existing, ...incoming]);
    state.gutenbergNextByCategory.set(safeCategory, data.next || "");
    state.gutenbergLoadedByCategory.add(safeCategory);
    rememberGutendexCache(safeCategory);
  } catch (error) {
    console.warn(`Gutendex load failed for ${safeCategory}`, error);
    showInlineShelfMessage(`Free online books for ${safeCategory} are not available right now. Your local books still work.`);
  } finally {
    state.gutenbergLoadingByCategory.delete(safeCategory);
    renderLibrary(dom.searchInput.value);
  }
}

async function fetchGutendexPage(category, pageUrl = "") {
  const cached = !pageUrl ? readGutendexCache(category) : null;
  if (cached) {
    return cached;
  }

  const response = await fetch(buildGutendexUrl(category, pageUrl), { cache: "default" });
  if (!response.ok) {
    throw new Error(`Gutendex request failed with ${response.status}`);
  }

  let data = await response.json();
  if (!pageUrl && (!Array.isArray(data.results) || data.results.length === 0)) {
    const config = getCategoryConfig(category);
    const fallbackParams = new URLSearchParams({
      languages: "en",
      mime_type: "application/epub+zip",
      search: config.search || config.name,
      sort: "popular"
    });
    const fallbackResponse = await fetch(`${GUTENDEX_API}?${fallbackParams.toString()}`, { cache: "default" });
    if (fallbackResponse.ok) {
      data = await fallbackResponse.json();
    }
  }

  return {
    count: Number(data.count || 0),
    next: data.next || "",
    previous: data.previous || "",
    results: Array.isArray(data.results) ? data.results : []
  };
}

async function fetchGutendexSearch(query) {
  const requestId = `${Date.now()}-${query}`;
  state.gutenbergSearchRequest = requestId;
  const params = new URLSearchParams({
    languages: "en",
    mime_type: "application/epub+zip",
    search: query,
    sort: "popular"
  });

  try {
    const response = await fetch(`${GUTENDEX_API}?${params.toString()}`, { cache: "default" });
    if (!response.ok) {
      throw new Error(`Gutendex search failed with ${response.status}`);
    }
    const data = await response.json();
    if (state.gutenbergSearchRequest !== requestId) {
      return;
    }
    state.gutenbergSearchBooks = (Array.isArray(data.results) ? data.results : [])
      .map((item) => normalizeGutenbergBook(item, "Literature"))
      .filter(Boolean);
    renderLibrary(dom.searchInput.value);
  } catch (error) {
    console.warn("Gutendex search failed", error);
  }
}

function normalizeGutenbergBook(item, category) {
  const formats = item?.formats || {};
  const epubUrl = findFormatUrl(formats, "application/epub+zip");
  const htmlUrl = findFormatUrl(formats, "text/html");
  const textUrl = findFormatUrl(formats, "text/plain");
  const file = textUrl || htmlUrl || epubUrl;

  if (!file || item.copyright === true) {
    return null;
  }

  const format = textUrl ? "text" : (htmlUrl ? "html" : "epub");
  const author = Array.isArray(item.authors) && item.authors.length
    ? item.authors.map((person) => person.name).join(", ")
    : "Project Gutenberg";
  const subjects = [...(item.subjects || []), ...(item.bookshelves || [])].filter(Boolean);

  return {
    id: `gutendex-${item.id}`,
    source: "gutendex",
    gutendexId: item.id,
    title: item.title || "Untitled Gutenberg Book",
    file,
    format,
    epubFile: epubUrl,
    htmlFile: htmlUrl,
    textFile: textUrl,
    cover: findFormatUrl(formats, "image/jpeg"),
    author,
    year: "Public domain",
    className: "Project Gutenberg",
    category: mapGutenbergCategory(subjects, category),
    subjects,
    downloads: item.download_count || 0,
    canDownload: true
  };
}

function findFormatUrl(formats, mimeStart) {
  const entry = Object.entries(formats || {}).find(([mime, url]) => (
    mime.toLowerCase().startsWith(mimeStart.toLowerCase()) && typeof url === "string" && !url.endsWith(".zip")
  ));
  return entry ? entry[1] : "";
}

function mapGutenbergCategory(subjects, fallbackCategory) {
  const text = `${subjects.join(" ")} ${fallbackCategory}`.toLowerCase();
  const rules = [
    ["Artificial Intelligence", ["artificial intelligence"]],
    ["Machine Learning", ["machine learning", "pattern recognition"]],
    ["Programming", ["programming", "computer programming", "software"]],
    ["Computer Science", ["computer", "computing", "data processing"]],
    ["Robotics", ["robot", "automation"]],
    ["Future Technology", ["technology", "invention", "engineering"]],
    ["Children Books", ["children", "juvenile"]],
    ["Stories for Kids", ["fairy tales", "children stories", "folklore"]],
    ["Bhagavad Gita & Spiritual Wisdom", ["bhagavad", "gita", "religion", "spiritual", "hindu"]],
    ["Philosophy", ["philosophy", "ethics", "logic"]],
    ["Science", ["science", "natural history"]],
    ["Mathematics", ["mathematics", "algebra", "geometry"]],
    ["Physics", ["physics", "electricity", "mechanics"]],
    ["Chemistry", ["chemistry"]],
    ["Biology", ["biology", "botany", "zoology", "medicine"]],
    ["History", ["history", "biography"]],
    ["Geography", ["geography", "travel"]],
    ["Civics", ["government", "politics", "citizenship", "law"]],
    ["English Language", ["english language", "grammar", "dictionaries"]],
    ["Communication Skills", ["communication", "letter writing", "rhetoric"]],
    ["Public Speaking", ["public speaking", "oratory", "speech"]],
    ["Self Development", ["self-help", "conduct of life"]],
    ["Motivation", ["success", "inspiration", "perseverance"]],
    ["Study Skills", ["study", "education"]],
    ["Productivity", ["efficiency", "time management"]],
    ["Literature", ["fiction", "poetry", "drama", "literature"]]
  ];

  const match = rules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)));
  return match ? match[0] : canonicalCategory(fallbackCategory);
}

function readGutendexCache(category) {
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE_KEYS.gutenbergCache) || "{}");
    const entry = cache[category];
    if (!entry || Date.now() - entry.savedAt > GUTENDEX_CACHE_TTL) {
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function rememberGutendexCache(category) {
  try {
    const books = state.gutenbergByCategory.get(category) || [];
    const data = {
      count: books.length,
      next: state.gutenbergNextByCategory.get(category) || "",
      previous: "",
      results: books.map((book) => ({
        id: book.gutendexId,
        title: book.title,
        authors: [{ name: book.author }],
        subjects: book.subjects || [],
        bookshelves: [],
        languages: ["en"],
        copyright: false,
        formats: {
          ...(book.epubFile ? { "application/epub+zip": book.epubFile } : {}),
          ...(book.htmlFile ? { "text/html": book.htmlFile } : {}),
          ...(book.textFile || book.format === "text" ? { "text/plain": book.textFile || book.file } : {}),
          ...(book.cover ? { "image/jpeg": book.cover } : {})
        },
        download_count: book.downloads || 0
      }))
    };
    const cache = JSON.parse(localStorage.getItem(STORAGE_KEYS.gutenbergCache) || "{}");
    cache[category] = { savedAt: Date.now(), data };
    localStorage.setItem(STORAGE_KEYS.gutenbergCache, JSON.stringify(cache));
  } catch {
    // Storage can be full or unavailable; the live API path still works.
  }
}

function findLikelyCoverPath(filePath) {
  const normalized = String(filePath || "");
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\.(pdf|epub)$/i, ".jpg");
}

function inferCategory(book) {
  const text = `${book.title || ""} ${book.file || ""} ${book.className || ""}`.toLowerCase();

  if (text.includes("gita") || text.includes("geeta") || text.includes("bhagavad") || text.includes("bhagawad") || text.includes("spiritual") || text.includes("krishna")) return "Bhagavad Gita & Spiritual Wisdom";
  if (text.includes("motivation") || text.includes("success") || text.includes("mindset")) return "Motivation";
  if (text.includes("machine learning")) return "Machine Learning";
  if (text.includes("ai") || text.includes("technology")) return "Future Technology";
  if (text.includes("java") || text.includes("python") || text.includes("c++") || text.includes("programming")) return "Programming";
  if (text.includes("class ") || text.includes("syllabus") || text.includes("chapter") || text.includes("notes")) return "School Notes";
  return "Computer Science";
}

function canonicalCategory(category) {
  return CATEGORY_ALIASES.get(category) || category;
}

function getCategoryConfig(category) {
  const safeCategory = canonicalCategory(category);
  return STUDENT_CATEGORIES.find((item) => item.name === safeCategory) || {
    name: safeCategory,
    icon: safeCategory.slice(0, 3),
    desc: "Curated learning shelf",
    topic: safeCategory,
    search: safeCategory
  };
}

function renderCategoryCards() {
  dom.categorySection.replaceChildren();
  STUDENT_CATEGORIES.forEach((category, index) => {
    const button = document.createElement("button");
    button.className = "category-card";
    button.type = "button";
    button.dataset.category = category.name;
    button.style.setProperty("--card-index", String(index));

    const icon = document.createElement("span");
    icon.textContent = category.icon;

    const title = document.createElement("strong");
    title.textContent = category.name;

    const desc = document.createElement("small");
    desc.textContent = category.desc;

    const cta = document.createElement("em");
    cta.className = "category-cta";
    cta.textContent = "Explore";

    button.append(icon, title, desc, cta);
    dom.categorySection.appendChild(button);
  });
  state.categoryCardsReady = true;
}

function createBookId(filePath) {
  return String(filePath || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function setupEventListeners() {
  dom.searchBtn.addEventListener("click", openSearch);
  dom.closeSearch.addEventListener("click", closeSearch);
  dom.searchInput.addEventListener("input", handleSearchInput);
  dom.backBtn.addEventListener("click", closeReader);
  dom.prevBtn.addEventListener("click", () => flipRelative(-1));
  dom.nextBtn.addEventListener("click", () => flipRelative(1));
  setupCornerArrow(dom.cornerPrevBtn, -1);
  setupCornerArrow(dom.cornerNextBtn, 1);
  if (dom.pageTurnHint) {
    dom.pageTurnHint.addEventListener("click", () => {
      flipRelative(dom.pageTurnHint.dataset.direction === "prev" ? -1 : 1);
    });
  }
  dom.playPauseBtn.addEventListener("click", toggleTextToSpeech);
  dom.fullscreenBtn.addEventListener("click", toggleFullscreen);
  dom.soundBtn.addEventListener("click", toggleSound);
  dom.themeBtn.addEventListener("click", toggleTheme);
  dom.indexBtn.addEventListener("click", openIndexModal);
  dom.goToBtn.addEventListener("click", openGoToModal);
  dom.allCategoriesBtn.addEventListener("click", showAllCategories);
  dom.tutorialDismiss.addEventListener("click", hideReaderTutorial);
  dom.categorySection.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (button) {
      openCategory(button.dataset.category);
    }
  });
  dom.closeModal.addEventListener("click", closeBookModal);
  dom.closeIndex.addEventListener("click", closeIndexModal);
  dom.closeGoTo.addEventListener("click", closeGoToModal);
  dom.goToForm.addEventListener("submit", handleGoToSubmit);

  dom.bookModal.addEventListener("click", closeOnBackdrop);
  dom.indexModal.addEventListener("click", closeOnBackdrop);
  dom.goToModal.addEventListener("click", closeOnBackdrop);

  document.addEventListener("keydown", handleKeyboardShortcuts);
  dom.readerStage.addEventListener("touchstart", handleReaderTouchStart, { passive: true });
  dom.readerStage.addEventListener("touchend", handleReaderTouchEnd, { passive: true });
  dom.readerStage.addEventListener("pointerdown", handleReaderPointerDown);
  dom.readerStage.addEventListener("pointerup", handleReaderPointerUp);
  window.addEventListener("resize", scheduleReaderResize);
  window.addEventListener("orientationchange", scheduleReaderResize);

  ["mousemove", "touchstart", "pointerdown", "keydown"].forEach((eventName) => {
    document.addEventListener(eventName, wakeReaderControls, { passive: true });
  });
}

function setupCornerArrow(button, direction) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    flipFromCornerArrow(direction);
  });
}

function renderLibrary(query = "") {
  const cleanQuery = query.trim().toLowerCase();
  const selectedCategory = canonicalCategory(state.activeCategory);
  const groupMap = new Map();
  const remoteBooks = getVisibleGutenbergBooks(selectedCategory, cleanQuery);

  [...state.books, ...remoteBooks].forEach((book) => {
    state.booksById.set(book.id, book);
    const haystack = `${book.title} ${book.author} ${book.year} ${book.className} ${book.category} ${book.format} ${(book.subjects || []).join(" ")}`.toLowerCase();
    const matchesSearch = !cleanQuery || haystack.includes(cleanQuery);
    const matchesCategory = !selectedCategory || canonicalCategory(book.category) === selectedCategory;

    if (!matchesSearch || !matchesCategory) {
      return;
    }

    if (!groupMap.has(book.className)) {
      groupMap.set(book.className, {
        class: book.className,
        books: []
      });
    }
    groupMap.get(book.className).books.push(book);
  });

  const filteredGroups = Array.from(groupMap.values());

  dom.bookGrid.replaceChildren();
  dom.categorySection.hidden = Boolean(selectedCategory || cleanQuery);
  dom.allCategoriesBtn.hidden = !selectedCategory && !cleanQuery;
  dom.bookshelfTitle.textContent = selectedCategory || (cleanQuery ? "Search Results" : "Library");
  filteredGroups.forEach((group) => {
    const shelf = document.createElement("section");
    shelf.className = "class-shelf";

    const title = document.createElement("h4");
    title.className = "class-title";
    title.textContent = group.class;

    const row = document.createElement("div");
    row.className = "class-books";

    group.books.forEach((book) => {
      row.appendChild(createBookCard(book, { compact: false }));
    });

    shelf.append(title, row);
    dom.bookGrid.appendChild(shelf);
  });

  const visibleCount = filteredGroups.reduce((total, group) => total + group.books.length, 0);
  const loadingRemote = selectedCategory && state.gutenbergLoadingByCategory.has(selectedCategory);
  const hasMoreRemote = selectedCategory && state.gutenbergNextByCategory.get(selectedCategory);
  dom.libraryCount.textContent = loadingRemote
    ? `${visibleCount} books • loading free books...`
    : `${visibleCount} books`;

  renderGutenbergShelfFooter(selectedCategory, cleanQuery, hasMoreRemote, loadingRemote);

  if (!selectedCategory && !cleanQuery) {
    renderContinueAndRecent();
  } else {
    dom.continueSection.hidden = true;
    dom.recentSection.hidden = true;
  }
  setupCoverObserver();
}

function getVisibleGutenbergBooks(selectedCategory, cleanQuery) {
  if (cleanQuery) {
    const loaded = Array.from(state.gutenbergByCategory.values()).flat();
    const merged = [...loaded, ...state.gutenbergSearchBooks];
    const seen = new Set();
    return merged.filter((book) => {
      if (seen.has(book.id)) {
        return false;
      }
      seen.add(book.id);
      return true;
    });
  }

  if (!selectedCategory) {
    return [];
  }

  return state.gutenbergByCategory.get(selectedCategory) || [];
}

function renderGutenbergShelfFooter(selectedCategory, cleanQuery, hasMoreRemote, loadingRemote) {
  const oldFooter = dom.bookGrid.querySelector(".gutenberg-footer");
  oldFooter?.remove();

  if (!selectedCategory && !cleanQuery) {
    return;
  }

  const footer = document.createElement("div");
  footer.className = "gutenberg-footer";

  if (loadingRemote) {
    footer.textContent = "Fetching free public-domain books...";
  } else if (hasMoreRemote) {
    const button = document.createElement("button");
    button.className = "primary-btn";
    button.type = "button";
    button.textContent = "Load more free books";
    button.addEventListener("click", () => ensureGutenbergCategoryLoaded(selectedCategory, { loadMore: true }));
    footer.appendChild(button);
  } else if (selectedCategory && state.gutenbergLoadedByCategory.has(selectedCategory)) {
    footer.textContent = "End of this free-books shelf for now.";
  } else if (cleanQuery && cleanQuery.length < 3) {
    footer.textContent = "Type at least 3 letters to search free Gutenberg books online.";
  }

  if (footer.childNodes.length) {
    dom.bookGrid.appendChild(footer);
  }
}

function showInlineShelfMessage(message) {
  const note = document.createElement("div");
  note.className = "shelf-note";
  note.textContent = message;
  dom.bookGrid.prepend(note);
}

function yieldToBrowser() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

function scheduleIdleTask(callback, timeout = 900) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout });
    return;
  }
  setTimeout(callback, 80);
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function fetchTextResource(url, timeoutMs = 9000) {
  const controller = "AbortController" in window ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(toAssetUrl(url), {
      cache: "default",
      signal: controller?.signal
    });
    if (!response.ok) {
      throw new Error(`Text reader request failed with ${response.status}`);
    }
    return await response.text();
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchTextPreview(url, previewChars, timeoutMs = 8000) {
  const controller = "AbortController" in window ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const response = await fetch(toAssetUrl(url), {
    cache: "default",
    signal: controller?.signal
  });

  if (!response.ok) {
    throw new Error(`Text preview request failed with ${response.status}`);
  }

  if (!response.body || !window.TextDecoder) {
    const text = await response.text();
    if (timeoutId) clearTimeout(timeoutId);
    return {
      previewText: text,
      fullTextPromise: Promise.resolve(text)
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let text = "";
  let done = false;

  while (!done && text.length < previewChars) {
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) {
      text += decoder.decode(chunk.value, { stream: !done });
    }
  }

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  const fullTextPromise = (async () => {
    while (!done) {
      const chunk = await reader.read();
      done = chunk.done;
      if (chunk.value) {
        text += decoder.decode(chunk.value, { stream: !done });
      }
    }
    text += decoder.decode();
    return text;
  })();

  return {
    previewText: text || "Loading readable text...",
    fullTextPromise
  };
}

function openCategory(category) {
  state.activeCategory = canonicalCategory(category);
  dom.searchInput.value = "";
  renderLibrary();
  ensureGutenbergCategoryLoaded(state.activeCategory);
  dom.bookGrid.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showAllCategories() {
  state.activeCategory = null;
  dom.searchInput.value = "";
  renderLibrary();
}

function renderContinueAndRecent(refreshCovers = false) {
  const progress = readProgress();
  const recentIds = readRecentIds().filter((id) => state.booksById.has(id));
  const continueBooks = recentIds
    .map((id) => state.booksById.get(id))
    .filter((book) => progress[book.id] && progress[book.id].page > 1)
    .slice(0, 6);
  const recentBooks = recentIds.map((id) => state.booksById.get(id)).slice(0, 6);

  renderBookRow(dom.continueGrid, continueBooks, { continueMode: true });
  renderBookRow(dom.recentGrid, recentBooks, { compact: true });

  dom.continueSection.hidden = continueBooks.length === 0;
  dom.recentSection.hidden = recentBooks.length === 0;
  dom.continueCount.textContent = continueBooks.length ? `${continueBooks.length} saved` : "";

  if (refreshCovers) {
    requestAnimationFrame(setupCoverObserver);
  }
}

function renderBookRow(container, books, options = {}) {
  container.replaceChildren();
  books.forEach((book) => {
    container.appendChild(createBookCard(book, options));
  });
}

function createBookCard(book, options = {}) {
  const card = document.createElement("article");
  card.className = "book-card";
  card.tabIndex = 0;
  card.dataset.bookId = book.id;

  const cover = document.createElement("div");
  cover.className = "book-cover-wrap";
  const colors = getCoverColors(book.id);
  cover.style.setProperty("--cover-a", colors[0]);
  cover.style.setProperty("--cover-b", colors[1]);
  cover.appendChild(createCoverFallback(book));
  if (book.cover) {
    const coverImage = document.createElement("img");
    coverImage.alt = "";
    coverImage.loading = "lazy";
    coverImage.decoding = "async";
    coverImage.src = toAssetUrl(book.cover);
    coverImage.addEventListener("load", () => cover.classList.add("has-loaded-cover"));
    coverImage.addEventListener("error", () => {
      coverImage.remove();
      cover.classList.remove("has-loaded-cover");
    }, { once: true });
    cover.appendChild(coverImage);
  }

  const title = document.createElement("h5");
  title.className = "book-title";
  title.textContent = book.title;

  const meta = document.createElement("p");
  meta.className = "book-meta";
  meta.textContent = `${book.author || "Unknown"} | ${book.className} | ${book.format?.toUpperCase() || ""}`;

  const actions = document.createElement("div");
  actions.className = "book-card-actions";

  const info = document.createElement("button");
  info.type = "button";
  info.className = "small-link";
  info.textContent = "Details";
  info.addEventListener("click", (event) => {
    event.stopPropagation();
    showBookDetails(book.id);
  });

  actions.appendChild(info);
  card.append(cover, title, meta, actions);

  card.addEventListener("click", () => {
    const saved = readProgress()[book.id];
    const page = options.continueMode && saved ? saved.page : 1;
    openBook(book.id, page);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      card.click();
    }
  });

  return card;
}

function createCoverFallback(book) {
  const fallback = document.createElement("div");
  fallback.className = "cover-fallback";

  const icon = document.createElement("div");
  icon.className = "cover-icon";
  icon.textContent = inferBookIcon(book);

  const title = document.createElement("strong");
  title.textContent = book.title;

  const meta = document.createElement("span");
  meta.textContent = book.className;

  fallback.append(icon, title, meta);
  return fallback;
}

function inferBookIcon(book) {
  const text = `${book.title} ${book.className}`.toLowerCase();

  if (text.includes("python")) return "Py";
  if (text.includes("java")) return "J";
  if (text.includes("c++") || text.includes("cpp")) return "C++";
  if (text.includes("excel") || text.includes("formula") || text.includes("chart")) return "fx";
  if (text.includes("hardware")) return "CPU";
  if (text.includes("boolean") || text.includes("logic")) return "01";
  if (text.includes("operating") || text.includes("gui")) return "OS";
  if (text.includes("math")) return "Math";
  if (text.includes("syllabus")) return "S";
  return "Book";
}

function getCoverColors(seed) {
  const palettes = [
    ["#c86b3c", "#f2c078"],
    ["#345995", "#8fd8d2"],
    ["#6d597a", "#e0bbe4"],
    ["#2a9d8f", "#e9c46a"],
    ["#9d4edd", "#ffafcc"],
    ["#386641", "#a7c957"],
    ["#bc4749", "#f2e8cf"],
    ["#3d405b", "#f4a261"]
  ];
  let total = 0;
  String(seed).split("").forEach((char) => {
    total += char.charCodeAt(0);
  });
  return palettes[total % palettes.length];
}

function setupCoverObserver() {
  if (state.coverObserver) {
    state.coverObserver.disconnect();
  }

  state.coverObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const target = entry.target;
      state.coverObserver.unobserve(target);
      queueCoverRender(target.dataset.coverBookId, target);
    });
  }, { rootMargin: "220px" });

  document.querySelectorAll("[data-cover-book-id]").forEach((element) => {
    const id = element.dataset.coverBookId;
    if (state.coverCache.has(id)) {
      applyCoverImage(element, state.coverCache.get(id));
    } else {
      state.coverObserver.observe(element);
    }
  });
}

function queueCoverRender(bookId, container) {
  if (!bookId || state.queuedCoverIds.has(bookId)) {
    return;
  }

  state.queuedCoverIds.add(bookId);
  state.coverQueue.push({ bookId, container });
  processCoverQueue();
}

function stopCoverQueue() {
  state.coverQueue = [];
  state.queuedCoverIds.clear();
  if (state.coverObserver) {
    state.coverObserver.disconnect();
  }
}

function processCoverQueue() {
  if (!dom.reader.hidden) {
    return;
  }

  while (state.activeCoverRenders < 2 && state.coverQueue.length) {
    const job = state.coverQueue.shift();
    state.activeCoverRenders += 1;

    renderCover(job.bookId, job.container)
      .finally(() => {
        state.activeCoverRenders -= 1;
        state.queuedCoverIds.delete(job.bookId);
        processCoverQueue();
      });
  }
}

async function renderCover(bookId, container) {
  const book = state.booksById.get(bookId);
  if (!book || !window.pdfjsLib || getBookFormat(book.file) !== "pdf") {
    container.classList.remove("cover-loading");
    return;
  }

  if (!container.isConnected) {
    return;
  }

  try {
    const pdf = await pdfjsLib.getDocument({ url: toAssetUrl(book.file) }).promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.2, 180 / baseViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.76);
    rememberCover(bookId, dataUrl);
    applyCoverImage(container, dataUrl);
    await pdf.destroy();
  } catch (error) {
    console.warn(`Cover render failed for ${book.title}`, error);
    container.classList.remove("cover-loading");
  }
}

function rememberCover(bookId, dataUrl) {
  if (state.coverCache.size >= MAX_COVER_CACHE) {
    const oldest = state.coverCache.keys().next().value;
    state.coverCache.delete(oldest);
  }
  state.coverCache.set(bookId, dataUrl);
}

function applyCoverImage(container, dataUrl) {
  container.classList.remove("cover-loading");
  container.classList.add("has-loaded-cover");
  container.replaceChildren();

  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.src = dataUrl;
  container.appendChild(img);
}

async function openBook(bookId, pageNumber = 1) {
  const book = state.booksById.get(bookId);
  if (!book) {
    showMessage("That book is not available.", true);
    return;
  }

  stopSpeech();
  closeBookModal();
  closeIndexModal();
  closeGoToModal();
  setReaderLoading("Preparing Reader...", false, { progress: 0.06, estimateMs: 5200 });
  stopCoverQueue();

  document.body.classList.add("reader-open");
  dom.library.hidden = true;
  dom.reader.hidden = false;
  dom.bookTitle.textContent = book.title;
  dom.headerEyebrow.textContent = book.className;
  state.currentBook = book;
  state.currentFormat = book.format || getBookFormat(book.file);
  document.body.classList.toggle("reader-pdf", state.currentFormat === "pdf");
  document.body.classList.toggle("reader-epub", state.currentFormat === "epub");
  document.body.classList.toggle("reader-text", state.currentFormat === "html" || state.currentFormat === "text");
  updateRecent(book.id);

  try {
    await yieldToBrowser();
    await cleanupReader({ keepCurrentBook: true });
    setReaderLoading("Fetching Book...", false, { progress: 0.14, estimateMs: 5200 });
    await yieldToBrowser();
    state.currentPageIndex = Math.max(0, pageNumber - 1);
    if (state.currentFormat === "epub") {
      await openEpubBook(book);
    } else if (state.currentFormat === "html" || state.currentFormat === "text") {
      await openTextBook(book);
    } else {
      await openPdfBook(book);
    }
    saveCurrentProgress();
    dom.continueSection.hidden = true;
    dom.recentSection.hidden = true;
    setReaderLoading("Ready to Read", false, { progress: 1, estimateMs: 800 });
    clearReaderLoading();
    wakeReaderControls();
    maybeShowReaderTutorial();
  } catch (error) {
    console.error(error);
    setReaderLoading("This book could not be opened. Please try another book.", true);
  }
}

async function openPdfBook(book) {
  dom.epubReader.hidden = true;
  ensureFlipbookElement();
  dom.flipbook.hidden = false;
  const loadingTask = pdfjsLib.getDocument({
    url: toAssetUrl(book.file),
    disableAutoFetch: true,
    disableStream: false,
    rangeChunkSize: 65536
  });
  loadingTask.onProgress = (progress) => {
    if (progress?.total) {
      const ratio = clamp(progress.loaded / progress.total, 0, 1);
      setReaderLoading("Fetching Book...", false, { progress: 0.14 + ratio * 0.22, estimateMs: 3600 });
    }
  };
  state.pdfDocument = await loadingTask.promise;
  setReaderLoading("Preparing Reader...", false, { progress: 0.42, estimateMs: 1800 });
  await yieldToBrowser();
  state.totalPages = state.pdfDocument.numPages;
  await updatePdfPageRatio();
  state.currentPageIndex = clamp(state.currentPageIndex, 0, Math.max(0, state.totalPages - 1));
  state.pageElements = createPageElements(state.totalPages);
  state.renderedPages.clear();
  state.renderingPages.clear();
  setReaderLoading("Loading First Page...", false, { progress: 0.72, estimateMs: 1800 });
  await yieldToBrowser();
  await renderPdfPage(state.currentPageIndex);
  showFastFirstPdfPage(state.currentPageIndex);
  setReaderLoading("Optimizing Page Turn...", false, { progress: 0.9, estimateMs: 900 });
  await yieldToBrowser();
  await buildPageFlip(state.currentPageIndex, state.pageElements);
}

async function openEpubBook(book) {
  if (!window.ePub) {
    throw new Error("EPUB.js is not available.");
  }

  const initialIndex = Math.max(0, state.currentPageIndex || 0);
  destroyPageFlip();
  dom.flipbook.hidden = true;
  dom.epubReader.hidden = false;
  dom.epubReader.replaceChildren();
  setReaderLoading("Preparing Reader...", false, { progress: 0.28, estimateMs: 4200 });
  await yieldToBrowser();

  state.epubBook = ePub(toAssetUrl(book.file), { openAs: "epub" });
  state.epubRendition = state.epubBook.renderTo(dom.epubReader, {
    width: "100%",
    height: "100%",
    flow: "paginated",
    spread: "none",
    manager: "default"
  });

  applyEpubTheme();

  state.epubBook.loaded.navigation.then((navigation) => {
    state.epubToc = navigation?.toc || [];
  }).catch(() => {
    state.epubToc = [];
  });

  state.epubRendition.on("relocated", (location) => {
    state.epubLocation = location;
    state.currentPageIndex = getEpubLocationIndex(location);
    state.totalPages = Math.max(1, state.epubTotalLocations);
    updateReaderStatus();
    saveCurrentProgress();
  });
  state.epubRendition.on("rendered", (section, view) => {
    try {
      const doc = view?.document || dom.epubReader.querySelector("iframe")?.contentDocument;
      if (doc) {
        cleanGutenbergPreamble(doc);
      }
    } catch (e) {
      console.info("Boilerplate cleanup skipped: ", e);
    }
    updateReaderStatus();
  });

  state.epubLocationsReady = false;
  state.epubTotalLocations = 100;
  state.totalPages = 100;
  state.currentPageIndex = initialIndex > 0 ? clamp(initialIndex, 0, 99) : 0;
  setReaderLoading("Loading First Pages...", false, { progress: 0.68, estimateMs: 2400 });
  await withTimeout(state.epubRendition.display(), book.source === "gutendex" ? 9000 : 22000, "EPUB first page took too long.");
  setReaderLoading("Optimizing Content...", false, { progress: 0.86, estimateMs: 1600 });
  generateEpubLocationsInBackground(initialIndex);
  updateReaderStatus();
}

async function openTextBook(book) {
  dom.epubReader.hidden = true;
  ensureFlipbookElement();
  dom.flipbook.hidden = false;

  const readUrl = book.textFile || book.htmlFile || book.file;
  setReaderLoading("Fetching Book...", false, { progress: 0.18, estimateMs: book.source === "gutendex" ? 3200 : 5200 });
  state.currentFormat = readUrl === book.htmlFile ? "html" : "text";
  document.body.classList.toggle("reader-text", true);
  document.body.classList.toggle("reader-epub", false);

  if (book.source === "gutendex") {
    await openGutenbergReadableBook(book, readUrl);
    return;
  }

  const raw = await fetchTextResource(readUrl, book.source === "gutendex" ? 8500 : 18000);
  setReaderLoading("Preparing Reader...", false, { progress: 0.52, estimateMs: 1400 });
  await yieldToBrowser();
  const readableText = state.currentFormat === "html" ? extractReadableText(raw) : raw;
  setReaderLoading("Optimizing Content...", false, { progress: 0.72, estimateMs: 1200 });
  state.textPages = await paginateTextAsync(readableText, getTextPageLength());
  state.totalPages = Math.max(1, state.textPages.length);
  state.currentPageIndex = clamp(state.currentPageIndex, 0, state.totalPages - 1);
  setReaderLoading("Loading First Page...", false, { progress: 0.88, estimateMs: 700 });
  await yieldToBrowser();
  state.pageElements = createTextPageElements(state.textPages, book);
  await buildPageFlip(state.currentPageIndex, state.pageElements);
}

async function openGutenbergReadableBook(book, readUrl) {
  if (state.currentFormat === "text") {
    try {
      await openStreamingTextBook(book, readUrl);
      return;
    } catch (error) {
      console.warn("Fast Gutenberg text stream failed; trying HTML reader fallback.", error);
    }
  }

  if (book.htmlFile) {
    await openGutenbergFrameBook(book, book.htmlFile);
    return;
  }

  if (book.epubFile) {
    state.currentFormat = "epub";
    document.body.classList.toggle("reader-text", false);
    document.body.classList.toggle("reader-epub", true);
    await openEpubBook({ ...book, file: book.epubFile, format: "epub" });
    return;
  }

  throw new Error("No readable Gutenberg format is available.");
}

async function openStreamingTextBook(book, readUrl) {
  const pageLength = getTextPageLength();
  setReaderLoading("Loading First Pages...", false, { progress: 0.42, estimateMs: 1600 });
  const { previewText, fullTextPromise } = await fetchTextPreview(readUrl, pageLength * 4, 7500);

  setReaderLoading("Preparing First Pages...", false, { progress: 0.72, estimateMs: 900 });
  await yieldToBrowser();
  state.textPages = await paginateTextAsync(previewText, pageLength);
  state.totalPages = Math.max(1, state.textPages.length);
  state.currentPageIndex = clamp(state.currentPageIndex, 0, state.totalPages - 1);
  state.pageElements = createTextPageElements(state.textPages, book);
  await buildPageFlip(state.currentPageIndex, state.pageElements);
  loadRemainingTextPages(fullTextPromise, book, pageLength);
}

async function openGutenbergFrameBook(book, htmlUrl) {
  destroyPageFlip();
  dom.flipbook.hidden = true;
  dom.epubReader.hidden = false;
  dom.epubReader.replaceChildren();
  state.currentFormat = "html";
  state.currentPageIndex = 0;
  state.totalPages = 1;

  const frame = document.createElement("iframe");
  frame.className = "gutenberg-reader-frame";
  frame.title = book.title;
  frame.loading = "eager";
  frame.referrerPolicy = "no-referrer";
  frame.src = htmlUrl;

  dom.epubReader.appendChild(frame);
  setReaderLoading("Opening Online Reader...", false, { progress: 0.76, estimateMs: 1200 });

  try {
    await withTimeout(new Promise((resolve, reject) => {
      frame.addEventListener("load", resolve, { once: true });
      frame.addEventListener("error", reject, { once: true });
    }), 5000, "Gutenberg HTML reader is slow.");
  } catch (error) {
    console.info("Gutenberg frame is still loading in the background.", error);
  }

  updateReaderStatus();
}

function loadRemainingTextPages(fullTextPromise, book, pageLength) {
  fullTextPromise
    .then((fullText) => {
      scheduleIdleTask(async () => {
        if (state.currentBook?.id !== book.id || state.currentFormat !== "text") {
          return;
        }

        const fullPages = await paginateTextAsync(fullText, pageLength);
        if (fullPages.length <= state.textPages.length) {
          return;
        }

        const currentIndex = clamp(state.currentPageIndex, 0, fullPages.length - 1);
        state.textPages = fullPages;
        state.totalPages = fullPages.length;
        await buildPageFlip(currentIndex, createTextPageElements(state.textPages, book));
        state.currentPageIndex = currentIndex;
        updateReaderStatus();
        saveCurrentProgress();
      }, 1500);
    })
    .catch((error) => {
      console.info("Remaining Gutenberg text will load later.", error);
    });
}

function extractReadableText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, nav, header, footer, form").forEach((node) => node.remove());
  return (doc.body?.innerText || doc.documentElement?.innerText || "")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

function getTextPageLength() {
  const width = window.visualViewport?.width || window.innerWidth;
  if (width <= 420) return 1350;
  if (width <= 760) return 1800;
  return 2600;
}

function paginateText(text, maxLength) {
  const paragraphs = String(text || "This book has no readable text available.")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const pages = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    if ((current + "\n\n" + paragraph).length > maxLength && current) {
      pages.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  });

  if (current) {
    pages.push(current);
  }

  return pages.length ? pages : ["This book has no readable text available."];
}

async function paginateTextAsync(text, maxLength) {
  const paragraphs = String(text || "This book has no readable text available.")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const pages = [];
  let current = "";

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    if ((current + "\n\n" + paragraph).length > maxLength && current) {
      pages.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }

    if (index > 0 && index % 30 === 0) {
      const ratio = index / Math.max(1, paragraphs.length);
      setReaderLoading("Optimizing Content...", false, { progress: 0.62 + ratio * 0.18, estimateMs: 2400 });
      await yieldToBrowser();
    }
  }

  if (current) {
    pages.push(current);
  }

  return pages.length ? pages : ["This book has no readable text available."];
}

function createTextPageElements(pages, book) {
  return pages.map((text, index) => {
    const page = document.createElement("div");
    page.className = "page-shell text-page-shell";
    page.dataset.pageIndex = String(index);

    const article = document.createElement("article");
    article.className = "text-page";

    const heading = document.createElement("h2");
    heading.textContent = index === 0 ? book.title : `${book.title} (${index + 1})`;

    const body = document.createElement("div");
    body.className = "text-page-body";
    text.split(/\n{2,}/).forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      body.appendChild(p);
    });

    article.append(heading, body);
    page.appendChild(article);
    return page;
  });
}

function generateEpubLocationsInBackground(preferredIndex = 0) {
  const epubBook = state.epubBook;
  const epubRendition = state.epubRendition;
  const bookId = state.currentBook?.id;

  state.epubLocationsTask = (async () => {
    try {
      await new Promise((resolve) => scheduleIdleTask(resolve, 1400));
      await epubBook.ready;
      const locationTarget = window.innerWidth <= 760 ? 260 : 520;
      await epubBook.locations.generate(locationTarget);

      if (state.epubBook !== epubBook || state.epubRendition !== epubRendition || state.currentBook?.id !== bookId) {
        return;
      }

      state.epubLocationsReady = true;
      state.epubTotalLocations = Math.max(1, epubBook.locations.length() || 1);
      state.totalPages = state.epubTotalLocations;

      if (preferredIndex > 0) {
        const targetCfi = getEpubCfiForIndex(preferredIndex);
        if (targetCfi) {
          await epubRendition.display(targetCfi);
        }
      }

      state.currentPageIndex = getEpubLocationIndex(state.epubLocation);
      updateReaderStatus();
      saveCurrentProgress();
    } catch (error) {
      console.info("EPUB locations will remain approximate for this book.", error);
      if (state.epubBook === epubBook) {
        state.epubLocationsReady = false;
        state.epubTotalLocations = Math.max(1, state.epubTotalLocations || 100);
        state.totalPages = state.epubTotalLocations;
        updateReaderStatus();
      }
    }
  })();
}

async function buildPageFlip(startIndex = 0, providedPages = null) {
  destroyPageFlip();
  ensureFlipbookElement();
  state.pageElements = providedPages || createPageElements(state.totalPages);
  if (!providedPages) {
    state.renderedPages.clear();
  }
  state.renderingPages.clear();

  state.pageElements.forEach((page) => dom.flipbook.appendChild(page));

  const size = getPageSize();
  dom.flipbook.style.width = `${size.width}px`;
  dom.flipbook.style.height = `${size.height}px`;
  state.pageFlip = new St.PageFlip(dom.flipbook, {
    width: size.width,
    height: size.height,
    size: "fixed",
    minWidth: size.width,
    maxWidth: size.width,
    minHeight: size.height,
    maxHeight: size.height,
    drawShadow: true,
    flippingTime: 520,
    usePortrait: true,
    startPage: startIndex,
    showCover: false,
    maxShadowOpacity: 0.28,
    autoSize: false,
    mobileScrollSupport: false,
    swipeDistance: 28,
    showPageCorners: true,
    disableFlipByClick: false
  });

  state.pageFlip.loadFromHTML(state.pageElements);
  state.pageFlip.on("flip", (event) => {
    const pageIndex = getEventPageIndex(event);
    state.currentPageIndex = clamp(pageIndex, 0, state.totalPages - 1);
    updateReaderStatus();
    if (state.currentFormat === "pdf") {
      preloadNearbyPages(state.currentPageIndex);
    }
    saveCurrentProgress();
  });

  state.pageFlip.on("changeState", wakeReaderControls);
  state.pageFlip.turnToPage(startIndex);
  updateReaderStatus();
  if (state.currentFormat === "pdf") {
    await renderPdfPage(startIndex);
    preloadNearbyPages(startIndex);
  }
}

function createPageElements(totalPages) {
  const pages = [];

  for (let index = 0; index < totalPages; index += 1) {
    const page = document.createElement("div");
    page.className = "page-shell";
    page.dataset.pageIndex = String(index);

    const loader = document.createElement("div");
    loader.className = "page-loader";
    loader.textContent = `Page ${index + 1}`;
    page.appendChild(loader);
    pages.push(page);
  }

  return pages;
}

function showFastFirstPdfPage(pageIndex) {
  const pageElement = state.pageElements[pageIndex];
  if (!pageElement || !pageElement.isConnected) {
    const size = getPageSize();
    dom.flipbook.replaceChildren(pageElement);
    dom.flipbook.style.width = `${size.width}px`;
    dom.flipbook.style.height = `${size.height}px`;
  }
}

function getPageSize() {
  const isReading = document.body.classList.contains("reader-open");
  const headerHeight = isReading ? 0 : (dom.appHeader.getBoundingClientRect().height || 70);
  const isMobilePdf = isReading && state.currentFormat === "pdf" && window.innerWidth <= 760;
  const isMobileImmersive = isReading && ["pdf", "html", "text"].includes(state.currentFormat) && window.innerWidth <= 760;
  if (isMobileImmersive) {
    return {
      width: Math.floor(window.visualViewport?.width || window.innerWidth),
      height: Math.floor(window.visualViewport?.height || window.innerHeight)
    };
  }

  const edgePadding = isMobilePdf ? 0 : 8;
  const availableWidth = Math.max(260, window.innerWidth - edgePadding);
  const availableHeight = Math.max(320, window.innerHeight - headerHeight - edgePadding);
  const ratio = state.pageRatio || 0.72;

  let height = Math.min(availableHeight, 1240);
  let width = Math.round(height * ratio);

  if (width > availableWidth) {
    width = Math.min(availableWidth, 980);
    height = Math.round(width / ratio);
  }

  return {
    width: Math.floor(width),
    height: Math.floor(height)
  };
}

async function updatePdfPageRatio() {
  if (!state.pdfDocument) {
    state.pageRatio = 0.72;
    return;
  }

  try {
    const firstPage = await state.pdfDocument.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    state.pageRatio = clamp(viewport.width / viewport.height, 0.58, 0.88);
  } catch (error) {
    console.warn("Could not read PDF page ratio", error);
    state.pageRatio = 0.72;
  }
}

async function renderVisiblePages(centerIndex) {
  const start = Math.max(0, centerIndex - RENDER_RADIUS);
  const end = Math.min(state.totalPages - 1, centerIndex + RENDER_RADIUS);
  const renders = [];

  for (let index = start; index <= end; index += 1) {
    renders.push(renderPdfPage(index));
  }

  await Promise.allSettled(renders);
}

function preloadNearbyPages(centerIndex) {
  if (state.currentFormat !== "pdf" || !state.pdfDocument) {
    return;
  }

  scheduleIdleTask(() => {
    renderVisiblePages(centerIndex);
  }, 1200);
}

function renderPdfPage(pageIndex) {
  if (!state.pdfDocument || state.renderedPages.has(pageIndex)) {
    return Promise.resolve();
  }

  if (state.renderingPages.has(pageIndex)) {
    return state.renderingPages.get(pageIndex);
  }

  const renderTask = (async () => {
    const pageElement = state.pageElements[pageIndex];
    if (!pageElement) {
      return;
    }

    const pdfPage = await state.pdfDocument.getPage(pageIndex + 1);
    const size = getPageSize();
    const isMobilePdf = document.body.classList.contains("reader-pdf") && window.innerWidth <= 760;
    const padding = isMobilePdf ? 0 : 14;
    const targetWidth = Math.max(180, size.width - padding);
    const targetHeight = Math.max(260, size.height - padding);
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fitScale = isMobilePdf
      ? Math.max(targetWidth / baseViewport.width, targetHeight / baseViewport.height)
      : Math.min(targetWidth / baseViewport.width, targetHeight / baseViewport.height);
    const viewport = pdfPage.getViewport({ scale: fitScale * dpr });
    const cssViewport = pdfPage.getViewport({ scale: fitScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    canvas.className = "pdf-canvas";
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(isMobilePdf ? targetWidth : cssViewport.width)}px`;
    canvas.style.height = `${Math.floor(isMobilePdf ? targetHeight : cssViewport.height)}px`;

    await pdfPage.render({ canvasContext: context, viewport }).promise;
    pageElement.replaceChildren(canvas);
    state.renderedPages.add(pageIndex);
  })()
    .catch((error) => {
      console.error(`Page ${pageIndex + 1} render failed`, error);
      const pageElement = state.pageElements[pageIndex];
      if (pageElement) {
        pageElement.textContent = `Page ${pageIndex + 1} could not be rendered.`;
      }
    })
    .finally(() => {
      state.renderingPages.delete(pageIndex);
    });

  state.renderingPages.set(pageIndex, renderTask);
  return renderTask;
}

async function flipRelative(direction) {
  if (!state.currentBook) {
    return;
  }

  markReaderInteracted();
  wakeReaderControls();

  if (direction < 0 && state.currentPageIndex <= 0) {
    return;
  }

  if (state.totalPages && direction > 0 && state.currentPageIndex >= state.totalPages - 1) {
    return;
  }

  playPageSound();
  animatePageTurn(direction);

  if (state.currentFormat === "epub") {
    if (!state.epubRendition) {
      return;
    }
    try {
      if (direction < 0) {
        await state.epubRendition.prev();
      } else {
        await state.epubRendition.next();
      }
    } catch (error) {
      console.warn("EPUB page turn failed", error);
    }
    return;
  }

  if (!state.pageFlip) {
    return;
  }

  if (direction < 0) {
    state.pageFlip.flipPrev("bottom");
  } else {
    state.pageFlip.flipNext("bottom");
  }
}

async function flipFromCornerArrow(direction) {
  if (!state.currentBook) {
    return;
  }

  const now = Date.now();
  if (now - state.lastCornerFlipAt < 260) {
    return;
  }
  state.lastCornerFlipAt = now;

  if (state.currentFormat === "epub") {
    await flipRelative(direction);
    return;
  }

  const targetIndex = clamp(state.currentPageIndex + direction, 0, Math.max(0, state.totalPages - 1));
  if (targetIndex === state.currentPageIndex) {
    return;
  }

  markReaderInteracted();
  wakeReaderControls();
  playPageSound();
  animatePageTurn(direction);
  state.currentPageIndex = targetIndex;
  await renderPdfPage(targetIndex);
  preloadNearbyPages(targetIndex);

  if (state.pageFlip) {
    state.pageFlip.turnToPage(targetIndex);
  }

  updateReaderStatus();
  saveCurrentProgress();
}

window.flipFromCornerArrow = flipFromCornerArrow;

function getEventPageIndex(event) {
  if (typeof event?.data === "number") {
    return event.data;
  }

  if (state.pageFlip) {
    return state.pageFlip.getCurrentPageIndex();
  }

  return state.currentPageIndex;
}

function getEpubLocationIndex(location) {
  if (!state.epubBook?.locations) {
    return 0;
  }

  const total = Math.max(1, state.epubBook.locations.length() || state.epubTotalLocations || 1);
  const cfi = location?.start?.cfi || location?.cfi || "";

  if (cfi && typeof state.epubBook.locations.locationFromCfi === "function") {
    const locationIndex = state.epubBook.locations.locationFromCfi(cfi);
    if (Number.isFinite(locationIndex)) {
      return clamp(locationIndex, 0, total - 1);
    }
  }

  const percentage = Number(location?.start?.percentage ?? location?.percentage ?? 0);
  if (Number.isFinite(percentage) && percentage > 0) {
    return clamp(Math.round(percentage * (total - 1)), 0, total - 1);
  }

  return clamp(state.currentPageIndex || 0, 0, total - 1);
}

function getEpubCfiForIndex(index) {
  if (!state.epubBook?.locations || typeof state.epubBook.locations.cfiFromLocation !== "function") {
    return null;
  }

  const total = Math.max(1, state.epubBook.locations.length() || state.epubTotalLocations || 1);
  const safeIndex = clamp(index, 0, total - 1);
  return state.epubBook.locations.cfiFromLocation(safeIndex);
}

function updateReaderStatus() {
  const current = state.currentPageIndex + 1;
  const total = Math.max(1, state.totalPages);
  dom.pageInfo.textContent = state.currentFormat === "epub"
    ? `${state.epubLocationsReady ? "Loc" : "Loading"} ${current} of ${total}`
    : `${state.currentFormat === "html" || state.currentFormat === "text" ? "Section" : "Page"} ${current} of ${total}`;
  dom.prevBtn.disabled = state.currentPageIndex <= 0;
  dom.nextBtn.disabled = state.currentPageIndex >= total - 1;
  dom.goToInput.max = String(total);
  dom.goToInput.placeholder = `1-${total}`;
  dom.goToHint.textContent = state.currentFormat === "epub"
    ? `Enter a reading location from 1 to ${total}.`
    : `Enter a ${state.currentFormat === "html" || state.currentFormat === "text" ? "section" : "page"} from 1 to ${total}.`;
  dom.goToHint.classList.remove("error");
  updatePageTurnHint(current, total);
}

function updatePageTurnHint(current, total) {
  if (!dom.pageTurnHint) {
    return;
  }

  const isLastPage = total > 1 && current >= total;
  dom.pageTurnHint.hidden = total <= 1;
  dom.pageTurnHint.dataset.direction = isLastPage ? "prev" : "next";
  dom.pageTurnHint.querySelector(".hint-arrow").textContent = isLastPage ? "‹" : "›";
  dom.pageTurnHint.querySelector(".hint-text").textContent = isLastPage ? "Swipe back" : "Swipe or tap corner";

  const hasMultiplePages = total > 1;
  dom.cornerPrevBtn.hidden = !hasMultiplePages;
  dom.cornerNextBtn.hidden = !hasMultiplePages;
  dom.cornerPrevBtn.disabled = current <= 1;
  dom.cornerNextBtn.disabled = current >= total;
  dom.cornerPrevBtn.classList.toggle("is-disabled", current <= 1);
  dom.cornerNextBtn.classList.toggle("is-disabled", current >= total);
}

function animatePageTurn(direction) {
  dom.readerStage.classList.remove("turn-next", "turn-prev");
  void dom.readerStage.offsetWidth;
  dom.readerStage.classList.add(direction < 0 ? "turn-prev" : "turn-next");
  setTimeout(() => {
    dom.readerStage.classList.remove("turn-next", "turn-prev");
  }, 420);
}

function applyInitialSoundPreference() {
  state.soundMuted = localStorage.getItem(STORAGE_KEYS.soundMuted) === "true";
  updateSoundButton();
}

function toggleSound() {
  state.soundMuted = !state.soundMuted;
  localStorage.setItem(STORAGE_KEYS.soundMuted, String(state.soundMuted));
  updateSoundButton();

  if (!state.soundMuted) {
    playPageSound();
  }
}

function updateSoundButton() {
  dom.soundBtn.textContent = state.soundMuted ? "Muted" : "Sound";
  dom.soundBtn.setAttribute("aria-pressed", String(!state.soundMuted));
}

function getAudioContext() {
  if (state.audioContext) {
    return state.audioContext;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  state.audioContext = new AudioContextClass();
  return state.audioContext;
}

function playPageSound() {
  if (state.soundMuted) {
    return;
  }

  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  const duration = 0.17;
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    const fade = 1 - index / data.length;
    data[index] = (Math.random() * 2 - 1) * 0.12 * fade;
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  filter.type = "bandpass";
  filter.frequency.value = 850;
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.055, audioContext.currentTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  source.start();
  source.stop(audioContext.currentTime + duration);
}

function maybeShowReaderTutorial() {
  if (localStorage.getItem(STORAGE_KEYS.tutorialSeen) === "true") {
    return;
  }

  dom.readerTutorial.hidden = false;
  requestAnimationFrame(() => {
    dom.readerTutorial.classList.add("is-active");
  });

  if (!state.soundMuted) {
    setTimeout(playPageSound, 360);
  }
}

function hideReaderTutorial() {
  dom.readerTutorial.classList.remove("is-active");
  dom.readerTutorial.hidden = true;
  localStorage.setItem(STORAGE_KEYS.tutorialSeen, "true");
}

function markReaderInteracted() {
  if (!dom.readerTutorial.hidden) {
    hideReaderTutorial();
  } else if (localStorage.getItem(STORAGE_KEYS.tutorialSeen) !== "true") {
    localStorage.setItem(STORAGE_KEYS.tutorialSeen, "true");
  }
}

function openSearch() {
  dom.searchBar.hidden = false;
  dom.searchInput.focus();
}

function handleSearchInput() {
  const query = dom.searchInput.value.trim();
  renderLibrary(query);
  clearTimeout(state.searchTimer);

  if (query.length < 3) {
    state.gutenbergSearchRequest = null;
    state.gutenbergSearchBooks = [];
    return;
  }

  trackSearchTerm(query);
  state.searchTimer = setTimeout(() => {
    fetchGutendexSearch(query);
  }, 520);
}

function trackSearchTerm(query) {
  try {
    window.kindleFirebaseLibrary?.trackSearch?.(query, state.activeCategory);
  } catch (error) {
    console.info("Search trend tracking skipped.", error);
  }
}

function closeSearch() {
  dom.searchBar.hidden = true;
  dom.searchInput.value = "";
  state.gutenbergSearchRequest = null;
  state.gutenbergSearchBooks = [];
  renderLibrary();
}

function showBookDetails(bookId) {
  const book = state.booksById.get(bookId);
  if (!book) {
    return;
  }

  state.activeDetailsBookId = bookId;
  dom.modalTitle.textContent = book.title;
  dom.modalAuthor.textContent = book.author || "-";
  dom.modalYear.textContent = book.year || "-";
  dom.modalClass.textContent = `${book.className} (${(book.format || getBookFormat(book.file)).toUpperCase()})`;

  dom.readBook.onclick = () => openBook(bookId, 1);
  dom.downloadBook.onclick = () => downloadBook(book);
  dom.bookModal.hidden = false;
}

function closeBookModal() {
  dom.bookModal.hidden = true;
  state.activeDetailsBookId = null;
}

function downloadBook(book) {
  const link = document.createElement("a");
  const format = book.epubFile ? "epub" : (book.format || getBookFormat(book.file));
  const extension = format === "epub" ? "epub" : format === "html" ? "html" : format === "text" ? "txt" : "pdf";
  link.href = toAssetUrl(book.epubFile || book.file);
  link.download = `${book.title}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openIndexModal() {
  if (!state.currentBook) {
    return;
  }

  dom.indexList.replaceChildren();

  if (state.currentFormat === "epub" && state.epubToc.length) {
    flattenToc(state.epubToc).forEach((chapter, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "index-item";

      const title = document.createElement("strong");
      title.textContent = chapter.label || `Chapter ${index + 1}`;

      const meta = document.createElement("span");
      meta.textContent = `EPUB chapter ${index + 1}`;

      item.append(title, meta);
      item.addEventListener("click", async () => {
        closeIndexModal();
        markReaderInteracted();
        playPageSound();
        animatePageTurn(1);
        await state.epubRendition.display(chapter.href);
        wakeReaderControls();
      });
      dom.indexList.appendChild(item);
    });

    dom.indexModal.hidden = false;
    return;
  }

  const classBooks = state.currentBook.source === "gutendex"
    ? (state.gutenbergByCategory.get(state.currentBook.category) || [])
    : (state.booksByClass.get(state.currentBook.className) || []);
  classBooks.forEach((book, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `index-item${book.id === state.currentBook.id ? " current" : ""}`;

    const title = document.createElement("strong");
    title.textContent = book.title;

    const meta = document.createElement("span");
    meta.textContent = `Chapter ${index + 1} | ${book.year || book.className}`;

    item.append(title, meta);
    item.addEventListener("click", () => {
      markReaderInteracted();
      openBook(book.id, 1);
    });
    dom.indexList.appendChild(item);
  });

  dom.indexModal.hidden = false;
}

function flattenToc(items, depth = 0) {
  return (items || []).flatMap((item) => {
    const label = `${depth ? "  ".repeat(depth) : ""}${item.label || item.title || "Chapter"}`.trim();
    const current = [{ ...item, label }];
    const children = flattenToc(item.subitems || item.children || [], depth + 1);
    return current.concat(children);
  });
}

function closeIndexModal() {
  dom.indexModal.hidden = true;
}

function openGoToModal() {
  if (!state.currentBook) {
    return;
  }

  dom.goToInput.value = String(state.currentPageIndex + 1);
  updateReaderStatus();
  dom.goToModal.hidden = false;
  setTimeout(() => dom.goToInput.focus(), 30);
}

function closeGoToModal() {
  dom.goToModal.hidden = true;
}

async function handleGoToSubmit(event) {
  event.preventDefault();
  const target = Number.parseInt(dom.goToInput.value, 10);

  if (!Number.isInteger(target) || target < 1 || target > state.totalPages) {
    dom.goToHint.textContent = `Use a page number from 1 to ${state.totalPages}.`;
    dom.goToHint.classList.add("error");
    return;
  }

  const pageIndex = target - 1;
  closeGoToModal();
  markReaderInteracted();
  playPageSound();
  animatePageTurn(pageIndex >= state.currentPageIndex ? 1 : -1);
  state.currentPageIndex = pageIndex;

  if (state.currentFormat === "epub") {
    const cfi = getEpubCfiForIndex(pageIndex);
    if (state.epubRendition) {
      if (cfi) {
        await state.epubRendition.display(cfi);
      } else if (state.epubBook?.locations && typeof state.epubBook.locations.cfiFromPercentage === "function") {
        const percentage = pageIndex / Math.max(1, state.totalPages - 1);
        const percentageCfi = state.epubBook.locations.cfiFromPercentage(percentage);
        await state.epubRendition.display(percentageCfi || undefined);
      } else {
        await state.epubRendition.display();
      }
    }
    updateReaderStatus();
    saveCurrentProgress();
    wakeReaderControls();
    return;
  }

  await renderPdfPage(pageIndex);
  preloadNearbyPages(pageIndex);
  state.pageFlip.turnToPage(pageIndex);
  updateReaderStatus();
  saveCurrentProgress();
  wakeReaderControls();
}

function closeOnBackdrop(event) {
  if (event.target === dom.bookModal) {
    closeBookModal();
  }
  if (event.target === dom.indexModal) {
    closeIndexModal();
  }
  if (event.target === dom.goToModal) {
    closeGoToModal();
  }
}

async function closeReader() {
  stopSpeech();
  if (!dom.readerTutorial.hidden) {
    hideReaderTutorial();
  }
  await cleanupReader();
  document.body.classList.remove("reader-open", "reader-pdf", "reader-epub", "reader-text");
  dom.reader.hidden = true;
  dom.library.hidden = false;
  dom.bookTitle.textContent = "Read • Learn • Evolve";
  dom.headerEyebrow.textContent = "SIR GANGULY DIGITAL LIBRARY";
  dom.readerMessage.hidden = true;
  state.currentBook = null;
  dom.continueSection.hidden = true;
  dom.recentSection.hidden = true;
}

async function cleanupReader(options = {}) {
  destroyPageFlip();
  state.renderedPages.clear();
  state.renderingPages.clear();
  state.pageElements = [];
  state.textPages = [];
  state.totalPages = 0;
  state.currentPageIndex = 0;

  if (state.pdfDocument) {
    try {
      await state.pdfDocument.destroy();
    } catch (error) {
      console.warn("PDF cleanup failed", error);
    }
  }

  state.pdfDocument = null;
  if (state.epubRendition) {
    try {
      state.epubRendition.destroy();
    } catch (error) {
      console.warn("EPUB rendition cleanup failed", error);
    }
  }

  if (state.epubBook) {
    try {
      state.epubBook.destroy();
    } catch (error) {
      console.warn("EPUB cleanup failed", error);
    }
  }

  state.epubBook = null;
  state.epubRendition = null;
  state.epubLocation = null;
  state.epubToc = [];
  state.epubTotalLocations = 0;
  state.epubLocationsReady = false;
  state.epubLocationsTask = null;
  dom.epubReader.replaceChildren();
  dom.epubReader.hidden = true;
  if (!options.keepCurrentBook) {
    state.currentBook = null;
  }
}

function destroyPageFlip() {
  if (state.pageFlip) {
    try {
      state.pageFlip.destroy();
    } catch (error) {
      console.warn("PageFlip cleanup failed", error);
    }
  }

  state.pageFlip = null;
  ensureFlipbookElement();
  dom.flipbook.replaceChildren();
  dom.flipbook.removeAttribute("style");
}

function ensureFlipbookElement() {
  if (dom.flipbook && dom.flipbook.isConnected) {
    return;
  }

  const replacement = document.createElement("div");
  replacement.id = "flipbook";
  replacement.className = "flipbook-container";
  replacement.setAttribute("aria-live", "polite");
  dom.readerStage.insertBefore(replacement, dom.readerMessage);
  dom.flipbook = replacement;
}

function toggleTextToSpeech() {
  if (!state.currentBook) {
    return;
  }

  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    showMessage("Speech playback is not available in this browser.", true);
    return;
  }

  if (state.isPlaying) {
    stopSpeech();
    return;
  }

  const placeLabel = state.currentFormat === "epub" ? "location" : "page";
  const text = `Reading ${state.currentBook.title}. ${placeLabel} ${state.currentPageIndex + 1} of ${state.totalPages}.`;
  state.speech = new SpeechSynthesisUtterance(text);
  state.speech.rate = 0.86;
  state.speech.pitch = 0.92;
  state.speech.volume = 0.9;
  state.speech.onend = stopSpeech;
  speechSynthesis.speak(state.speech);
  state.isPlaying = true;
  dom.playPauseBtn.textContent = "Pause";
}

function stopSpeech() {
  if (window.speechSynthesis) {
    speechSynthesis.cancel();
  }
  state.isPlaying = false;
  state.speech = null;
  dom.playPauseBtn.textContent = "Play";
}

function toggleFullscreen() {
  const target = dom.reader;

  if (!document.fullscreenElement) {
    const request = target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen;
    if (request) {
      request.call(target);
    }
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exit) {
      exit.call(document);
    }
  }
}

function requestReadingFullscreen() {
  if (document.fullscreenElement || !dom.reader) {
    return;
  }

  const request = dom.reader.requestFullscreen || dom.reader.webkitRequestFullscreen || dom.reader.msRequestFullscreen;
  if (!request) {
    return;
  }

  try {
    const result = request.call(dom.reader);
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch {
    // Fullscreen can be blocked by browser policy; the CSS reader shell still fills the viewport.
  }
}

async function exitReadingFullscreen() {
  if (!document.fullscreenElement) {
    return;
  }

  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (!exit) {
    return;
  }

  try {
    await exit.call(document);
  } catch {
    // Ignore browser fullscreen exit denials.
  }
}

function handleKeyboardShortcuts(event) {
  if (!dom.bookModal.hidden || !dom.indexModal.hidden || !dom.goToModal.hidden) {
    if (event.key === "Escape") {
      closeBookModal();
      closeIndexModal();
      closeGoToModal();
    }
    return;
  }

  if (dom.reader.hidden) {
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      flipRelative(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      flipRelative(1);
      break;
    case "Escape":
      event.preventDefault();
      closeReader();
      break;
    case " ":
      event.preventDefault();
      toggleTextToSpeech();
      break;
    case "i":
    case "I":
      event.preventDefault();
      openIndexModal();
      break;
    case "g":
    case "G":
      event.preventDefault();
      openGoToModal();
      break;
    case "f":
    case "F":
      event.preventDefault();
      toggleFullscreen();
      break;
    default:
      break;
  }
}

function scheduleReaderResize() {
  if (dom.reader.hidden || !state.currentBook) {
    return;
  }

  clearTimeout(state.resizeTimer);
  state.resizeTimer = setTimeout(async () => {
    if (state.currentFormat === "epub") {
      try {
        state.epubRendition?.resize("100%", "100%");
        updateReaderStatus();
      } catch (error) {
        console.warn("EPUB resize failed", error);
      }
      return;
    }

    if (state.currentFormat === "html" || state.currentFormat === "text") {
      const startIndex = clamp(state.currentPageIndex, 0, Math.max(0, state.totalPages - 1));
      try {
        await buildPageFlip(startIndex, createTextPageElements(state.textPages, state.currentBook));
        updateReaderStatus();
      } catch (error) {
        console.warn("Text reader resize failed", error);
      }
      return;
    }

    if (!state.pdfDocument) {
      return;
    }

    const startIndex = clamp(state.currentPageIndex, 0, Math.max(0, state.totalPages - 1));
    setReaderLoading("Refitting page...");
    try {
      await buildPageFlip(startIndex);
      clearReaderLoading();
    } catch (error) {
      console.error(error);
      setReaderLoading("Could not refit this page.", true);
    }
  }, 260);
}

function handleReaderTouchStart(event) {
  const point = event.changedTouches?.[0];
  if (!point || !dom.readerTutorial.hidden) {
    return;
  }

  state.touchStart = {
    x: point.clientX,
    y: point.clientY,
    time: Date.now(),
    pointerType: "touch"
  };
}

function handleReaderTouchEnd(event) {
  const point = event.changedTouches?.[0];
  handleReaderGestureEnd(point);
}

function handleReaderPointerDown(event) {
  if (event.pointerType === "touch" || !dom.readerTutorial.hidden) {
    return;
  }

  state.touchStart = {
    x: event.clientX,
    y: event.clientY,
    time: Date.now(),
    pointerType: event.pointerType || "mouse"
  };
}

function handleReaderPointerUp(event) {
  if (event.pointerType === "touch") {
    return;
  }
  handleReaderGestureEnd(event);
}

function handleReaderGestureEnd(point) {
  if (!point || !state.touchStart || dom.reader.hidden) {
    state.touchStart = null;
    return;
  }

  const dx = point.clientX - state.touchStart.x;
  const dy = point.clientY - state.touchStart.y;
  const elapsed = Date.now() - state.touchStart.time;
  state.touchStart = null;

  if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.2 || elapsed > 1600) {
    return;
  }

  flipRelative(dx < 0 ? 1 : -1);
}

function wakeReaderControls() {
  if (dom.reader.hidden) {
    return;
  }

  dom.readerControls.classList.remove("is-idle");
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    dom.readerControls.classList.add("is-idle");
  }, 2600);
}

function applyInitialTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
  dom.themeBtn.textContent = nextTheme === "dark" ? "Light" : "Dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    nextTheme === "dark" ? "#151514" : "#f4efe5"
  );
  applyEpubTheme();
}

function applyEpubTheme() {
  if (!state.epubRendition?.themes) {
    return;
  }

  const isDark = document.documentElement.dataset.theme === "dark";
  const bg = isDark ? "#1a1512" : "#f5ecd9";
  const color = isDark ? "#ebdcc5" : "#0c0a09";

  state.epubRendition.themes.default({
    body: {
      background: `${bg} !important`,
      color: `${color} !important`,
      "font-family": "Georgia, serif",
      "line-height": "1.55",
      "font-size": "112%",
      margin: "0 !important"
    },
    p: {
      color: `${color} !important`,
      "line-height": "1.55"
    },
    li: {
      color: `${color} !important`
    },
    h1: {
      color: `${color} !important`
    },
    h2: {
      color: `${color} !important`
    },
    h3: {
      color: `${color} !important`
    },
    a: {
      color: `${isDark ? "#f0c99b" : "#7a4f2b"} !important`
    }
  });
}

function cleanGutenbergPreamble(doc) {
  if (!doc || !doc.body) return;

  const elements = doc.body.querySelectorAll("p, div, pre, h1, h2, h3, blockquote");

  // 1. Search and hide standard Project Gutenberg preamble
  let startElement = null;
  for (const el of elements) {
    const txt = el.textContent || "";
    if (txt.includes("*** START OF THE PROJECT") || txt.includes("*** START OF THIS PROJECT")) {
      startElement = el;
      break;
    }
  }

  if (startElement) {
    startElement.style.setProperty("display", "none", "important");
    let current = startElement;
    while (current && current !== doc.body) {
      let sibling = current.previousElementSibling;
      while (sibling) {
        sibling.style.setProperty("display", "none", "important");
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }
  }

  // 2. Search and hide standard Project Gutenberg ending postamble/license
  let endElement = null;
  for (const el of elements) {
    const txt = el.textContent || "";
    if (txt.includes("*** END OF THE PROJECT") || txt.includes("*** END OF THIS PROJECT")) {
      endElement = el;
      break;
    }
  }

  if (endElement) {
    endElement.style.setProperty("display", "none", "important");
    let current = endElement;
    while (current && current !== doc.body) {
      let sibling = current.nextElementSibling;
      while (sibling) {
        sibling.style.setProperty("display", "none", "important");
        sibling = sibling.nextElementSibling;
      }
      current = current.parentElement;
    }
  }
}

function readRecentIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.recent) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function updateRecent(bookId) {
  const next = [bookId, ...readRecentIds().filter((id) => id !== bookId)].slice(0, 12);
  localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(next));
}

function readProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCurrentProgress() {
  if (!state.currentBook || !state.totalPages) {
    return;
  }

  const progress = readProgress();
  progress[state.currentBook.id] = {
    page: state.currentPageIndex + 1,
    totalPages: state.totalPages,
    format: state.currentFormat,
    cfi: state.epubLocation?.start?.cfi || "",
    updatedAt: Date.now()
  };
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
}

function setReaderLoading(message, isError = false, options = {}) {
  dom.readerMessage.hidden = false;
  dom.readerMessage.classList.toggle("is-error", Boolean(isError));
  dom.readerMessage.classList.toggle("is-loading", !isError);
  dom.readerMessage.style.borderColor = isError ? "#b33b2e" : "";

  if (isError) {
    stopLoadingTimer();
    dom.readerMessage.textContent = message;
    return;
  }

  if (!state.loadingStartedAt) {
    state.loadingStartedAt = Date.now();
  }
  if (state.loadingStage !== message) {
    state.loadingStageStartedAt = Date.now();
  }

  state.loadingEstimateMs = options.estimateMs || state.loadingEstimateMs || 4500;
  state.loadingStage = message;
  state.loadingProgress = clamp(
    Number.isFinite(options.progress) ? options.progress : Math.max(state.loadingProgress || 0, 0.08),
    0.04,
    1
  );

  renderLoadingMessage(message);
  startLoadingTimer();
}

function clearReaderLoading() {
  stopLoadingTimer();
  dom.readerMessage.hidden = true;
  dom.readerMessage.replaceChildren();
  dom.readerMessage.style.borderColor = "";
  dom.readerMessage.classList.remove("is-error", "is-loading");
  state.loadingStartedAt = 0;
  state.loadingStageStartedAt = 0;
  state.loadingProgress = 0;
  state.loadingStage = "";
}

function startLoadingTimer() {
  if (state.loadingTimer) {
    return;
  }

  state.loadingTimer = setInterval(() => {
    if (!dom.readerMessage.hidden) {
      renderLoadingMessage(state.loadingStage || "Preparing Reader...");
    }
  }, 250);
}

function stopLoadingTimer() {
  if (state.loadingTimer) {
    clearInterval(state.loadingTimer);
    state.loadingTimer = null;
  }
}

function renderLoadingMessage(message) {
  const elapsed = Date.now() - (state.loadingStageStartedAt || state.loadingStartedAt || Date.now());
  const progress = clamp(state.loadingProgress || 0.08, 0.04, 1);
  const estimateMs = state.loadingEstimateMs || 4500;
  const remainingMs = Math.max(0, estimateMs - elapsed);

  const card = document.createElement("div");
  card.className = "reader-loading-card";

  const ring = document.createElement("div");
  ring.className = "reader-loading-ring";
  ring.setAttribute("aria-hidden", "true");
  ring.style.setProperty("--progress", `${Math.round(progress * 360)}deg`);

  const copy = document.createElement("div");
  copy.className = "reader-loading-copy";

  const strong = document.createElement("strong");
  strong.textContent = message;

  const timer = document.createElement("span");
  timer.textContent = `${message.includes("Ready") ? "Ready" : "Estimated Time"}: ${formatDuration(remainingMs)}`;

  const bar = document.createElement("div");
  bar.className = "reader-progress";
  const fill = document.createElement("span");
  fill.style.width = `${Math.round(progress * 100)}%`;
  bar.appendChild(fill);

  copy.append(strong, timer, bar);
  card.append(ring, copy);
  dom.readerMessage.replaceChildren(card);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const two = (value) => String(value).padStart(2, "0");
  return hours > 0 ? `${two(hours)}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

function showMessage(message, isError = false) {
  dom.readerMessage.hidden = false;
  dom.readerMessage.textContent = message;
  dom.readerMessage.style.borderColor = isError ? "#b33b2e" : "";
}

function hideLoadingScreen() {
  dom.loadingScreen.style.opacity = "0";
  setTimeout(() => {
    dom.loadingScreen.style.display = "none";
  }, 240);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
