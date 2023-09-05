try {
  importScripts("service_worker.js");
} catch (e) {
  console.error("error loading service worker", e);
}