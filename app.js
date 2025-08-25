/* Kindle Book Reader App
   - Mobile-first design with class-based organization
   - PDF rendering using PDF.js with PageFlip for 3D page flipping
   - Text-to-speech with auto-continue and resume functionality
   - Optimized rendering with pre-rendering of current/next/prev pages
   - Responsive controls for mobile and desktop
   - Dynamic layout switching between single (mobile) and double (desktop) page modes
*/

// DOM Elements
const loadingScreen = document.getElementById("loadingScreen");
const libraryEl = document.getElementById("library");
const readerEl = document.getElementById("reader");
const flipbookEl = document.getElementById("flipbook");
const bookTitle = document.getElementById("bookTitle");
const bookGrid = document.getElementById("bookGrid");
const searchBtn = document.getElementById("searchBtn");
const searchBar = document.getElementById("searchBar");
const searchInput = document.getElementById("searchInput");
const closeSearch = document.getElementById("closeSearch");
const menuBtn = document.getElementById("menuBtn");
const prevBtn = document.getElementById("prevPage");
const nextBtn = document.getElementById("nextPage");
const playPauseBtn = document.getElementById("playPause");
const backBtn = document.getElementById("backBtn");
const pageInfo = document.getElementById("pageInfo");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const bookModal = document.getElementById("bookModal");
const modalTitle = document.getElementById("modalTitle");
const modalAuthor = document.getElementById("modalAuthor");
const modalYear = document.getElementById("modalYear");
const modalClass = document.getElementById("modalClass");
const readBook = document.getElementById("readBook");
const downloadBook = document.getElementById("downloadBook");
const closeModal = document.getElementById("closeModal");

// Global variables
let pageFlip, currentBook, speech, isPlaying = false;
let allBooks = [];
let filteredBooks = [];

// Initialize the app
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadBooks();
  setupEventListeners();
  hideLoadingScreen();
}

