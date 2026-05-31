# Firebase AI Digital Library Pipeline

This extension keeps the existing static Kindle reader, GitHub deployment, Vercel hosting, PWA service worker, and current Gutenberg automation intact. It adds a separate Firebase-first library pipeline so the repository can stay lightweight while the library grows in Firestore. On Firebase Spark/free plan, the pipeline stores metadata and public source URLs only. Firebase Storage uploads are optional and should stay disabled unless you move to Blaze.

## What It Adds

- Multi-source legal book discovery modules for Project Gutenberg, Internet Archive, Open Library, Wikisource, Sacred Texts Archive, Digital Library of India placeholder, Gita Supersite, OpenStax, and DOAB.
- Spark/free plan metadata-only mode using Firestore plus original public EPUB/PDF/cover URLs.
- Optional Firebase Storage uploads under `books/`, `covers/`, `audio/`, `videos/`, and `metadata/` when `LIBRARY_METADATA_ONLY=false` and a Storage bucket is configured.
- Firestore metadata under `books`, `authors`, `categories`, `trending_searches`, `user_history`, `recommendations`, and `automation_logs`.
- Duplicate detection by source id, title/author key, and checksum.
- Optional AI summaries through `GEMINI_API_KEY`, `GROQ_API_KEY`, or `OPENAI_API_KEY`; otherwise summaries are generated from source descriptions.
- Hidden dashboard at `admin.html`.
- Browser catalog fallback: the website tries Firebase metadata first and then keeps using `books.json` and `books.gutenberg.json`.

## Firebase Storage Layout

```text
books/
  english/
  hindi/
  bengali/
  sanskrit/
  tamil/
  urdu/
  marathi/
covers/
audio/
videos/
metadata/
```

## Firestore Book Fields

Each document in `books` contains:

```text
id, title, author, language, category, tags, description, cover_url,
epub_url, pdf_url, html_url, text_url, audio_url, source, source_id,
source_url, public_domain, copyright_status, pages, downloads, views,
rating, search_keywords, ai_summary, checksum, title_author_key,
created_at, updated_at
```

## GitHub Secrets

Add these repository secrets before enabling the workflow on the Spark/free plan:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
GEMINI_API_KEY
GROQ_API_KEY
OPENAI_API_KEY
```

AI keys are optional. When configured, summaries try Gemini first, then Groq fallback models `llama-3.3-70b-versatile` and `deepseek-r1-distill-llama-70b`, then OpenAI, then deterministic summaries.

`FIREBASE_STORAGE_BUCKET` is optional and should be left unused on Spark/free plan. New Firebase Storage buckets require the Blaze plan, so the default workflow uses `LIBRARY_METADATA_ONLY=true`.

## GitHub Actions

The new workflow is `.github/workflows/firebase-library-pipeline.yml`.

- Runs every 6 hours.
- Can be run manually with `workflow_dispatch`.
- Downloads books temporarily during the job.
- Saves EPUB/PDF/cover public source URLs into Firestore in Spark/free mode.
- Uploads EPUB/PDF/covers/metadata to Firebase Storage only when metadata-only mode is disabled.
- Saves metadata to Firestore.
- Does not commit downloaded books back into GitHub.

The existing Gutenberg workflow remains unchanged and continues to support the current GitHub-hosted catalog.

## Local Commands

Install dependencies:

```bash
npm install
```

Dry-run discovery:

```bash
npm run library:dry-run
```

Run with Firestore metadata writes:

```bash
npm run library:sync -- --max=25
```

Refresh recommendation documents:

```bash
npm run library:recommendations
```

Preview migration records for existing GitHub books:

```bash
npm run library:migrate-github
```

## Firebase Rules

Deploy the included rules only if you use Firebase Storage or want to manage Firestore rules from this repo:

```bash
firebase deploy --only firestore:rules,storage
```

The rules allow public reads for library content and require admin claims for writes. Firestore itself must be created/enabled in the Firebase Console first.

## Frontend Integration

The homepage loads:

```html
<script src="firebase-config.js"></script>
<script src="firebase-library.js?v=38"></script>
```

`firebase-config.js` is committed as an empty safe stub. Add the values from `firebase-config.example.js` when Firebase browser metadata should be enabled. If the config stays empty, the site silently falls back to the existing GitHub JSON catalogs.

## Legal Safety

Connectors are designed to include only public-domain, Creative Commons, or open-access records. The Digital Library of India connector is disabled by default until source-specific license rules are confirmed. Do not add connectors that bypass DRM, scrape commercial books, or download copyrighted files.

## Manual Uploads

Manual uploads can continue:

- GitHub books stay in `books.json` and `books.gutenberg.json`.
- Firebase books are appended through Firestore metadata.
- The frontend reads Firebase first and falls back to GitHub, so both systems coexist.

## Admin Dashboard

Open `admin.html` after configuring `firebase-config.js`. It shows:

- Total books
- Recent uploads
- Automation logs
- Trending searches
- Source statistics

For production, protect `admin.html` at the hosting layer or require authenticated admin-only reads if sensitive operational data is added.
