# Automated Gutenberg Library Updates

This project can grow the bookshelf automatically with public-domain books from Gutendex / Project Gutenberg.

## What Runs

- `.github/workflows/update-gutenberg-library.yml` runs daily and weekly.
- `tools/gutendex_downloader.mjs` fetches Gutendex metadata, downloads EPUB files, downloads cover images, and updates `books.gutenberg.json`.
- Vercel redeploys automatically after GitHub receives the workflow commit.

## Safety Limits

The workflow is intentionally conservative:

- `GUTENBERG_MAX_PER_CATEGORY=1`
- `GUTENBERG_MAX_TOTAL=20`

This prevents the repository from suddenly downloading thousands of books in one run. Use the manual workflow inputs to increase these limits when needed.

## Generated Files

- Downloaded EPUBs and covers: `books/Gutenberg/<Category>/`
- Metadata used by the website: `books.gutenberg.json`
- Download cache and duplicate tracking: `books/.gutenberg-cache.json`

## Local Dry Run

```bash
node tools/gutendex_downloader.mjs --dry-run --max-per-category=1 --max-total=5
```

## Local Download

```bash
node tools/gutendex_downloader.mjs --max-per-category=1 --max-total=5
```
