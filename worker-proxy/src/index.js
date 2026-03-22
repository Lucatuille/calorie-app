// ============================================================
//  Caliro — Frontend Proxy Worker
//  Routes caliro.dev/* → calorie-app.pages.dev
//  More resilient than Pages custom domain binding
// ============================================================

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'calorie-app.pages.dev';
    return fetch(new Request(url.toString(), request));
  },
};
