# Firestore Schema

## books

Primary searchable book metadata.

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Stable document id |
| title | string | Book title |
| author | string | Author or `Unknown` |
| language | string | english, hindi, bengali, sanskrit, tamil, urdu, marathi |
| category | string | One of the supported student categories |
| tags | array | Subjects and category tags |
| description | string | Source description |
| cover_url | string | Firebase Storage or source cover URL |
| epub_url | string | Preferred reader URL |
| pdf_url | string | PDF fallback URL |
| html_url | string | HTML fallback URL |
| text_url | string | Text fallback URL |
| audio_url | string | Optional future audiobook URL |
| source | string | Source connector name |
| source_id | string | Source-specific id |
| source_url | string | Original source page |
| public_domain | boolean | True for public-domain records |
| copyright_status | string | License/status note |
| pages | number | Optional page count |
| downloads | number | Future analytics |
| views | number | Future analytics |
| rating | number | Future rating |
| search_keywords | array | Lowercase searchable tokens |
| ai_summary | string | AI or source-derived summary |
| checksum | string | Hash for duplicate detection |
| title_author_key | string | Normalized title/author duplicate key |
| created_at | string | ISO timestamp |
| updated_at | string | ISO timestamp |

## automation_logs

Tracks scheduled runs, failures, source statistics, and upload totals.

## trending_searches

Aggregated search terms. The browser does not write here by default; use a backend/admin aggregation flow for protected writes.

## recommendations

Stores related book ids by book id for quick frontend reads.

## user_history

Future authenticated user reading history, keyed by user id.

## videos

Optional legal educational videos from YouTube embeds or public-domain Internet Archive records.
