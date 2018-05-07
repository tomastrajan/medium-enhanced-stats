const $loading = document.querySelector('.loading');
const $table = document.querySelector('table');
const $year = document.querySelector('.year');
const $buttonOpenStats = document.querySelector('.open-stats');
const $buttonRefreshStats = document.querySelector('.refresh-stats');

init();
$buttonRefreshStats.addEventListener('click', () => init());
$buttonOpenStats.addEventListener('click', () => openStatsPage());
$year.textContent = (new Date()).getFullYear();

function init() {
  $loading.style.display = 'block';
  $table.style.display = 'none';
  chrome.runtime.sendMessage({ type: 'GET_TOTALS'}, {}, data => {
    updateStatsTable('articles', data.articles);
    updateStatsTable('responses', data.responses)
  });
}

function updateStatsTable(type,totals) {
  const { items, views, reads, fans, claps, ratio } = totals;
  const $cols = $table.querySelectorAll(`.${type} td`);
  $cols[0].textContent = `${type.slice(0, 1).toUpperCase()}${type.slice(1)}`;
  $cols[1].textContent = formatValue(items);
  $cols[2].textContent = formatValue(views);
  $cols[3].textContent = formatValue(reads);
  $cols[4].textContent = ratio + '%';
  $cols[5].textContent = formatValue(fans);
  $cols[6].textContent = formatValue(claps);
  $loading.style.display = 'none';
  $table.style.display = 'table';
}

function formatValue(number) {
  return number > 1000
    ? (number / 1000).toFixed(1) + 'K'
    : number.toFixed(0);
}

function openStatsPage() {
  chrome.tabs.create({ url: 'https://medium.com/me/stats' });
}
