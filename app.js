/* app.js
   - Loads books.json
   - Builds library grid (shows cover if available; if cover fails, displays bold title on card)
   - Opens book in fullscreen reader with St.PageFlip
   - Progressive page rendering: quick small images for first pages, background batches for rest
   - TTS: Play / Pause / Resume (resumes where paused)
*/

/* Config */
const MANIFEST = 'books.json';
const PRELOAD_PAGES = 3;
const BATCH_RENDER = 4;
const BATCH_DELAY = 180;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.5.136/build/pdf.worker.min.js';

/* DOM */
const libraryEl = document.getElementById('library');
const readerSection = document.getElementById('reader');
const flipbookEl = document.getElementById('flipbook');
const backBtn = document.getElementById('backBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageCounter = document.getElementById('pageCounter');
const pageRange = document.getElementById('pageRange');
const ttsBtn = document.getElementById('ttsBtn');
const ttsStop = document.getElementById('ttsStop');
const toastEl = document.getElementById('toast');
const reloadManifest = document.getElementById('reloadManifest');

/* State */
let manifest = [];
let pdfDoc = null;
let pageFlip = null;
let totalPages = 0;
let currentPage = 1;
let rendered = new Map(); // page -> dataURL
let renderQueue = [];
let backgroundRendering = false;
let pageTextCache = new Map();

/* TTS state */
let speaking = false, paused = false, utterance = null, speakIndex = 0;

/* Helpers */
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=> toastEl.classList.remove('show'), 1600);
}

async function fetchJSON(url) {
  const r = await fetch(url, {cache:'no-cache'});
  if(!r.ok) throw new Error('Failed to fetch ' + url);
  return r.json();
}

/* Library */
async function buildLibrary(){
  libraryEl.innerHTML = '';
  try{
    manifest = await fetchJSON(MANIFEST);
  }catch(err){
    libraryEl.innerHTML = `<div style="grid-column:1/-1;padding:20px;color:#9fb0d0">books.json not found or invalid. Put <code>books.json</code> at site root.</div>`;
    console.error(err);
    return;
  }
  if(!Array.isArray(manifest) || manifest.length===0){
    libraryEl.innerHTML = `<div style="grid-column:1/-1;padding:20px;color:#9fb0d0">No books in manifest.</div>`;
    return;
  }

  const io = new IntersectionObserver((entries, obs)=>{
    for(const e of entries){
      if(e.isIntersecting){
        const img = e.target.querySelector('img[data-src]');
        if(img){ img.src = img.dataset.src; img.removeAttribute('data-src'); }
        obs.unobserve(e.target);
      }
    }
  }, {rootMargin:'400px'});

  for(const book of manifest){
    const card = document.createElement('article');
    card.className = 'card';
    const cover = book.cover || '';
    card.innerHTML = `
      <div class="cover">
        ${cover ? `<img data-src="${cover}" alt="${escapeHtml(book.title)} cover" crossorigin="anonymous">` : ''}
        <div class="fallback">${escapeHtml(book.title)}</div>
      </div>
      <div class="meta">
        <h3>${escapeHtml(book.title)}</h3>
        <p>${book.author ? escapeHtml(book.author) : ''} ${book.year ? '• ' + escapeHtml(book.year) : ''}</p>
      </div>
    `;
    // If cover image exists, make fallback hidden until needed
    const img = card.querySelector('img');
    const fallback = card.querySelector('.fallback');
    if(img){
      img.addEventListener('load', ()=> { fallback.style.display = 'none'; });
      img.addEventListener('error', ()=> { img.remove(); fallback.style.display = 'grid'; });
    } else {
      fallback.style.display = 'grid';
    }

    card.addEventListener('click', ()=> openBook(book));
    libraryEl.appendChild(card);
    io.observe(card);
  }
}

