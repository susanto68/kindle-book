import { DEFAULT_TOPICS, PIPELINE_CONFIG, hasFirebaseAdminConfig } from "./config.js";
import {
  findDuplicate,
  logAutomation,
  readTrendingSeeds,
  saveBookMetadata,
  summarizePipelineResults,
  uploadBookAssets
} from "./firebase.js";
import { sourceConnectors } from "./sources.js";
import type { PipelineRunContext, PipelineRunResult, SearchSeed, SourceCandidate } from "./types.js";
import { generateAISummary, isLegallyAllowed, normalizeBook } from "./utils.js";

function parseArgs(): { dryRun: boolean; maxBooks: number } {
  const args = new Set(process.argv.slice(2));
  const maxArg = process.argv.find((arg) => arg.startsWith("--max="));
  return {
    dryRun: args.has("--dry-run") || process.env.LIBRARY_DRY_RUN === "true",
    maxBooks: maxArg ? Number(maxArg.split("=")[1]) : PIPELINE_CONFIG.maxBooksPerRun
  };
}

async function buildSeeds(): Promise<SearchSeed[]> {
  const trending: string[] = await readTrendingSeeds().catch((): string[] => []);
  const topicSet = new Set([...trending, ...DEFAULT_TOPICS]);
  return Array.from(topicSet)
    .filter((topic) => topic.length >= 3)
    .slice(0, 40)
    .map((topic) => ({
      topic,
      reason: trending.includes(topic) ? "trending" : "default"
    }));
}

function candidateHasReadableAsset(candidate: SourceCandidate): boolean {
  return Boolean(candidate.epubUrl || candidate.pdfUrl || candidate.htmlUrl || candidate.textUrl || candidate.sourceUrl);
}

async function processCandidate(candidate: SourceCandidate, context: PipelineRunContext): Promise<"uploaded" | "skipped"> {
  if (!isLegallyAllowed(candidate) || !candidateHasReadableAsset(candidate)) {
    return "skipped";
  }

  const summary = await generateAISummary(candidate, PIPELINE_CONFIG.openAiApiKey);
  const normalized = normalizeBook(candidate, summary);

  if (!context.languages.includes(normalized.language)) {
    return "skipped";
  }

  if (context.dryRun || !hasFirebaseAdminConfig()) {
    console.log(`[dry-run] ${normalized.title} -> ${normalized.category}/${normalized.language}`);
    return "uploaded";
  }

  const duplicateId = await findDuplicate(normalized);
  if (duplicateId) {
    console.log(`Skipping duplicate ${normalized.title} (${duplicateId})`);
    return "skipped";
  }

  const withAssets = await uploadBookAssets(normalized, candidate);
  await saveBookMetadata(withAssets);
  console.log(`Uploaded ${withAssets.title} (${withAssets.id})`);
  return "uploaded";
}

async function runConnector(seed: SearchSeed, context: PipelineRunContext): Promise<PipelineRunResult[]> {
  const results: PipelineRunResult[] = [];

  for (const connector of sourceConnectors) {
    const result: PipelineRunResult = {
      source: connector.name,
      fetched: 0,
      accepted: 0,
      skipped: 0,
      uploaded: 0,
      errors: []
    };

    try {
      const candidates = (await connector.search(seed, context)).slice(0, context.booksPerSource);
      result.fetched = candidates.length;
      for (const candidate of candidates) {
        if (context.maxBooks <= 0) break;
        try {
          const status = await processCandidate(candidate, context);
          if (status === "uploaded") {
            result.accepted += 1;
            result.uploaded += 1;
            context.maxBooks -= 1;
          } else {
            result.skipped += 1;
          }
        } catch (error) {
          result.errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    results.push(result);
    if (context.maxBooks <= 0) break;
  }

  return results;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const seeds = await buildSeeds();
  const context: PipelineRunContext = {
    dryRun: args.dryRun,
    maxBooks: args.maxBooks,
    booksPerSource: PIPELINE_CONFIG.booksPerSource,
    languages: PIPELINE_CONFIG.languages,
    seeds
  };

  if (!context.dryRun && !hasFirebaseAdminConfig()) {
    throw new Error(
      "Firebase Admin config is missing. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY as GitHub Actions secrets, or run with --dry-run."
    );
  }

  await logAutomation("started", {
    dryRun: context.dryRun,
    maxBooks: context.maxBooks,
    seedCount: seeds.length
  });

  const allResults: PipelineRunResult[] = [];
  try {
    for (const seed of seeds) {
      if (context.maxBooks <= 0) break;
      const results = await runConnector(seed, context);
      allResults.push(...results);
    }
    await summarizePipelineResults(allResults);
  } catch (error) {
    await logAutomation("failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
