chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_TOTALS') {
    const response = {};
    getStats('stats')
      .then(stats => calculateTotals(stats))
      .then(totals => response.articles = totals)
      .then(() => getStats('stats/responses'))
      .then(stats => calculateTotals(stats))
      .then(totals => response.responses = totals)
      .then(() => sendResponse(response));
    return true; // enable async sendResponse
  }
});

function getStats(type) {
  return fetch(`https://medium.com/me/${type}?limit=100000`, {
    credentials: "same-origin",
    headers: { accept: 'application/json' }
  })
    .then(res => res.text())
    .then(text => JSON.parse(text.slice(16)));
}

function calculateTotals(data) {
  const totals = { items: 0, views: 0, syndicatedViews: 0, reads: 0, fans: 0, claps: 0 };
  data.payload.value.forEach(article => {
    totals.items++;
    totals.views += article.views;
    totals.syndicatedViews += article.syndicatedViews;
    totals.reads += article.reads;
    totals.fans += article.upvotes;
    totals.claps += article.claps;
  });
  totals.ratio = ((totals.reads / totals.views) * 100).toFixed(2);
  return totals;
}