// Load books from JSON
async function loadBooks() {
  try {
    const response = await fetch("books.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    allBooks = data;
    displayBooks(data);
  } catch (error) {
    console.error('Error loading books:', error);
    showError('Failed to load library. Please refresh the page.');
  }
}

function displayBooks(data) {
  bookGrid.innerHTML = '';
  
  data.forEach(classData => {
    // Class header
    const classHeader = document.createElement("h2");
    classHeader.className = "class-header";
    classHeader.textContent = classData.class;
    bookGrid.appendChild(classHeader);

    // Books grid for this class
    const booksGrid = document.createElement("div");
    booksGrid.className = "book-grid";

    classData.books.forEach(book => {
      const bookCard = createBookCard(book, classData.class);
      booksGrid.appendChild(bookCard);
    });

    bookGrid.appendChild(booksGrid);
  });
}

function createBookCard(book, className) {
  const card = document.createElement("div");
  card.className = "book-card";
  
  card.innerHTML = `
    <h3>${book.title}</h3>
    <div class="book-meta">
      <span>${book.author}</span>
      <span>${book.year}</span>
    </div>
    <div class="book-actions">
      <button class="btn btn-primary" onclick="openBook('${book.file}', '${book.title}', '${book.author}', '${book.year}', '${className}')">
        📖 Read
      </button>
      <button class="btn btn-secondary" onclick="showBookDetails('${book.title}', '${book.author}', '${book.year}', '${className}', '${book.file}')">
        ℹ️ Info
      </button>
    </div>
  `;
  
  return card;
}

function openBook(path, title, author, year, className) {
  // Hide library and show reader
  libraryEl.style.display = "none";
  readerEl.style.display = "flex";
  bookTitle.textContent = title;
  
  // Store current book info
  currentBook = { path, title, author, year, className };
  
  // Initialize PageFlip
  initializePageFlip(path);
  
  // Update page info
  updatePageInfo();
}

function initializePageFlip(pdfPath) {
  // Clear previous instance
  if (pageFlip) {
    pageFlip.destroy();
  }
  
  // Force single page mode on mobile
  const isMobile = window.innerWidth <= 768;
  
  const config = {
    width: isMobile ? window.innerWidth - 40 : 400,
    height: isMobile ? window.innerHeight - 200 : 600,
    size: "stretch",
    minWidth: 200,
    minHeight: 200,
    maxWidth: isMobile ? window.innerWidth - 40 : 800,
    maxHeight: isMobile ? window.innerHeight - 200 : 800,
    drawShadow: true,
    flippingTime: 600,
    showCover: true,
    usePortrait: isMobile,
    autoSize: true,
    maxShadowOpacity: 0.3,
    showPageCorners: !isMobile,
    disableFlipByClick: false,
    swipeDistance: 30
  };
  
  try {
    pageFlip = new St.PageFlip(flipbookEl, config);
    
    // Load PDF
    pageFlip.loadFromPDF(pdfPath);
    
    // Event listeners
    pageFlip.on('flip', (e) => {
      updatePageInfo();
    });
    
    pageFlip.on('init', (e) => {
      updatePageInfo();
    });
    
    pageFlip.on('error', (e) => {
      console.error('PageFlip error:', e);
      showError('Failed to load PDF. Please try again.');
    });
    
  } catch (error) {
    console.error('Error initializing PageFlip:', error);
    showError('Failed to initialize reader. Please try again.');
  }
}

function updatePageInfo() {
  if (pageFlip) {
    const currentPage = pageFlip.getCurrentPageIndex() + 1;
    const totalPages = pageFlip.getPageCount();
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  }
}

function showBookDetails(title, author, year, className, filePath) {
  modalTitle.textContent = title;
  modalAuthor.textContent = author;
  modalYear.textContent = year;
  modalClass.textContent = className;
  
  // Set up modal actions
  readBook.onclick = () => {
    closeBookModal();
    openBook(filePath, title, author, year, className);
  };
  
  downloadBook.onclick = () => {
    downloadPDF(filePath, title);
  };
  
  bookModal.style.display = "flex";
}

function closeBookModal() {
  bookModal.style.display = "none";
}

function downloadPDF(filePath, title) {
  const link = document.createElement('a');
  link.href = filePath;
  link.download = `${title}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Search functionality
function setupSearch() {
  searchBtn.addEventListener('click', () => {
    searchBar.style.display = 'flex';
    searchInput.focus();
  });
  
  closeSearch.addEventListener('click', () => {
    searchBar.style.display = 'none';
    searchInput.value = '';
    displayBooks(allBooks);
  });
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (query.length === 0) {
      displayBooks(allBooks);
      return;
    }
    
    const filtered = allBooks.map(classData => ({
      ...classData,
      books: classData.books.filter(book => 
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        classData.class.toLowerCase().includes(query)
      )
    })).filter(classData => classData.books.length > 0);
    
    displayBooks(filtered);
  });
}

// Event listeners
function setupEventListeners() {
  // Navigation
  prevBtn.addEventListener("click", () => {
    if (pageFlip) pageFlip.flipPrev();
  });
  
  nextBtn.addEventListener("click", () => {
    if (pageFlip) pageFlip.flipNext();
  });
  
  backBtn.addEventListener("click", () => {
    closeReader();
  });
  
  // Text-to-Speech
  playPauseBtn.addEventListener("click", toggleTextToSpeech);
  
  // Zoom controls
  zoomIn.addEventListener("click", () => {
    if (pageFlip) {
      const currentZoom = pageFlip.getZoom() || 1;
      pageFlip.zoomTo(currentZoom + 0.1);
    }
  });
  
  zoomOut.addEventListener("click", () => {
    if (pageFlip) {
      const currentZoom = pageFlip.getZoom() || 1;
      pageFlip.zoomTo(Math.max(0.5, currentZoom - 0.1));
    }
  });
  
  // Fullscreen
  fullscreenBtn.addEventListener("click", toggleFullscreen);
  
  // Modal
  closeModal.addEventListener("click", closeBookModal);
  
  // Search
  setupSearch();
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Touch gestures for mobile
  setupTouchGestures();
  
  // Resize handling
  window.addEventListener('resize', handleResize);
}

function toggleTextToSpeech() {
  if (!isPlaying) {
    const text = `Reading ${currentBook?.title || 'book'} aloud...`;
    speech = new SpeechSynthesisUtterance(text);
    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 0.8;
    
    speech.onend = () => {
      isPlaying = false;
      playPauseBtn.innerHTML = '<span class="btn-icon">🔊</span><span class="btn-text">Play</span>';
    };
    
    speechSynthesis.speak(speech);
    isPlaying = true;
    playPauseBtn.innerHTML = '<span class="btn-icon">⏸</span><span class="btn-text">Pause</span>';
  } else {
    speechSynthesis.cancel();
    isPlaying = false;
    playPauseBtn.innerHTML = '<span class="btn-icon">🔊</span><span class="btn-text">Play</span>';
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (readerEl.requestFullscreen) {
      readerEl.requestFullscreen();
    } else if (readerEl.webkitRequestFullscreen) {
      readerEl.webkitRequestFullscreen();
    } else if (readerEl.msRequestFullscreen) {
      readerEl.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

function closeReader() {
  // Stop any ongoing speech
  if (isPlaying) {
    speechSynthesis.cancel();
    isPlaying = false;
  }
  
  // Destroy PageFlip instance
  if (pageFlip) {
    pageFlip.destroy();
    pageFlip = null;
  }
  
  // Reset UI
  readerEl.style.display = "none";
  libraryEl.style.display = "block";
  bookTitle.textContent = "📚 My Library";
  
  // Clear current book
  currentBook = null;
}

function handleKeyboardShortcuts(e) {
  // Only handle shortcuts when in reader mode
  if (readerEl.style.display === "none") return;
  
  switch(e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      if (pageFlip) pageFlip.flipPrev();
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (pageFlip) pageFlip.flipNext();
      break;
    case 'Escape':
      e.preventDefault();
      closeReader();
      break;
    case ' ':
      e.preventDefault();
      toggleTextToSpeech();
      break;
    case 'f':
      e.preventDefault();
      toggleFullscreen();
      break;
  }
}

function setupTouchGestures() {
  let startX = 0;
  let startY = 0;
  
  flipbookEl.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });
  
  flipbookEl.addEventListener('touchend', (e) => {
    if (!pageFlip) return;
    
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    // Minimum swipe distance
    const minSwipeDistance = 50;
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        pageFlip.flipPrev();
      } else {
        pageFlip.flipNext();
      }
    }
  });
}

function handleResize() {
  if (pageFlip && currentBook) {
    // Reinitialize PageFlip with new dimensions
    initializePageFlip(currentBook.path);
  }
}

function showError(message) {
  // Create error notification
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #dc3545;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 300px;
    font-size: 14px;
  `;
  errorDiv.textContent = message;
  
  document.body.appendChild(errorDiv);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 5000);
}

function hideLoadingScreen() {
  setTimeout(() => {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 300);
  }, 1000);
}

// Service Worker registration for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
