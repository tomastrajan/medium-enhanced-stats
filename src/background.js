const API_URL = 'https://medium.com';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, postId, username } = request;
  if (type === 'GET_TOTALS') {
    handleGetTotals().then(sendResponse);
  }
  if (type === 'GET_POST_STATS') {
    handleGetPostStats(postId).then(sendResponse);
  }

  return true; // enable async sendResponse
});

function handleGetTotals() {
  return Promise.all([
      request(`${API_URL}/me/stats?limit=100000`),
      request(`${API_URL}/me/stats/responses?limit=100000`)
    ])
    .then(([articles, responses]) =>
      request(`${API_URL}/@${getUser(articles).username}/followers`)
        .then(followers => ([articles, responses, followers]))
    )
    .then(([articles, responses, followers]) => {
      const user = getUser(articles);
      user.id = user.userId;
      user.followers = getFollowers(followers);
      user.avatar = user.imageId;
      user.totals = {
        articles: calculateTotals(articles),
        responses: calculateTotals(responses)
      };
      const collections = getCollections(articles);
      return Promise.all(collections.map(c => request(`${API_URL}/${c.slug}/stats?limit=100000`)))
        .then(collectionsStats => {
          collections.forEach((c, index) => {
            c.followers = c.metadata.followerCount;
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
  return request(`${API_URL}/stats/${postId}/0/${Date.now()}`)
    .then(calculatePostStats);
}

function request(url) {
  return fetch(url, { credentials: "same-origin", headers: { accept: 'application/json' } })
    .then(res => res.text())
    .then(text => JSON.parse(text.slice(16)).payload)
}

function getUser(data) {
  const users = data && data.references &&  data.references.User || {};
  return Object.values(users)[0] || {};
}

function getCollections(data) {
  const collections = data && data.references &&  data.references.Collection || {};
  return Object.values(collections).filter(c => c.virtuals.permissions.canViewStats);
}

function getFollowers(data) {
  const followers = data && data.references && data.references.SocialStats;
  return (Object.values(followers)[0] || {}).usersFollowedByCount;
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
  totals.clapsPerFan = totals.fans === 0 ? 0 : (totals.claps / totals.fans).toFixed(2);
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