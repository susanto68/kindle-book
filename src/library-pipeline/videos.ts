import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseServices } from "./firebase.js";

const CURATED_VIDEO_TOPICS = [
  {
    id: "yoga-foundations-youtube",
    title: "Yoga Foundations",
    category: "Yoga",
    source: "YouTube Embed",
    embed_url: "https://www.youtube.com/embed?listType=search&list=yoga%20foundations%20education",
    copyright_status: "Embedded from YouTube; do not download copyrighted video files"
  },
  {
    id: "meditation-basics-youtube",
    title: "Meditation Basics",
    category: "Meditation",
    source: "YouTube Embed",
    embed_url: "https://www.youtube.com/embed?listType=search&list=meditation%20basics%20education",
    copyright_status: "Embedded from YouTube; do not download copyrighted video files"
  },
  {
    id: "science-universe-youtube",
    title: "Universe and Science",
    category: "Science",
    source: "YouTube Embed",
    embed_url: "https://www.youtube.com/embed?listType=search&list=universe%20science%20education",
    copyright_status: "Embedded from YouTube; do not download copyrighted video files"
  }
];

export async function seedEducationalVideoMetadata(): Promise<number> {
  const { db } = getFirebaseServices();
  const batch = db.batch();
  const now = new Date().toISOString();

  CURATED_VIDEO_TOPICS.forEach((video) => {
    batch.set(
      db.collection("videos").doc(video.id),
      {
        ...video,
        created_at: now,
        updated_at: now,
        updated_timestamp: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  await batch.commit();
  return CURATED_VIDEO_TOPICS.length;
}

if (process.argv[1]?.endsWith("videos.ts")) {
  seedEducationalVideoMetadata()
    .then((count) => console.log(`Seeded ${count} educational video records.`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
