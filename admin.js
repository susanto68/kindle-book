(function () {
  const FIREBASE_CDN = "https://www.gstatic.com/firebasejs/10.12.5";
  const ids = {
    notice: document.getElementById("adminNotice"),
    totalBooks: document.getElementById("totalBooks"),
    recentUploads: document.getElementById("recentUploads"),
    trendingCount: document.getElementById("trendingCount"),
    lastAutomation: document.getElementById("lastAutomation"),
    recentBooks: document.getElementById("recentBooks"),
    automationLogs: document.getElementById("automationLogs"),
    trendingSearches: document.getElementById("trendingSearches"),
    sourceStats: document.getElementById("sourceStats")
  };

  function setNotice(message) {
    ids.notice.hidden = false;
    ids.notice.textContent = message;
  }

  async function loadFirebase() {
    if (!window.KINDLE_FIREBASE_CONFIG) {
      throw new Error("Missing firebase-config.js. Copy firebase-config.example.js and add your Firebase web config.");
    }
    const [{ initializeApp, getApps }, firestore] = await Promise.all([
      import(`${FIREBASE_CDN}/firebase-app.js`),
      import(`${FIREBASE_CDN}/firebase-firestore.js`)
    ]);
    const app = getApps().length ? getApps()[0] : initializeApp(window.KINDLE_FIREBASE_CONFIG);
    return {
      db: firestore.getFirestore(app),
      ...firestore
    };
  }

  async function getCollection(firebase, name, max = 20) {
    const q = firebase.query(firebase.collection(firebase.db, name), firebase.limit(max));
    const snapshot = await firebase.getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function getRecent(firebase, name, field, max = 20) {
    try {
      const q = firebase.query(firebase.collection(firebase.db, name), firebase.orderBy(field, "desc"), firebase.limit(max));
      const snapshot = await firebase.getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch {
      return getCollection(firebase, name, max);
    }
  }

  function renderList(node, items, emptyText) {
    node.innerHTML = "";
    if (!items.length) {
      node.innerHTML = `<div class="list-item"><strong>${emptyText}</strong></div>`;
      return;
    }
    items.forEach((item) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `<strong>${item.title || item.status || item.query || item.id}</strong><span>${item.category || item.source || item.created_at || item.updated_at || ""}</span>`;
      node.appendChild(div);
    });
  }

  function renderChips(node, items, labelField) {
    node.innerHTML = "";
    items.forEach((item) => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = item[labelField] || item.id;
      node.appendChild(span);
    });
  }

  function renderSourceStats(node, books) {
    const stats = new Map();
    books.forEach((book) => stats.set(book.source || "Unknown", (stats.get(book.source || "Unknown") || 0) + 1));
    node.innerHTML = "";
    Array.from(stats.entries()).forEach(([source, count]) => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = `${source}: ${count}`;
      node.appendChild(span);
    });
  }

  async function init() {
    try {
      const firebase = await loadFirebase();
      const [books, recentBooks, logs, trends] = await Promise.all([
        getCollection(firebase, "books", 500),
        getRecent(firebase, "books", "updated_at", 12),
        getRecent(firebase, "automation_logs", "created_at", 12),
        getRecent(firebase, "trending_searches", "count", 20)
      ]);

      ids.totalBooks.textContent = String(books.length);
      ids.recentUploads.textContent = String(recentBooks.length);
      ids.trendingCount.textContent = String(trends.length);
      ids.lastAutomation.textContent = logs[0]?.status || "-";
      renderList(ids.recentBooks, recentBooks, "No uploads yet");
      renderList(ids.automationLogs, logs, "No automation logs yet");
      renderChips(ids.trendingSearches, trends, "query");
      renderSourceStats(ids.sourceStats, books);
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  init();
})();
