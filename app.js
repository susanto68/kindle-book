/* Kindle Book Reader App
   - Mobile-first design with class-based organization
   - PDF rendering using PDF.js with PageFlip for 3D page flipping
   - Text-to-speech with auto-continue and resume functionality
   - Optimized rendering with pre-rendering of current/next/prev pages
   - Responsive controls for mobile and desktop
*/

// Configuration
const MANIFEST_URL = 'books.json';
const PRELOAD_PAGES = 3;
const RENDER_SCALE = 1.5;
const BATCH_RENDER_DELAY = 100;

// PDF.js worker configuration - check if library is loaded
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

// DOM Elements - will be initialized after DOM loads
let libraryEl, classGridEl, loadingEl, errorEl, readerEl, flipbookEl, loadingOverlayEl, toastEl;
let backBtn, bookTitleEl, bookAuthorEl, pageCounterEl, pageCounterDesktopEl, pageRangeEl;
let prevBtn, nextBtn, prevBtnDesktop, nextBtnDesktop, ttsBtn, ttsStop, ttsBtnDesktop, ttsStopDesktop;

// State variables
let manifest = [];
let currentBook = null;
let pdfDoc = null;
let pageFlip = null;
let totalPages = 0;
let currentPage = 1;
let renderedPages = new Map(); // page -> dataURL
let renderQueue = [];
let backgroundRendering = false;
let pageTextCache = new Map();

// TTS state
let speaking = false;
let paused = false;
let utterance = null;
let speakIndex = 0;
let currentPageText = '';

// Utility functions
function showToast(message, duration = 3000) {
    if (toastEl) {
        toastEl.textContent = message;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), duration);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Generate cover placeholder using Canvas
function generateCoverPlaceholder(title, author) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 300;
    canvas.height = 400;
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Text styling
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    
    // Draw title (wrapped)
    const words = title.split(' ');
    let line = '';
    let y = 180;
    
    for (let word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > canvas.width - 40) {
            ctx.fillText(line, canvas.width / 2, y);
            line = word + ' ';
            y += 35;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, canvas.width / 2, y);
    
    // Draw author
    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(author, canvas.width / 2, y + 50);
    
    return canvas.toDataURL('image/jpeg', 0.9);
}

// Library functions
async function loadManifest() {
    try {
        const response = await fetch(MANIFEST_URL);
        if (!response.ok) throw new Error('Failed to fetch manifest');
        manifest = await response.json();
        return true;
    } catch (error) {
        console.error('Failed to load manifest:', error);
        return false;
    }
}

function buildLibrary() {
    if (!manifest || manifest.length === 0) {
        if (errorEl) errorEl.style.display = 'block';
        if (loadingEl) loadingEl.style.display = 'none';
        return;
    }
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    
    if (classGridEl) classGridEl.innerHTML = '';
    
    manifest.forEach(classData => {
        const classSection = document.createElement('div');
        classSection.className = 'class-section';
        
        const classTitle = document.createElement('h2');
        classTitle.className = 'class-title';
        classTitle.textContent = classData.class;
        
        const booksGrid = document.createElement('div');
        booksGrid.className = 'books-grid';
        
        classData.books.forEach(book => {
            const bookCard = createBookCard(book);
            booksGrid.appendChild(bookCard);
        });
        
        classSection.appendChild(classTitle);
        classSection.appendChild(booksGrid);
        if (classGridEl) classGridEl.appendChild(classSection);
    });
}

function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    
    const cover = document.createElement('div');
    cover.className = 'book-cover';
    
    // Generate placeholder cover
    const placeholderDataUrl = generateCoverPlaceholder(book.title, book.author);
    const placeholder = document.createElement('div');
    placeholder.className = 'cover-placeholder';
    placeholder.textContent = book.title;
    cover.appendChild(placeholder);
    
    const info = document.createElement('div');
    info.className = 'book-info';
    
    const title = document.createElement('h3');
    title.className = 'book-title';
    title.textContent = book.title;
    
    const meta = document.createElement('p');
    meta.className = 'book-meta';
    meta.textContent = `${book.author} • ${book.year}`;
    
    info.appendChild(title);
    info.appendChild(meta);
    
    card.appendChild(cover);
    card.appendChild(info);
    
    card.addEventListener('click', () => openBook(book));
    
    return card;
}

