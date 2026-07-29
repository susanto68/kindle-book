# Automated Gutenberg Library Updates

This project can grow the bookshelf automatically with public-domain books from Gutendex / Project Gutenberg.

## What Runs

- `.github/workflows/update-gutenberg-library.yml` runs once every hour.
- `tools/gutendex_downloader.mjs` fetches Gutendex metadata, downloads GitHub-safe EPUB files, downloads cover images, and updates `books.gutenberg.json`.
- Oversized EPUBs are added as online-only Project Gutenberg records when an HTML/text/source reader is available, so a large book does not block the whole update.
- Vercel redeploys automatically after GitHub receives the workflow commit.

## Safety Limits

The workflow is intentionally conservative and mobile-friendly:

- `GUTENBERG_MAX_PER_CATEGORY=1`
- `GUTENBERG_MAX_TOTAL=2`
- `GUTENBERG_MIN_TOTAL_BOOKS=50`

This grows the library gently by two books per hour while keeping a 50-book target visible in logs. Use the manual workflow inputs to increase these limits when needed.

Manual books can still be uploaded safely. The automation only writes to `books/Gutenberg/**`, `books.gutenberg.json`, and `books/.gutenberg-cache.json`, so manually added books in other folders are not overwritten.

Books larger than the GitHub file limit are not stored in the repository. Their metadata stays in the catalog with legal external reading links, which keeps the student library free and scalable.

## Generated Files

- Downloaded EPUBs and covers: `books/Gutenberg/<Category>/`
- Metadata used by the website: `books.gutenberg.json`
- Download cache and duplicate tracking: `books/.gutenberg-cache.json`

## Local Dry Run

```bash
node tools/gutendex_downloader.mjs --dry-run --max-per-category=1 --max-total=2
```

## Local Download

```bash
node tools/gutendex_downloader.mjs --max-per-category=1 --max-total=2
```
