chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, postId } = request;
  if (type === 'GET_TOTALS') {
    handleGetTotals().then(sendResponse);
  }
  if (type === 'GET_POST_STATS') {
    handleGetPostStats(postId).then(sendResponse);
  }

  return true; // enable async sendResponse
});

function handleGetTotals() {
  return Promise.all([getStats('me', 'stats'), getStats('me', 'stats/responses')])
    .then(([articles, responses]) => {
      const user = getUser(articles);
      user.id = user.userId;
      user.avatar = user.imageId;
      user.totals = {
        articles: calculateTotals(articles),
        responses: calculateTotals(responses)
      };
      const collections = getCollections(articles);
      return Promise.all(collections.map(c => getStats(c.slug, 'stats')))
        .then(collectionsStats => {
          collections.forEach((c, index) => {
            c.avatar = c.image.imageId;
            c.totals = {
              articles: calculateTotals(collectionsStats[index]),
              responses: calculateTotals()
            }
          });
          return { user, collections };
        });
    });
}

function handleGetPostStats(postId) {
  return getPostStats(postId)
    .then(calculatePostStats)
}

function getStats(user, type) {
  return fetch(`https://medium.com/${user}/${type}?limit=100000`, {
    credentials: "same-origin",
    headers: { accept: 'application/json' }
  })
    .then(res => res.text())
    .then(text => JSON.parse(text.slice(16)))
    .then(data => data.payload);
}

function getPostStats(postId) {
  return fetch(`https://medium.com/stats/${postId}/0/${Date.now()}`, {
    credentials: "same-origin",
    headers: { accept: 'application/json' }
  })
    .then(res => res.text())
    .then(text => JSON.parse(text.slice(16)))
    .then(data => data.payload);
}

function getUser(data) {
  const users = data && data.references &&  data.references.User || {};
  return Object.values(users)[0] || {};
}

function getCollections(data) {
  const collections = data && data.references &&  data.references.Collection || {};
  return Object.values(collections).filter(c => c.virtuals.permissions.canViewStats);
}

function calculateTotals(data) {
  const posts = data && data.value || [];
  const totals = { items: 0, views: 0, syndicatedViews: 0, reads: 0, fans: 0, claps: 0 };
  posts.forEach(article => {
    totals.items++;
    totals.views += article.views;
    totals.syndicatedViews += article.syndicatedViews;
    totals.reads += article.reads;
    totals.fans += article.upvotes;
    totals.claps += article.claps;
  });
  totals.ratio = totals.views === 0 ? 0 : ((totals.reads / totals.views) * 100).toFixed(2);
  totals.posts = posts;
  return totals;
}

function calculatePostStats(data) {
  const stats = data && data.value || [];
  return stats.reduce((result, item) => {
    const date = new Date(item.collectedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    result[key] = result[key] || { views: 0, reads: 0, fans: 0, claps: 0 };
    result[key].views += item.views;
    result[key].reads += item.reads;
    result[key].fans += item.upvotes;
    result[key].claps += item.claps;
    return result;
  }, {});
}