// Reader functions
async function openBook(book) {
    try {
        // Check if PDF.js is loaded
        if (!window.pdfjsLib) {
            throw new Error('PDF.js library not loaded. Please refresh the page.');
        }
        
        currentBook = book;
        showReader();
        showLoadingOverlay();
        
        // Update book info
        if (bookTitleEl) bookTitleEl.textContent = book.title;
        if (bookAuthorEl) bookAuthorEl.textContent = book.author;
        
        // Load PDF
        pdfDoc = await pdfjsLib.getDocument(book.file).promise;
        totalPages = pdfDoc.numPages;
        
        // Update page controls
        if (pageRangeEl) {
            pageRangeEl.max = totalPages;
            pageRangeEl.value = '1';
        }
        updatePageCounter(1);
        
        // Initialize page flip
        await initializePageFlip();
        
        // Pre-render initial pages
        await preloadInitialPages();
        
        hideLoadingOverlay();
        
    } catch (error) {
        console.error('Failed to open book:', error);
        showToast('Failed to open book: ' + error.message);
        hideLoadingOverlay();
    }
}

function showReader() {
    if (libraryEl) libraryEl.style.display = 'none';
    if (readerEl) readerEl.style.display = 'flex';
    if (readerEl) readerEl.setAttribute('aria-hidden', 'false');
}

function hideReader() {
    if (readerEl) readerEl.style.display = 'none';
    if (libraryEl) libraryEl.style.display = 'block';
    if (readerEl) readerEl.setAttribute('aria-hidden', 'true');
    
    // Cleanup
    if (pageFlip) {
        try {
            pageFlip.destroy();
        } catch (e) {
            console.warn('Error destroying pageFlip:', e);
        }
        pageFlip = null;
    }
    
    // Stop TTS
    stopTTS();
    
    // Clear state
    currentBook = null;
    pdfDoc = null;
    renderedPages.clear();
    renderQueue = [];
    pageTextCache.clear();
    currentPage = 1;
    speaking = false;
    paused = false;
    utterance = null;
    speakIndex = 0;
}

function showLoadingOverlay() {
    if (loadingOverlayEl) loadingOverlayEl.style.display = 'flex';
}

function hideLoadingOverlay() {
    if (loadingOverlayEl) loadingOverlayEl.style.display = 'none';
}

async function initializePageFlip() {
    // Check if PageFlip is loaded
    if (!window.St) {
        throw new Error('PageFlip library not loaded. Please refresh the page.');
    }
    
    // Clear previous content
    if (flipbookEl) flipbookEl.innerHTML = '';
    
    // Detect screen size and set appropriate display mode
    const isMobile = window.innerWidth <= 768;
    const displayMode = isMobile ? "single" : "double";
    
    // Set flipbook dimensions based on screen size
    let flipbookWidth, flipbookHeight;
    
    if (isMobile) {
        // Mobile: full screen minus header and controls
        flipbookWidth = window.innerWidth;
        flipbookHeight = window.innerHeight - 110; // Account for header + controls
    } else {
        // Desktop: standard book size
        flipbookWidth = 800;
        flipbookHeight = 600;
    }
    
    console.log(`Initializing flipbook: ${isMobile ? 'Mobile' : 'Desktop'} mode`);
    console.log(`Display mode: ${displayMode}`);
    console.log(`Dimensions: ${flipbookWidth}x${flipbookHeight}`);
    console.log(`Screen size: ${window.innerWidth}x${window.innerHeight}`);
    
    // Create actual DOM elements for pages
    for (let i = 1; i <= totalPages; i++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        pageDiv.innerHTML = `<div style="width:100%;height:100%;display:grid;place-items:center;color:#9fb0d0;font-size:18px;">Loading page ${i}...</div>`;
        flipbookEl.appendChild(pageDiv);
    }
    
    // Create page flip instance using St.PageFlip (from page-flip library)
    pageFlip = new St.PageFlip(flipbookEl, {
        width: flipbookWidth,
        height: flipbookHeight,
        size: "stretch",
        maxShadowOpacity: 0.45,
        flippingTime: 520,
        usePortrait: true,
        showCover: true,
        autoSize: true,
        drawShadow: true,
        // Set display mode based on screen size
        display: displayMode
    });
    
    // Load from the HTML elements we just created
    pageFlip.loadFromHTML(flipbookEl.querySelectorAll('.page'));
    
    // Set up event listeners
    pageFlip.on('flip', async (e) => {
        const leftIndex = e.data;
        currentPage = Math.min(totalPages, leftIndex + 1);
        updatePageCounter(currentPage);
        if (pageRangeEl) pageRangeEl.value = currentPage;
        
        // Ensure current and neighbor pages are rendered
        await ensurePagesRendered(currentPage);
        
        // Continue TTS if speaking
        if (speaking && !paused) {
            await startTTSForPage(currentPage, 0);
        }
    });
}

