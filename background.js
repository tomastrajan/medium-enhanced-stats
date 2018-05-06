chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
              hostEquals: 'medium.com',
              urlContains: 'stats'
            },
          })
        ],
        actions: [ new chrome.declarativeContent.ShowPageAction() ]
      }
    ]);
  });
});

chrome.runtime.onMessage.addListener(request => {
  const { views, reads, fans, ratio } = request;
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tabId = tabs && tabs[0] && tabs[0].id;
    if (tabId) {
      chrome.pageAction.setTitle({
        tabId,
        title: `
          Your total Medium stats
Views: ${formatValue(views)}
Reads: ${formatValue(reads)}
Fans: ${formatValue(fans)}
Ratio (wa): ${ratio}%
        `
      })
    }
  });
});

function formatValue(number) {
  return number > 1000
    ? (number / 1000).toFixed(1) + 'K'
    : number;
}
