const loggly = new LogglyTracker();
loggly.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  sendConsoleErrors: true,
  tag: 'mes-background'
});

const perf = new LogglyTracker();
perf.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  tag: 'mes-perf'
});

const API_URL = 'https://medium.com';
const timers = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, postId } = request;
  if (type === 'GET_TOTALS') {
    handleGetTotals().then(sendResponse);
  }
  if (type === 'GET_POST_STATS') {
    handleGetPostStats(postId).then(sendResponse);
  }
  if (type === 'GET_NOTIFICATIONS') {
    handleGetNotifications().then(sendResponse);
  }

  return true; // enable async sendResponse
});

chrome.runtime.onInstalled.addListener(details => {
  if (['install', 'update'].includes(details.reason)) {
    const feedbackFormId = '1FAIpQLSdItN10f-8zD6amnFu-WfjTB8rq_ACeHW3r-WRse0N620-UNQ';
    const feedbackFormUrl = `https://docs.google.com/forms/d/e/${feedbackFormId}/viewform`;
    if (chrome.runtime.setUninstallURL) {
      chrome.runtime.setUninstallURL(feedbackFormUrl);
    }
  }
});

function getTotals(url, payload) {
  let finalUrl = `${API_URL}${url}?limit=1000`;
  if (!payload) {
    return request(finalUrl).then(res => getTotals(url, res));
  }
  const { value, paging } = payload;
  if (payload && paging && paging.next && paging.next.to && value && value.length) {
    finalUrl += `&to=${paging.next.to}`;
    return request(finalUrl).then(res => {
      payload.value = [...payload.value, ...res.value];
      payload.paging = res.paging;
      return getTotals(url, payload);
    });
  } else {
    return Promise.resolve(payload);
  }
}

function handleGetTotals() {
  timer('user');
  return Promise.all([
      getTotals('/me/stats'),
      getTotals('/me/stats/responses'),
    ])
    .then(([articles, responses]) => {
      perf.push({ time: timer('user'), type: 'request-user' });
      timer('followers');
      // return request(`${API_URL}/@${getUser(articles).username}/followers`)
      //   .then(followers => ([articles, responses, followers]))
      return [articles, responses, {}]
    })
    .then(([articles, responses, followers]) => {
      console.log(articles, responses);
      perf.push({ time: timer('followers'), type: 'request-followers' });
      const user = getUser(articles);
      user.id = user.userId;
      user.isMember = user.mediumMemberAt !== 0;
      user.followers = getFollowers(followers);
      user.avatar = user.imageId;
      user.totals = {
        articles: calculateTotals(articles),
        responses: calculateTotals(responses)
      };
      user.export = {
        articles: articles.value,
        responses: responses.value
      };
      const collections = getCollections(articles);
      timer('collections');
      return Promise.all(collections.map(c => getTotals(`/${c.slug}/stats`)))
        .then(collectionsStats => {
          collections.forEach((c, index) => {
            c.followers = c.metadata.followerCount;
            c.avatar = c.image.imageId;
            c.totals = {
              articles: calculateTotals(collectionsStats[index]),
              responses: calculateTotals()
            }
          });
          perf.push({ time: timer('collections'), type: 'request-collections' });
          return { user, collections };
        });
    });
}

function handleGetPostStats(postId) {
  timer('post-stats');
  return request(`${API_URL}/stats/${postId}/0/${Date.now()}`)
    .then(data => {
      perf.push({ time: timer('post-stats'), type: 'request-post-stats' });
      return calculatePostStats(data);
    });
}

function handleGetNotifications() {
  timer('notifications');
  return Promise.all([
    request(`${API_URL}/_/activity-status`),
    request(`${API_URL}/me/activity?limit=50`)
  ]).then(([status, activity])=> {
    perf.push({ time: timer('notifications'), type: 'request-notifications' });
    const TYPES = {
      post_recommended: 'fan',
      post_recommended_rollup: 'fan',
      response_created: 'response',
      post_recommended_milestone: 'milestone reached',
      users_following_you_rollup: 'follower',
      users_following_you: 'follower',
      quote: 'highlight',
      quote_rollup: 'highlight',
      mention_in_post: 'mention',
      note_replied: 'note',
      post_noted: 'note',
    };
    const count = status.value.unreadActivityCount;
    return activity.value.slice(0, count).reduce((result, item) => {
      const type = TYPES[item.activityType] || 'unknown';
      const count = item.rollupItems ? item.rollupItems.length : 1;
      result[type] = result[type] ? result[type] += count : count;
      return result;
    }, {});
  });
}

function request(url) {
  return fetch(url, { credentials: "same-origin", headers: { accept: 'application/json' } })
    .then(res => res.text())
    .then(text => {
      console.log(text.slice(16, 100));
      return JSON.parse(text.slice(16)).payload
    })

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
  const followers = data && data.references && data.references.SocialStats || {};
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
  totals.clapsPerViewsRatio = totals.fans === 0 ? 0 : ((totals.claps / totals.views) * 100).toFixed(2);
  totals.fansPerReadsRatio = totals.fans === 0 ? 0 : ((totals.fans / totals.reads) * 100).toFixed(2);
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

function timer(id) {
  if (!timers[id]) {
    timers[id] = window.performance.now();
  } else {
    const result = window.performance.now() - timers[id];
    delete timers[id];
    return result;
  }
}