async function preloadInitialPages() {
    const initialPages = Math.min(totalPages, PRELOAD_PAGES);
    
    // Render first few pages quickly
    for (let i = 1; i <= initialPages; i++) {
        await renderPage(i);
    }
    
    // Start background rendering for remaining pages
    startBackgroundRendering();
}

async function renderPage(pageNum) {
    if (renderedPages.has(pageNum)) {
        return renderedPages.get(pageNum);
    }
    
    try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
        
        const dataURL = canvas.toDataURL('image/jpeg', 0.9);
        renderedPages.set(pageNum, dataURL);
        
        // Update page in flipbook
        updatePageInFlipbook(pageNum, dataURL);
        
        // Cleanup
        try {
            page.cleanup();
        } catch (e) {
            console.warn('Page cleanup failed:', e);
        }
        
        return dataURL;
    } catch (error) {
        console.error(`Failed to render page ${pageNum}:`, error);
        return null;
    }
}

function updatePageInFlipbook(pageNum, dataURL) {
    if (!pageFlip || !flipbookEl) return;
    
    try {
        const pages = flipbookEl.querySelectorAll('.page');
        const pageIndex = pageNum - 1;
        
        if (pages[pageIndex]) {
            const page = pages[pageIndex];
            page.innerHTML = `<img src="${dataURL}" style="width:100%;height:100%;object-fit:contain" alt="Page ${pageNum}">`;
        }
    } catch (error) {
        console.error('Failed to update page in flipbook:', error);
    }
}

async function ensurePagesRendered(centerPage) {
    const pagesToRender = [];
    
    // Current page and neighbors
    for (let i = Math.max(1, centerPage - 1); i <= Math.min(totalPages, centerPage + 1); i++) {
        if (!renderedPages.has(i)) {
            pagesToRender.push(i);
        }
    }
    
    // Render pages in parallel
    await Promise.all(pagesToRender.map(pageNum => renderPage(pageNum)));
}

function startBackgroundRendering() {
    if (backgroundRendering) return;
    
    backgroundRendering = true;
    
    const renderNextBatch = async () => {
        if (renderQueue.length === 0) {
            backgroundRendering = false;
            return;
        }
        
        const batch = renderQueue.splice(0, 3);
        await Promise.all(batch.map(pageNum => renderPage(pageNum)));
        
        if (renderQueue.length > 0) {
            setTimeout(renderNextBatch, BATCH_RENDER_DELAY);
        } else {
            backgroundRendering = false;
        }
    };
    
    // Add remaining pages to queue
    for (let i = PRELOAD_PAGES + 1; i <= totalPages; i++) {
        renderQueue.push(i);
    }
    
    renderNextBatch();
}

function updatePageCounter(page) {
    const text = `${page} / ${totalPages}`;
    if (pageCounterEl) pageCounterEl.textContent = text;
    if (pageCounterDesktopEl) pageCounterDesktopEl.textContent = text;
}

// TTS Functions
function ensureSpeech() {
    if (!('speechSynthesis' in window)) {
        showToast('Speech Synthesis not supported in this browser');
        return false;
    }
    return true;
}

