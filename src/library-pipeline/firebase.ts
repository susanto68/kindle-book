import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { PIPELINE_CONFIG, hasFirebaseAdminConfig } from "./config.js";
import type { NormalizedBook, PipelineRunResult, SourceCandidate } from "./types.js";
import {
  contentTypeForExtension,
  downloadBuffer,
  extensionFromUrl,
  sha256Buffer,
  toStoragePath
} from "./utils.js";

let dbInstance: Firestore | null = null;
type StorageBucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;
let bucketInstance: StorageBucket | null = null;

export function getFirebaseServices(): { db: Firestore; bucket: StorageBucket } {
  if (!hasFirebaseAdminConfig()) {
    throw new Error("Firebase Admin config is missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and FIREBASE_STORAGE_BUCKET.");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: PIPELINE_CONFIG.projectId,
        clientEmail: PIPELINE_CONFIG.clientEmail,
        privateKey: PIPELINE_CONFIG.privateKey
      }),
      storageBucket: PIPELINE_CONFIG.storageBucket
    });
  }

  dbInstance ||= getFirestore();
  bucketInstance ||= getStorage().bucket();
  return { db: dbInstance, bucket: bucketInstance };
}

async function uploadPublicBuffer(path: string, buffer: Buffer, contentType: string): Promise<string> {
  const { bucket } = getFirebaseServices();
  const file = bucket.file(path);
  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable"
    }
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
}

export async function findDuplicate(book: NormalizedBook): Promise<string | null> {
  const { db } = getFirebaseServices();
  const byId = await db.collection("books").doc(book.id).get();
  if (byId.exists) return book.id;

  const bySource = await db
    .collection("books")
    .where("source", "==", book.source)
    .where("source_id", "==", book.source_id)
    .limit(1)
    .get();
  if (!bySource.empty) return bySource.docs[0].id;

  const byTitle = await db
    .collection("books")
    .where("title_author_key", "==", book.title_author_key)
    .limit(1)
    .get();
  return byTitle.empty ? null : byTitle.docs[0].id;
}

export async function uploadBookAssets(book: NormalizedBook, candidate: SourceCandidate): Promise<NormalizedBook> {
  const updated = { ...book };
  const readableUrl = candidate.epubUrl || candidate.pdfUrl || candidate.htmlUrl || candidate.textUrl;

  if (candidate.epubUrl || candidate.pdfUrl) {
    const url = candidate.epubUrl || candidate.pdfUrl || "";
    const extension = candidate.epubUrl ? "epub" : "pdf";
    const buffer = await downloadBuffer(url);
    updated.checksum = sha256Buffer(buffer);
    const storagePath = toStoragePath("book", updated, extension);
    const publicUrl = await uploadPublicBuffer(storagePath, buffer, contentTypeForExtension(extension));
    if (extension === "epub") {
      updated.epub_url = publicUrl;
    } else {
      updated.pdf_url = publicUrl;
    }
  } else if (readableUrl) {
    updated.html_url = candidate.htmlUrl || candidate.textUrl || readableUrl;
  }

  if (candidate.coverUrl) {
    try {
      const extension = extensionFromUrl(candidate.coverUrl, "jpg");
      const buffer = await downloadBuffer(candidate.coverUrl);
      updated.cover_url = await uploadPublicBuffer(
        toStoragePath("cover", updated, extension),
        buffer,
        contentTypeForExtension(extension)
      );
    } catch (error) {
      console.warn(`Cover upload skipped for ${book.title}:`, error);
    }
  }

  const metadataBuffer = Buffer.from(JSON.stringify(updated, null, 2));
  await uploadPublicBuffer(toStoragePath("metadata", updated, "json"), metadataBuffer, "application/json; charset=utf-8");
  return updated;
}

export async function saveBookMetadata(book: NormalizedBook): Promise<void> {
  const { db } = getFirebaseServices();
  await db.collection("books").doc(book.id).set(
    {
      ...book,
      updated_at: new Date().toISOString(),
      updated_timestamp: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function readTrendingSeeds(): Promise<string[]> {
  if (!hasFirebaseAdminConfig()) {
    return [];
  }
  const { db } = getFirebaseServices();
  const snapshot = await db.collection("trending_searches").orderBy("count", "desc").limit(20).get();
  return snapshot.docs
    .map((doc) => String(doc.get("query") || doc.id || "").trim())
    .filter((query) => query.length >= 3);
}

export async function logAutomation(status: "started" | "completed" | "failed", payload: Record<string, unknown>): Promise<void> {
  if (!hasFirebaseAdminConfig()) {
    console.log(`[automation:${status}]`, JSON.stringify(payload));
    return;
  }
  const { db } = getFirebaseServices();
  await db.collection("automation_logs").add({
    status,
    ...payload,
    created_at: new Date().toISOString(),
    created_timestamp: FieldValue.serverTimestamp()
  });
}

export async function saveRecommendations(): Promise<number> {
  const { db } = getFirebaseServices();
  const snapshot = await db.collection("books").orderBy("updated_at", "desc").limit(500).get();
  const books = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Array<NormalisedFirestoreBook>;
  const batch = db.batch();
  let written = 0;

  for (const book of books) {
    const related = books
      .filter((candidate) => candidate.id !== book.id)
      .filter((candidate) => candidate.category === book.category || candidate.language === book.language)
      .slice(0, 10)
      .map((candidate) => candidate.id);
    batch.set(
      db.collection("recommendations").doc(book.id),
      {
        book_id: book.id,
        related_books: related,
        category: book.category,
        language: book.language,
        updated_at: new Date().toISOString(),
        updated_timestamp: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    written += 1;
  }

  if (written) {
    await batch.commit();
  }
  return written;
}

export async function summarizePipelineResults(results: PipelineRunResult[]): Promise<void> {
  const totals = results.reduce(
    (sum, item) => ({
      fetched: sum.fetched + item.fetched,
      accepted: sum.accepted + item.accepted,
      skipped: sum.skipped + item.skipped,
      uploaded: sum.uploaded + item.uploaded,
      errors: sum.errors + item.errors.length
    }),
    { fetched: 0, accepted: 0, skipped: 0, uploaded: 0, errors: 0 }
  );
  await logAutomation("completed", { results, totals });
}

type NormalisedFirestoreBook = {
  id: string;
  category?: string;
  language?: string;
};
