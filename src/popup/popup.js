const $table = document.querySelector('table');
const $tableStatsCells = document.querySelectorAll('table tr:last-child td');
const $year = document.querySelector('.year');
const $openStatsButton = document.querySelector('.open-stats');

$openStatsButton.addEventListener('click', () => {
  const url = 'https://medium.com/me/stats';
  chrome.tabs.create({ url });
});

$year.textContent = (new Date()).getFullYear();

chrome.tabs.getSelected(null, tab => {
  if (tab && tab.url && isMediumStatsUrl(tab.url)) {
    chrome.tabs.sendMessage(tab.id, { type: "GET_TOTALS" });
  }
});

chrome.runtime.onMessage.addListener(request => {
  if (request.type === 'TOTALS' && request.totals) {
    updateStatsTable(request.totals)
  }
});

function updateStatsTable(totals) {
  const { articles, views, reads, fans, ratio } = totals;
  $table.style.display = 'table';
  $tableStatsCells[0].textContent = formatValue(articles);
  $tableStatsCells[1].textContent = formatValue(views);
  $tableStatsCells[2].textContent = formatValue(reads);
  $tableStatsCells[3].textContent = formatValue(ratio, 2) + '%';
  $tableStatsCells[4].textContent = formatValue(fans);
}

function isMediumStatsUrl(url) {
  return /medium\.com\/(.*)?\/stats/ig.test(url);
}

function formatValue(number, precision = 0) {
  return number > 1000
    ? (number / 1000).toFixed(1) + 'K'
    : number.toFixed(precision);
}