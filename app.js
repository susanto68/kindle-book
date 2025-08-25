/* Kindle Book Reader App
   - Mobile-first design with class-based organization
   - PDF rendering using PDF.js with PageFlip for 3D page flipping
   - Text-to-speech with auto-continue and resume functionality
   - Optimized rendering with pre-rendering of current/next/prev pages
   - Responsive controls for mobile and desktop
   - Dynamic layout switching between single (mobile) and double (desktop) page modes
*/

// Configuration
const MANIFEST_URL = 'books.json';
const PRELOAD_PAGES = 3;
const RENDER_SCALE = 1.5;
const BATCH_RENDER_DELAY = 100;
const MOBILE_BREAKPOINT = 768;

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
let currentLayoutMode = 'desktop'; // 'mobile' or 'desktop'

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

// Detect current layout mode based on screen size
function detectLayoutMode() {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    return isMobile ? 'mobile' : 'desktop';
}

// Check if layout mode has changed
function hasLayoutChanged() {
    const newMode = detectLayoutMode();
    if (newMode !== currentLayoutMode) {
        currentLayoutMode = newMode;
        return true;
    }
    return false;
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
    if (readerEl) readerEl.removeAttribute('aria-hidden');
    
    // Ensure UI is properly set for current layout mode
    updateUIForLayout();
    
    // Focus the back button for accessibility
    if (backBtn) {
        setTimeout(() => backBtn.focus(), 100);
    }
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
    
    // Return focus to library for accessibility
    if (libraryEl) {
        setTimeout(() => libraryEl.focus(), 100);
    }
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
    
    // Detect current layout mode and force mobile behavior
    const isMobile = currentLayoutMode === 'mobile';
    const displayMode = isMobile ? "single" : "double";
    
    // Force single page mode on mobile for better reading experience
    if (isMobile) {
        console.log('Forcing single page mode for mobile device');
    }
    
    // Set flipbook dimensions based on layout mode
    let flipbookWidth, flipbookHeight;
    
    if (isMobile) {
        // Mobile: full screen minus slim header and slim controls
        flipbookWidth = window.innerWidth;
        flipbookHeight = window.innerHeight - 100; // Account for slim header (45px) + slim controls (55px)
        
        // Ensure minimum dimensions for readability
        if (flipbookHeight < 400) {
            flipbookHeight = 400;
        }
        
        // Force viewport units for mobile
        flipbookWidth = window.innerWidth;
        flipbookHeight = Math.max(400, window.innerHeight - 100);
        
        console.log(`Mobile dimensions: ${flipbookWidth}x${flipbookHeight}`);
    } else {
        // Desktop: standard book size with two-page spread
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
    try {
        pageFlip = new St.PageFlip(flipbookEl, {
            width: flipbookWidth,
            height: flipbookHeight,
            size: "stretch",
            maxShadowOpacity: isMobile ? 0.35 : 0.45,
            flippingTime: isMobile ? 400 : 520, // Faster flips on mobile
            usePortrait: isMobile ? true : false, // Force portrait on mobile for better reading
            showCover: true,
            autoSize: true,
            drawShadow: true,
            // Force single page display on mobile
            display: displayMode,
            // Additional mobile optimizations
            disableFlipByClick: isMobile, // Disable click flipping on mobile to prevent conflicts
            flippingTime: isMobile ? 400 : 520,
            maxShadowOpacity: isMobile ? 0.35 : 0.45
        });
        
        console.log('PageFlip instance created successfully');
    } catch (error) {
        console.error('Failed to create PageFlip instance:', error);
        throw error;
    }
    
    // Additional mobile optimizations before PageFlip initialization
    if (isMobile) {
        // Pre-optimize the flipbook element to reduce touch conflicts
        if (flipbookEl) {
            // Add more aggressive touch optimizations
            flipbookEl.style.pointerEvents = 'auto';
            flipbookEl.style.touchAction = 'pan-x pan-y';
            flipbookEl.style.webkitTouchCallout = 'none';
            flipbookEl.style.webkitUserSelect = 'none';
            flipbookEl.style.userSelect = 'none';
            
            // Add data attributes that might help PageFlip
            flipbookEl.setAttribute('data-touch-action', 'pan-x pan-y');
            flipbookEl.setAttribute('data-user-select', 'none');
        }
    }
    
    // Try to intercept PageFlip's internal touch event handling before loadFromHTML
    if (isMobile && flipbookEl) {
        try {
            // Override the flipbook element's addEventListener to force passive touch events
            const originalAddEventListener = flipbookEl.addEventListener;
            flipbookEl.addEventListener = function(type, listener, options) {
                if (type === 'touchstart' || type === 'touchend' || type === 'touchmove') {
                    const newOptions = { ...options, passive: true };
                    return originalAddEventListener.call(this, type, listener, newOptions);
                }
                return originalAddEventListener.call(this, type, listener, options);
            };
            
            // Also try to override on the prototype level
            if (flipbookEl.__proto__ && flipbookEl.__proto__.addEventListener) {
                const protoAddEventListener = flipbookEl.__proto__.addEventListener;
                flipbookEl.__proto__.addEventListener = function(type, listener, options) {
                    if (type === 'touchstart' || type === 'touchend' || type === 'touchmove') {
                        const newOptions = { ...options, passive: true };
                        return protoAddEventListener.call(this, type, listener, newOptions);
                    }
                    return protoAddEventListener.call(this, type, listener, options);
                };
            }
        } catch (e) {
            console.log('Touch event override failed:', e);
        }
    }
    
    // Load from the HTML elements we just created
    pageFlip.loadFromHTML(flipbookEl.querySelectorAll('.page'));
    
    // Additional mobile optimizations after PageFlip initialization
    if (isMobile) {
        // Try to optimize PageFlip's internal touch handling
        try {
            // Disable some internal PageFlip features that might cause touch conflicts
            if (pageFlip.disableFlipByClick !== undefined) {
                pageFlip.disableFlipByClick(true);
            }
            
            // Set mobile-specific options if available
            if (pageFlip.setOptions) {
                pageFlip.setOptions({
                    flippingTime: 400,
                    maxShadowOpacity: 0.35,
                    usePortrait: true
                });
            }
            
            // Try to access and optimize internal PageFlip elements
            setTimeout(() => {
                try {
                    // Look for PageFlip's internal elements and optimize them
                    const pageFlipElements = flipbookEl.querySelectorAll('[class*="stf"], [class*="page-flip"]');
                    pageFlipElements.forEach(el => {
                        if (el.style) {
                            el.style.touchAction = 'pan-x pan-y';
                            el.style.webkitTouchCallout = 'none';
                            el.style.webkitUserSelect = 'none';
                            el.style.userSelect = 'none';
                        }
                    });
                    
                    // Also try to optimize any dynamically created elements
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            mutation.addedNodes.forEach((node) => {
                                if (node.nodeType === 1 && node.style) { // Element node
                                    node.style.touchAction = 'pan-x pan-y';
                                    node.style.webkitTouchCallout = 'none';
                                    node.style.webkitUserSelect = 'none';
                                    node.style.userSelect = 'none';
                                }
                            });
                        });
                    });
                    
                    observer.observe(flipbookEl, { childList: true, subtree: true });
                    
                } catch (e) {
                    console.log('PageFlip internal optimization failed:', e);
                }
            }, 100);
            
        } catch (e) {
            console.log('PageFlip optimization options not available:', e);
        }
    }
    
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
    
    // Additional mobile-specific optimizations
    if (isMobile) {
        // Ensure smooth scrolling on mobile
        if (flipbookEl) {
            flipbookEl.style.webkitOverflowScrolling = 'touch';
            flipbookEl.style.overflow = 'hidden';
            // Add touch-action for better mobile performance
            flipbookEl.style.touchAction = 'pan-x pan-y';
            // Disable default touch behaviors that might conflict with PageFlip
            flipbookEl.style.userSelect = 'none';
            flipbookEl.style.webkitUserSelect = 'none';
            flipbookEl.style.mozUserSelect = 'none';
            flipbookEl.style.msUserSelect = 'none';
            flipbookEl.style.webkitTouchCallout = 'none';
            flipbookEl.style.pointerEvents = 'auto';
        }
        
        // Add CSS class for mobile-specific styling
        flipbookEl.classList.add('mobile-flipbook');
        
        // Try to override PageFlip's internal touch handling
        try {
            // Override addEventListener to add passive option to touch events
            const originalAddEventListener = flipbookEl.addEventListener;
            flipbookEl.addEventListener = function(type, listener, options) {
                if (type === 'touchstart' || type === 'touchend' || type === 'touchmove') {
                    // Force passive for touch events
                    const newOptions = { ...options, passive: true };
                    return originalAddEventListener.call(this, type, listener, newOptions);
                }
                return originalAddEventListener.call(this, type, listener, options);
            };
            
            // Also try to override on the prototype
            if (flipbookEl.__proto__ && flipbookEl.__proto__.addEventListener) {
                const protoAddEventListener = flipbookEl.__proto__.addEventListener;
                flipbookEl.__proto__.addEventListener = function(type, listener, options) {
                    if (type === 'touchstart' || type === 'touchend' || type === 'touchmove') {
                        const newOptions = { ...options, passive: true };
                        return protoAddEventListener.call(this, type, listener, newOptions);
                    }
                    return protoAddEventListener.call(this, type, listener, options);
                };
            }
        } catch (e) {
            console.log('Touch event override failed:', e);
        }
    }
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
                // Check if layout mode has changed
                const layoutChanged = hasLayoutChanged();
                
                if (layoutChanged) {
                    console.log(`Layout mode changed to: ${currentLayoutMode}`);
                    
                    // Update UI elements based on new layout
                    updateUIForLayout();
                }
                
                // Destroy current instance
                if (pageFlip) {
                    pageFlip.destroy();
                    pageFlip = null;
                }
                
                // Reinitialize with new dimensions and layout mode
                await initializePageFlip();
                
                // Re-render current page
                if (currentPage > 0) {
                    await ensurePagesRendered(currentPage);
                }
                
                console.log(`Flipbook reinitialized for ${currentLayoutMode} mode`);
            } catch (error) {
                console.error('Failed to reinitialize flipbook:', error);
            }
        }, 250); // 250ms debounce
    }
}