/* Escape small helper */
function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* Reader: open book */
async function openBook(book){
  try{
    showToast('Loading: ' + book.title);
    // reset
    rendered.clear(); renderQueue = []; pageTextCache.clear(); speakIndex=0; speaking=false; paused=false;

    // destroy previous
    if(pageFlip){ try{ pageFlip.destroy(); }catch(e){} pageFlip = null; flipbookEl.innerHTML = ''; }

    // load PDF
    pdfDoc = await pdfjsLib.getDocument({ url: book.file }).promise;
    totalPages = pdfDoc.numPages;
    pageRange.max = String(totalPages); pageRange.value = '1';
    pageCounter.textContent = `1 / ${totalPages}`;

    // create pageFlip
    pageFlip = new St.PageFlip(flipbookEl, {
      width: 720, height: 920, size: "stretch", maxShadowOpacity:0.45,
      flippingTime:520, usePortrait:true, showCover:true, autoSize:true, drawShadow:true
    });

    // preload first few pages quickly
    const initial = Math.min(totalPages, PRELOAD_PAGES);
    const pagesArr = [];
    for(let i=1;i<=initial;i++){
      const small = await renderPageToDataURL(i, 0.8);
      rendered.set(i, small);
      pagesArr.push({ type:'html', html:`<img src="${small}" style="width:100%;height:100%;object-fit:contain">` });
    }
    for(let i=initial+1;i<=totalPages;i++){
      pagesArr.push({ type:'html', html:`<div style="width:100%;height:100%;display:grid;place-items:center;color:#9fb0d0">Rendering page ${i}…</div>` });
      renderQueue.push(i);
    }

    pageFlip.loadFromHTML(pagesArr);
    currentPage = 1;
    showReader();

    // upgrade first pages to higher quality
    for(let p=1;p<=initial;p++){
      const hi = await renderPageToDataURL(p, 1.4);
      rendered.set(p, hi);
      replacePageImageInFlip(p, hi);
    }
    // ensure neighbor pages for crisp flips
    await ensureRenderedNeighbors(1);
    backgroundRenderLoop();

    pageFlip.on('flip', async (e)=>{
      const leftIndex = e.data;
      currentPage = Math.min(totalPages, leftIndex + 1);
      pageRange.value = String(currentPage);
      pageCounter.textContent = `${currentPage} / ${totalPages}`;
      await ensureRenderedNeighbors(currentPage);
      if(speaking && !paused) startTTSForPage(currentPage, 0);
    });
  }catch(err){
    console.error('Open book error', err);
    showToast('Failed to open: ' + (err.message || err));
  }
}

/* Show/hide reader */
function showReader(){
  document.getElementById('library').style.display = 'none';
  readerSection.style.display = 'block';
  readerSection.setAttribute('aria-hidden','false');
}
function hideReader(){
  readerSection.style.display = 'none';
  readerSection.setAttribute('aria-hidden','true');
  document.getElementById('library').style.display = '';
}