async function extractPageText(pageNum) {
    if (pageTextCache.has(pageNum)) {
        return pageTextCache.get(pageNum);
    }
    
    try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
        
        pageTextCache.set(pageNum, text);
        return text;
    } catch (error) {
        console.error(`Failed to extract text from page ${pageNum}:`, error);
        return '';
    }
}

async function startTTSForPage(pageNum, startIndex = 0) {
    if (!ensureSpeech()) return;
    
    const text = await extractPageText(pageNum);
    if (!text) {
        showToast('No text found on this page');
        return;
    }
    
    const remainingText = text.slice(startIndex);
    if (!remainingText) {
        // Move to next page if available
        if (pageNum < totalPages && pageFlip) {
            pageFlip.flipNext();
            setTimeout(() => startTTSForPage(pageNum + 1, 0), 600);
        }
        return;
    }
    
    // Cancel any existing speech
    speechSynthesis.cancel();
    
    // Create new utterance
    utterance = new SpeechSynthesisUtterance(remainingText);
    
    // Set voice preferences
    const voices = speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => voice.lang && voice.lang.toLowerCase().startsWith('en')) || voices[0];
    if (englishVoice) utterance.voice = englishVoice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Event handlers
    utterance.onboundary = (event) => {
        if (event && (event.name === 'word' || event.charIndex >= 0)) {
            speakIndex = startIndex + (event.charIndex || 0);
        }
    };
    
    utterance.onend = async () => {
        if (paused) return;
        
        speaking = false;
        paused = false;
        updateTTSButtons();
        
        // Continue to next page
        if (pageNum < totalPages && pageFlip) {
            pageFlip.flipNext();
            setTimeout(() => startTTSForPage(pageNum + 1, 0), 650);
        }
    };
    
    utterance.onerror = () => {
        speaking = false;
        paused = false;
        updateTTSButtons();
        showToast('TTS error occurred');
    };
    
    // Start speaking
    speaking = true;
    paused = false;
    updateTTSButtons();
    speechSynthesis.speak(utterance);
}

function toggleTTS() {
    if (!ensureSpeech()) return;
    
    if (!speaking) {
        startTTSForPage(currentPage, speakIndex);
    } else if (speaking && !paused) {
        speechSynthesis.pause();
        paused = true;
        updateTTSButtons();
    } else {
        if (speechSynthesis.paused) {
            speechSynthesis.resume();
        } else {
            startTTSForPage(currentPage, speakIndex);
        }
        paused = false;
        updateTTSButtons();
    }
}

function stopTTS() {
    if (!('speechSynthesis' in window)) return;
    
    speechSynthesis.cancel();
    speaking = false;
    paused = false;
    speakIndex = 0;
    updateTTSButtons();
}

function updateTTSButtons() {
    const playText = (!speaking || paused) ? '▶ Play' : '⏸ Pause';
    if (ttsBtn) ttsBtn.textContent = playText;
    if (ttsBtnDesktop) ttsBtnDesktop.textContent = playText;
}

// Add responsive reinitialization function
function reinitializeFlipbookOnResize() {
    if (pageFlip && currentBook) {
        // Debounce resize events
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(async () => {
            try {
                // Destroy current instance
                if (pageFlip) {
                    pageFlip.destroy();
                    pageFlip = null;
                }
                
                // Reinitialize with new dimensions
                await initializePageFlip();
                
                // Re-render current page
                if (currentPage > 0) {
                    await ensurePagesRendered(currentPage);
                }
                
                console.log('Flipbook reinitialized for new screen size');
            } catch (error) {
                console.error('Failed to reinitialize flipbook:', error);
            }
        }, 250); // 250ms debounce
    }
}

