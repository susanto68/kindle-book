import { saveRecommendations } from "./firebase.js";

saveRecommendations()
  .then((count) => {
    console.log(`Updated recommendations for ${count} books.`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