/* Render page to dataURL */
async function renderPageToDataURL(pageNum, qualityScale=1.0){
  // If already rendered hi-res, return it
  if(rendered.has(pageNum) && qualityScale <= 1.2) return rendered.get(pageNum);
  const page = await pdfDoc.getPage(pageNum);
  const baseScale = 1.2;
  const viewport = page.getViewport({ scale: baseScale * qualityScale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', {alpha:false});
  await page.render({ canvasContext: ctx, viewport }).promise;
  try{ page.cleanup(); }catch(e){}
  return canvas.toDataURL('image/jpeg', 0.9);
}

/* Replace page image inside pageFlip — 1-based pageNum */
function replacePageImageInFlip(pageNum, dataURL){
  try{
    const pages = flipbookEl.querySelectorAll('.page');
    const idx = pageNum - 1;
    if(pages && pages[idx]){
      const img = pages[idx].querySelector('img');
      if(img) img.src = dataURL;
      else pages[idx].innerHTML = `<img src="${dataURL}" style="width:100%;height:100%;object-fit:contain">`;
    }
  }catch(e){}
}

/* Ensure neighbor pages are rendered */
async function ensureRenderedNeighbors(center){
  const toDo = [];
  for(let d=-1; d<=1; d++){
    const p = center + d;
    if(p>=1 && p<=totalPages && !rendered.has(p)) toDo.push(p);
  }
  for(const p of toDo){
    const data = await renderPageToDataURL(p, 1.25);
    rendered.set(p, data);
    replacePageImageInFlip(p, data);
  }
}

/* Background batch rendering */
async function backgroundRenderLoop(){
  if(backgroundRendering) return;
  backgroundRendering = true;
  while(renderQueue.length){
    const batch = renderQueue.splice(0, BATCH_RENDER);
    await Promise.all(batch.map(async (p)=>{
      if(rendered.has(p)) return;
      try{
        const data = await renderPageToDataURL(p, 1.0);
        rendered.set(p, data);
        replacePageImageInFlip(p, data);
      }catch(e){ console.warn('Background render failed', p, e); }
    }));
    await new Promise(r=>setTimeout(r, BATCH_DELAY));
  }
  backgroundRendering = false;
}

/* Text extraction & TTS */
async function extractPageText(p){
  if(pageTextCache.has(p)) return pageTextCache.get(p);
  const page = await pdfDoc.getPage(p);
  const txt = await page.getTextContent();
  const text = txt.items.map(i => i.str).join(' ').replace(/\s+/g,' ').trim();
  pageTextCache.set(p, text);
  return text;
}

function ensureSpeech(){
  if(!('speechSynthesis' in window)){
    showToast('Speech Synthesis not supported in this browser');
    return false;
  }
  return true;
}

async function startTTSForPage(p, startIdx=0){
  if(!ensureSpeech()) return;
  const text = await extractPageText(p);
  const remaining = text.slice(startIdx);
  if(!remaining){
    if(p < totalPages){ pageFlip.flipNext(); await new Promise(r=>setTimeout(r,600)); startTTSForPage(p+1,0); }
    return;
  }
  speechSynthesis.cancel();
  utterance = new SpeechSynthesisUtterance(remaining);
  const voices = speechSynthesis.getVoices();
  const v = voices.find(x=>x.lang && x.lang.toLowerCase().startsWith('en')) || voices[0];
  if(v) utterance.voice = v;
  utterance.rate = 1.0; utterance.pitch = 1.0;
  utterance.onboundary = (ev)=>{ if(ev && (ev.name==='word' || ev.charIndex>=0)){ speakIndex = startIdx + (ev.charIndex || 0); } };
  utterance.onend = async ()=>{ if(paused) return; speaking=false; paused=false; updateTTS(); if(currentPage < totalPages){ pageFlip.flipNext(); await new Promise(r=>setTimeout(r,650)); startTTSForPage(currentPage+1,0); } };
  utterance.onerror = ()=>{ speaking=false; paused=false; updateTTS(); showToast('TTS error'); };
  speaking = true; paused = false; updateTTS();
  speechSynthesis.speak(utterance);
}

function updateTTS(){
  ttsBtn.textContent = (!speaking || paused) ? '▶ Play' : '⏸ Pause';
}

function toggleTTS(){
  if(!ensureSpeech()) return;
  if(!speaking){ startTTSForPage(currentPage, speakIndex); }
  else if(speaking && !paused){ speechSynthesis.pause(); paused=true; updateTTS(); }
  else { if(speechSynthesis.paused) speechSynthesis.resume(); else startTTSForPage(currentPage, speakIndex); paused=false; updateTTS(); }
}

function stopTTS(silent=false){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  speaking=false; paused=false; speakIndex=0;
  if(!silent) updateTTS();
}

/* Controls wiring */
backBtn.addEventListener('click', ()=>{
  hideReader();
  stopTTS(true);
  try{ pageFlip.destroy(); pageFlip = null; flipbookEl.innerHTML = ''; }catch(e){}
});
prevBtn.addEventListener('click', ()=> pageFlip && pageFlip.flipPrev());
nextBtn.addEventListener('click', ()=> pageFlip && pageFlip.flipNext());
pageRange.addEventListener('input', (e)=>{
  const t = Number(e.target.value);
  if(pageFlip) pageFlip.flip(Math.max(0, t-1));
});
ttsBtn.addEventListener('click', ()=> toggleTTS());
ttsStop.addEventListener('click', ()=> stopTTS());
reloadManifest.addEventListener('click', ()=> buildLibrary());

document.addEventListener('keydown', (e)=>{
  if(readerSection.style.display !== 'block') return;
  if(e.key === 'ArrowRight') pageFlip && pageFlip.flipNext();
  if(e.key === 'ArrowLeft') pageFlip && pageFlip.flipPrev();
  if(e.key === ' ') { e.preventDefault(); toggleTTS(); }
});

/* Init */
(async function init(){
  try{
    await buildLibrary();
  }catch(e){
    console.error('Init failed', e);
    showToast('Init error');
  }
})();
