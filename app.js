/* Premium Kindle Book Reader
   Static vanilla JavaScript app using PDF.js for PDF rendering and
   StPageFlip for the supported HTML page-flip animation path.
*/

const STORAGE_KEYS = {
  theme: "kindleReader.theme",
  recent: "kindleReader.recentBooks",
  progress: "kindleReader.progressByBook"
};

const RENDER_RADIUS = 2;
const MAX_COVER_CACHE = 80;

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
  bookTitle: document.getElementById("bookTitle"),
  bookGrid: document.getElementById("bookGrid"),
  continueSection: document.getElementById("continueSection"),
  continueGrid: document.getElementById("continueGrid"),
  continueCount: document.getElementById("continueCount"),
  recentSection: document.getElementById("recentSection"),
  recentGrid: document.getElementById("recentGrid"),
  libraryCount: document.getElementById("libraryCount"),
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
  coverCache: new Map(),
  activeDetailsBookId: null,
  currentBook: null,
  pdfDocument: null,
  pageFlip: null,
  pageElements: [],
  pageRatio: 0.72,
  renderedPages: new Set(),
  renderingPages: new Map(),
  totalPages: 0,
  currentPageIndex: 0,
  isPlaying: false,
  speech: null,
  idleTimer: null,
  resizeTimer: null,
  coverObserver: null,
  coverQueue: [],
  queuedCoverIds: new Set(),
  activeCoverRenders: 0
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  configurePdfJs();
  applyInitialTheme();
  setupEventListeners();

  try {
    const response = await fetch("books.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Library request failed with ${response.status}`);
    }

    const configuredLibrary = await response.json();
    state.rawLibrary = await mergeDiscoveredPdfFolders(configuredLibrary);
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

function flattenLibrary(groups) {
  state.books = [];
  state.booksById.clear();
  state.booksByClass.clear();

  groups.forEach((group, groupIndex) => {
    const className = group.class || `Shelf ${groupIndex + 1}`;
    const classBooks = [];

    (group.books || []).forEach((book, index) => {
      const normalized = {
        ...book,
        id: createBookId(book.file),
        className,
        classIndex: groupIndex,
        orderInClass: index
      };

      state.books.push(normalized);
      state.booksById.set(normalized.id, normalized);
      classBooks.push(normalized);
    });

    state.booksByClass.set(className, classBooks);
  });
}

async function mergeDiscoveredPdfFolders(configuredLibrary) {
  const discoveredGroups = await discoverTopLevelPdfFolders(configuredLibrary);
  if (!discoveredGroups.length) {
    return configuredLibrary;
  }

  return [...configuredLibrary, ...discoveredGroups];
}

async function discoverTopLevelPdfFolders(configuredLibrary) {
  const knownTopFolders = new Set();

  configuredLibrary.forEach((group) => {
    (group.books || []).forEach((book) => {
      const parts = String(book.file || "").split("/");
      if (parts[0] === "books" && parts[1]) {
        knownTopFolders.add(parts[1].toLowerCase());
      }
    });
  });

  try {
    const rootUrl = new URL("books/", window.location.href);
    const rootLinks = await fetchDirectoryLinks(rootUrl.href);
    const folders = rootLinks.filter((link) => link.isDirectory && !knownTopFolders.has(link.name.toLowerCase()));
    const groups = [];

    for (const folder of folders) {
      const pdfFiles = await collectPdfFiles(folder.url, 0, 3);
      if (!pdfFiles.length) {
        continue;
      }

      groups.push({
        class: cleanFolderName(folder.name),
        books: pdfFiles.map((file) => ({
          title: titleFromFilePath(file.path),
          file: file.path,
          author: cleanFolderName(folder.name),
          year: ""
        }))
      });
    }

    return groups;
  } catch (error) {
    console.info("Automatic PDF folder discovery is unavailable on this server.", error);
    return [];
  }
}

async function collectPdfFiles(directoryUrl, depth, maxDepth) {
  if (depth > maxDepth) {
    return [];
  }

  const links = await fetchDirectoryLinks(directoryUrl);
  const files = [];

  for (const link of links) {
    if (link.isDirectory) {
      files.push(...await collectPdfFiles(link.url, depth + 1, maxDepth));
    } else if (link.name.toLowerCase().endsWith(".pdf")) {
      files.push({
        path: urlToBookPath(link.url)
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

function cleanFolderName(name) {
  return decodeURIComponent(String(name || "Books"))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function titleFromFilePath(filePath) {
  const fileName = decodeURIComponent(String(filePath).split("/").pop() || "Book");
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/\s*\(\s*PDFDrive\s*\)\s*/gi, "")
    .replace(/\s*\(PDF\)\s*/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  dom.searchInput.addEventListener("input", () => renderLibrary(dom.searchInput.value));
  dom.backBtn.addEventListener("click", closeReader);
  dom.prevBtn.addEventListener("click", () => flipRelative(-1));
  dom.nextBtn.addEventListener("click", () => flipRelative(1));
  dom.playPauseBtn.addEventListener("click", toggleTextToSpeech);
  dom.fullscreenBtn.addEventListener("click", toggleFullscreen);
  dom.themeBtn.addEventListener("click", toggleTheme);
  dom.indexBtn.addEventListener("click", openIndexModal);
  dom.goToBtn.addEventListener("click", openGoToModal);
  dom.closeModal.addEventListener("click", closeBookModal);
  dom.closeIndex.addEventListener("click", closeIndexModal);
  dom.closeGoTo.addEventListener("click", closeGoToModal);
  dom.goToForm.addEventListener("submit", handleGoToSubmit);

  dom.bookModal.addEventListener("click", closeOnBackdrop);
  dom.indexModal.addEventListener("click", closeOnBackdrop);
  dom.goToModal.addEventListener("click", closeOnBackdrop);

  document.addEventListener("keydown", handleKeyboardShortcuts);
  window.addEventListener("resize", scheduleReaderResize);
  window.addEventListener("orientationchange", scheduleReaderResize);

  ["mousemove", "touchstart", "pointerdown", "keydown"].forEach((eventName) => {
    document.addEventListener(eventName, wakeReaderControls, { passive: true });
  });
}

function renderLibrary(query = "") {
  const cleanQuery = query.trim().toLowerCase();
  const filteredGroups = state.rawLibrary
    .map((group) => ({
      ...group,
      books: (group.books || []).filter((book) => {
        const haystack = `${book.title} ${book.author} ${book.year} ${group.class}`.toLowerCase();
        return !cleanQuery || haystack.includes(cleanQuery);
      })
    }))
    .filter((group) => group.books.length > 0);

  dom.bookGrid.replaceChildren();
  filteredGroups.forEach((group) => {
    const shelf = document.createElement("section");
    shelf.className = "class-shelf";

    const title = document.createElement("h4");
    title.className = "class-title";
    title.textContent = group.class;

    const row = document.createElement("div");
    row.className = "class-books";

    group.books.forEach((book) => {
      row.appendChild(createBookCard(state.booksById.get(createBookId(book.file)), { compact: false }));
    });

    shelf.append(title, row);
    dom.bookGrid.appendChild(shelf);
  });

  dom.libraryCount.textContent = `${state.books.length} books`;
  dom.continueSection.hidden = true;
  dom.recentSection.hidden = true;
  setupCoverObserver();
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

  const title = document.createElement("h5");
  title.className = "book-title";
  title.textContent = book.title;

  const meta = document.createElement("p");
  meta.className = "book-meta";
  meta.textContent = `${book.author || "Unknown"} | ${book.className} | ${book.year || ""}`;

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
  if (!book || !window.pdfjsLib) {
    container.classList.remove("cover-loading");
    return;
  }

  if (!container.isConnected) {
    return;
  }

  try {
    const pdf = await pdfjsLib.getDocument({ url: book.file }).promise;
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
  const fallback = container.querySelector(".cover-fallback");
  container.replaceChildren();

  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.src = dataUrl;
  if (fallback) {
    fallback.classList.add("with-preview");
    container.appendChild(fallback);
  }
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
  setReaderLoading(`Opening ${book.title}...`);
  stopCoverQueue();

  document.body.classList.add("reader-open");
  dom.library.hidden = true;
  dom.reader.hidden = false;
  dom.bookTitle.textContent = book.title;
  dom.headerEyebrow.textContent = book.className;
  state.currentBook = book;
  updateRecent(book.id);

  try {
    await cleanupReader({ keepCurrentBook: true });
    state.currentPageIndex = Math.max(0, pageNumber - 1);
    state.pdfDocument = await pdfjsLib.getDocument({ url: book.file }).promise;
    state.totalPages = state.pdfDocument.numPages;
    await updatePdfPageRatio();
    state.currentPageIndex = clamp(state.currentPageIndex, 0, Math.max(0, state.totalPages - 1));
    await buildPageFlip(state.currentPageIndex);
    saveCurrentProgress();
    dom.continueSection.hidden = true;
    dom.recentSection.hidden = true;
    clearReaderLoading();
    wakeReaderControls();
  } catch (error) {
    console.error(error);
    setReaderLoading("This PDF could not be opened. Please try another book.", true);
  }
}

async function buildPageFlip(startIndex = 0) {
  destroyPageFlip();
  ensureFlipbookElement();
  state.pageElements = createPageElements(state.totalPages);
  state.renderedPages.clear();
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
    renderVisiblePages(state.currentPageIndex);
    saveCurrentProgress();
  });

  state.pageFlip.on("changeState", wakeReaderControls);
  state.pageFlip.turnToPage(startIndex);
  updateReaderStatus();
  await renderVisiblePages(startIndex);
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

function getPageSize() {
  const isReading = document.body.classList.contains("reader-open");
  const headerHeight = isReading ? 0 : (dom.appHeader.getBoundingClientRect().height || 70);
  const controlsReserve = window.innerWidth <= 760 ? 96 : 72;
  const availableWidth = Math.max(260, window.innerWidth - 16);
  const availableHeight = Math.max(320, window.innerHeight - headerHeight - controlsReserve - 10);
  const ratio = state.pageRatio || 0.72;

  let height = Math.min(availableHeight, 920);
  let width = Math.round(height * ratio);

  if (width > availableWidth) {
    width = Math.min(availableWidth, 720);
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
    const padding = window.innerWidth <= 760 ? 18 : 28;
    const targetWidth = Math.max(180, size.width - padding);
    const targetHeight = Math.max(260, size.height - padding);
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fitScale = Math.min(targetWidth / baseViewport.width, targetHeight / baseViewport.height);
    const viewport = pdfPage.getViewport({ scale: fitScale * dpr });
    const cssViewport = pdfPage.getViewport({ scale: fitScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    canvas.className = "pdf-canvas";
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(cssViewport.width)}px`;
    canvas.style.height = `${Math.floor(cssViewport.height)}px`;

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

function flipRelative(direction) {
  if (!state.pageFlip) {
    return;
  }

  if (direction < 0) {
    state.pageFlip.flipPrev("bottom");
  } else {
    state.pageFlip.flipNext("bottom");
  }

  wakeReaderControls();
}

function getEventPageIndex(event) {
  if (typeof event?.data === "number") {
    return event.data;
  }

  if (state.pageFlip) {
    return state.pageFlip.getCurrentPageIndex();
  }

  return state.currentPageIndex;
}

function updateReaderStatus() {
  const current = state.currentPageIndex + 1;
  const total = Math.max(1, state.totalPages);
  dom.pageInfo.textContent = `Page ${current} of ${total}`;
  dom.prevBtn.disabled = state.currentPageIndex <= 0;
  dom.nextBtn.disabled = state.currentPageIndex >= total - 1;
  dom.goToInput.max = String(total);
  dom.goToInput.placeholder = `1-${total}`;
  dom.goToHint.textContent = `Enter a page from 1 to ${total}.`;
  dom.goToHint.classList.remove("error");
}

function openSearch() {
  dom.searchBar.hidden = false;
  dom.searchInput.focus();
}

function closeSearch() {
  dom.searchBar.hidden = true;
  dom.searchInput.value = "";
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
  dom.modalClass.textContent = book.className;

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
  link.href = book.file;
  link.download = `${book.title}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openIndexModal() {
  if (!state.currentBook) {
    return;
  }

  const classBooks = state.booksByClass.get(state.currentBook.className) || [];
  dom.indexList.replaceChildren();

  classBooks.forEach((book, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `index-item${book.id === state.currentBook.id ? " current" : ""}`;

    const title = document.createElement("strong");
    title.textContent = book.title;

    const meta = document.createElement("span");
    meta.textContent = `Chapter ${index + 1} | ${book.year || book.className}`;

    item.append(title, meta);
    item.addEventListener("click", () => openBook(book.id, 1));
    dom.indexList.appendChild(item);
  });

  dom.indexModal.hidden = false;
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
  state.currentPageIndex = pageIndex;
  await renderVisiblePages(pageIndex);
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
  await cleanupReader();
  document.body.classList.remove("reader-open");
  dom.reader.hidden = true;
  dom.library.hidden = false;
  dom.bookTitle.textContent = "My Books";
  dom.headerEyebrow.textContent = "Kindle Library";
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

  const text = `Reading ${state.currentBook.title}. Page ${state.currentPageIndex + 1} of ${state.totalPages}.`;
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
  if (dom.reader.hidden || !state.currentBook || !state.pdfDocument) {
    return;
  }

  clearTimeout(state.resizeTimer);
  state.resizeTimer = setTimeout(async () => {
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
    updatedAt: Date.now()
  };
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
}

function setReaderLoading(message, isError = false) {
  dom.readerMessage.hidden = false;
  dom.readerMessage.textContent = message;
  dom.readerMessage.style.borderColor = isError ? "#b33b2e" : "";
}

function clearReaderLoading() {
  dom.readerMessage.hidden = true;
  dom.readerMessage.textContent = "";
  dom.readerMessage.style.borderColor = "";
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