// Update UI elements based on current layout mode
function updateUIForLayout() {
    const isMobile = currentLayoutMode === 'mobile';
    
    // Update header styling
    if (readerEl) {
        const header = readerEl.querySelector('.reader-header');
        if (header) {
            if (isMobile) {
                header.style.minHeight = '45px';
                header.style.maxHeight = '45px';
            } else {
                header.style.minHeight = '';
                header.style.maxHeight = '';
            }
        }
    }
    
    // Update controls visibility and positioning
    if (readerEl) {
        const mobileControls = readerEl.querySelector('.mobile-controls');
        const desktopControls = readerEl.querySelector('.desktop-controls');
        
        if (mobileControls && desktopControls) {
            if (isMobile) {
                mobileControls.style.display = 'block';
                desktopControls.style.display = 'none';
            } else {
                mobileControls.style.display = 'none';
                desktopControls.style.display = 'block';
            }
        }
    }
    
    // Update flipbook container styling
    if (flipbookEl) {
        if (isMobile) {
            flipbookEl.style.width = '100%';
            flipbookEl.style.height = '100%';
            flipbookEl.style.maxWidth = 'none';
            flipbookEl.style.maxHeight = 'none';
        } else {
            flipbookEl.style.width = '800px';
            flipbookEl.style.height = '600px';
            flipbookEl.style.maxWidth = '800px';
            flipbookEl.style.maxHeight = '600px';
        }
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
        }, { passive: true });

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
        }, { passive: true });
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
    }, { passive: false });
    
    // Add responsive resize listener with better debouncing
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (pageFlip && currentBook) {
                reinitializeFlipbookOnResize();
            }
        }, 300);
    }, { passive: true });
    
    // Handle orientation changes on mobile devices
    if ('onorientationchange' in window) {
        let orientationTimeout;
        window.addEventListener('orientationchange', () => {
            clearTimeout(orientationTimeout);
            // Wait for orientation change to complete
            orientationTimeout = setTimeout(() => {
                if (hasLayoutChanged()) {
                    console.log('Orientation changed, updating layout');
                    updateUIForLayout();
                    // Only reinitialize if necessary
                    if (pageFlip && currentBook && !pageFlip.isFlipping()) {
                        reinitializeFlipbookOnResize();
                    }
                }
            }, 500);
        }, { passive: true });
    }
}

// Initialize app
async function init() {
    try {
        // Initialize DOM elements first
        initializeDOM();
        
        // Set initial layout mode
        currentLayoutMode = detectLayoutMode();
        console.log(`Initial layout mode: ${currentLayoutMode}`);
        
        // Setup keyboard navigation
        setupKeyboardNavigation();
        
        // Try to intercept PageFlip's global touch event handling
        if (currentLayoutMode === 'mobile') {
            try {
                // Override global addEventListener to force passive touch events for PageFlip
                const originalAddEventListener = Element.prototype.addEventListener;
                Element.prototype.addEventListener = function(type, listener, options) {
                    if (type === 'touchstart' || type === 'touchend' || type === 'touchmove') {
                        // Force passive for touch events to prevent warnings
                        const newOptions = { ...options, passive: true };
                        return originalAddEventListener.call(this, type, listener, newOptions);
                    }
                    return originalAddEventListener.call(this, type, listener, options);
                };
                console.log('Global touch event override applied');
            } catch (e) {
                console.log('Global touch event override failed:', e);
            }
        }
        
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