// Initialize DOM elements and event listeners
function initializeDOM() {
    // Get all DOM elements
    libraryEl = document.getElementById('library');
    classGridEl = document.getElementById('classGrid');
    loadingEl = document.getElementById('loading');
    errorEl = document.getElementById('error');
    readerEl = document.getElementById('reader');
    flipbookEl = document.getElementById('flipbook');
    loadingOverlayEl = document.getElementById('loadingOverlay');
    toastEl = document.getElementById('toast');

    // Reader elements
    backBtn = document.getElementById('backBtn');
    bookTitleEl = document.getElementById('bookTitle');
    bookAuthorEl = document.getElementById('bookAuthor');
    pageCounterEl = document.getElementById('pageCounter');
    pageCounterDesktopEl = document.getElementById('pageCounterDesktop');
    pageRangeEl = document.getElementById('pageRange');

    // Control buttons
    prevBtn = document.getElementById('prevBtn');
    nextBtn = document.getElementById('nextBtn');
    prevBtnDesktop = document.getElementById('prevBtnDesktop');
    nextBtnDesktop = document.getElementById('nextBtnDesktop');
    ttsBtn = document.getElementById('ttsBtn');
    ttsStop = document.getElementById('ttsStop');
    ttsBtnDesktop = document.getElementById('ttsBtnDesktop');
    ttsStopDesktop = document.getElementById('ttsStopDesktop');

    // Add event listeners only if elements exist
    if (backBtn) backBtn.addEventListener('click', hideReader);

    // Mobile controls
    if (prevBtn) prevBtn.addEventListener('click', () => pageFlip && pageFlip.flipPrev());
    if (nextBtn) nextBtn.addEventListener('click', () => pageFlip && pageFlip.flipNext());
    if (ttsBtn) ttsBtn.addEventListener('click', toggleTTS);
    if (ttsStop) ttsStop.addEventListener('click', stopTTS);

    // Desktop controls
    if (prevBtnDesktop) prevBtnDesktop.addEventListener('click', () => pageFlip && pageFlip.flipPrev());
    if (nextBtnDesktop) nextBtnDesktop.addEventListener('click', () => pageFlip && pageFlip.flipNext());
    if (ttsBtnDesktop) ttsBtnDesktop.addEventListener('click', toggleTTS);
    if (ttsStopDesktop) ttsStopDesktop.addEventListener('click', stopTTS);

    // Page range input
    if (pageRangeEl) {
        pageRangeEl.addEventListener('input', (e) => {
            const targetPage = parseInt(e.target.value);
            if (pageFlip && targetPage >= 1 && targetPage <= totalPages) {
                pageFlip.flip(Math.max(0, targetPage - 1));
            }
        });
    }

    // Touch/swipe support for mobile
    if (flipbookEl) {
        let touchStartX = 0;
        let touchStartY = 0;

        flipbookEl.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        flipbookEl.addEventListener('touchend', (e) => {
            if (!pageFlip) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchStartX - touchEndX;
            const deltaY = touchStartY - touchEndY;
            
            // Minimum swipe distance
            const minSwipeDistance = 50;
            
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                if (deltaX > 0) {
                    pageFlip.flipNext();
                } else {
                    pageFlip.flipPrev();
                }
            }
        });
    }
}

// Keyboard navigation
function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        if (!readerEl || readerEl.style.display === 'none') return;
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                pageFlip && pageFlip.flipPrev();
                break;
            case 'ArrowRight':
                e.preventDefault();
                pageFlip && pageFlip.flipNext();
                break;
            case ' ':
                e.preventDefault();
                toggleTTS();
                break;
            case 'Escape':
                hideReader();
                break;
        }
    });
    
    // Add responsive resize listener
    window.addEventListener('resize', reinitializeFlipbookOnResize);
}

// Initialize app
async function init() {
    try {
        // Initialize DOM elements first
        initializeDOM();
        
        // Setup keyboard navigation
        setupKeyboardNavigation();
        
        // Wait a bit for libraries to load
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if required libraries are loaded
        if (!window.pdfjsLib) {
            throw new Error('PDF.js library failed to load');
        }
        if (!window.St) {
            throw new Error('PageFlip library failed to load');
        }
        
        const success = await loadManifest();
        if (success) {
            buildLibrary();
        } else {
            if (errorEl) errorEl.style.display = 'block';
            if (loadingEl) loadingEl.style.display = 'none';
        }
    } catch (error) {
        console.error('Initialization failed:', error);
        if (errorEl) errorEl.style.display = 'block';
        if (loadingEl) loadingEl.style.display = 'none';
        showToast('Failed to load required libraries. Please refresh the page.');
    }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
