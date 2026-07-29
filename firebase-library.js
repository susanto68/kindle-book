(function () {
  const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/10.12.5";
  const MAX_FIREBASE_BOOKS = 1200;

  function hasConfig() {
    return Boolean(window.KINDLE_FIREBASE_CONFIG && window.KINDLE_FIREBASE_CONFIG.projectId);
  }

  async function loadFirebaseModules() {
    const [{ initializeApp, getApps }, { getFirestore, collection, getDocs, limit, orderBy, query, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment }] =
      await Promise.all([
        import(`${FIREBASE_CDN}/firebase-app.js`),
        import(`${FIREBASE_CDN}/firebase-firestore.js`)
      ]);

    const app = getApps().length ? getApps()[0] : initializeApp(window.KINDLE_FIREBASE_CONFIG);
    const db = getFirestore(app);
    return { db, collection, getDocs, limit, orderBy, query, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment };
  }

  function pickReadableUrl(book) {
    return book.epub_url || book.pdf_url || book.html_url || book.text_url || book.source_url || "";
  }

  function getFormat(book) {
    if (book.epub_url) return "epub";
    if (book.pdf_url) return "pdf";
    if (book.html_url) return "html";
    if (book.text_url) return "text";
    return "html";
  }

  function toLibraryGroups(records) {
    const groups = new Map();
    records.forEach((record) => {
      const category = record.category || "Firebase Library";
      if (!groups.has(category)) {
        groups.set(category, { class: category, books: [] });
      }
      const file = pickReadableUrl(record);
      if (!file) {
        return;
      }
      groups.get(category).books.push({
        id: record.id,
        title: record.title || "Untitled Book",
        author: record.author || "Unknown",
        category,
        class: category,
        file,
        epubFile: record.epub_url || "",
        cover: record.cover_url || "",
        format: getFormat(record),
        source: record.source || "Firebase",
        sourceUrl: record.source_url || "",
        firebaseId: record.id,
        aiSummary: record.ai_summary || record.description || ""
      });
    });
    return Array.from(groups.values());
  }

  async function loadBooks() {
    if (!hasConfig()) {
      return [];
    }

    try {
      const firebase = await loadFirebaseModules();
      const q = firebase.query(
        firebase.collection(firebase.db, "books"),
        firebase.orderBy("updated_at", "desc"),
        firebase.limit(MAX_FIREBASE_BOOKS)
      );
      const snapshot = await firebase.getDocs(q);
      const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return toLibraryGroups(records);
    } catch (error) {
      console.info("Firebase library metadata is not available yet.", error);
      return [];
    }
  }

  let trackTimer = null;

  function trackSearch(queryText, category) {
    if (!hasConfig() || window.KINDLE_FIREBASE_PUBLIC_TRACKING !== true) {
      return;
    }
    const queryValue = String(queryText || "").trim().toLowerCase();
    if (queryValue.length < 3) {
      return;
    }
    clearTimeout(trackTimer);
    trackTimer = setTimeout(async () => {
      try {
        const firebase = await loadFirebaseModules();
        await firebase.addDoc(firebase.collection(firebase.db, "trending_searches_raw"), {
          query: queryValue,
          category: category || "",
          created_at: new Date().toISOString(),
          created_timestamp: firebase.serverTimestamp()
        });
      } catch (error) {
        console.info("Search tracking is disabled or blocked by Firestore rules.", error);
      }
    }, 900);
  }

  async function trackVisitors() {
    if (!hasConfig()) {
      return null;
    }
    try {
      const firebase = await loadFirebaseModules();
      const docRef = firebase.doc(firebase.db, "counters", "visitors");
      
      const sessionKey = "kindleReader.visitedThisSession";
      if (!sessionStorage.getItem(sessionKey)) {
        try {
          await firebase.updateDoc(docRef, { count: firebase.increment(1) });
        } catch (e) {
          // Document might not exist, initialize it
          await firebase.setDoc(docRef, { count: 1 });
        }
        sessionStorage.setItem(sessionKey, "true");
      }
      
      const docSnap = await firebase.getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().count || 1;
      }
      return 1;
    } catch (error) {
      console.info("Firebase visitor tracking failed or is blocked by Firestore rules.", error);
      return null;
    }
  }

  window.kindleFirebaseLibrary = {
    loadBooks,
    trackSearch,
    trackVisitors
  };
})();
