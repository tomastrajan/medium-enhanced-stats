const $body = document.querySelector('body');
const $table = document.querySelector('table');
const $year = document.querySelector('.year');
const $version = document.querySelector('.version');
const $buttonOpenStats = document.querySelector('.open-stats');
const $buttonRefreshStats = document.querySelector('.refresh-stats');

$year.textContent = (new Date()).getFullYear();
$version.textContent = 'v' + chrome.runtime.getManifest().version;
$buttonOpenStats.addEventListener('click', () => openStatsPage());
$buttonRefreshStats.addEventListener('click', () => {
  init();
  setTimeout(() => $buttonRefreshStats.blur(), 1000);
});
init();

function init() {
  $body.classList.add('loading');
  chrome.runtime.sendMessage({ type: 'GET_TOTALS'}, {}, data => {
    updateStatsTable('articles', data.articles);
    updateStatsTable('responses', data.responses);
    $body.classList.remove('loading');
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
}

function formatValue(number) {
  return number > 1000
    ? (number / 1000).toFixed(1) + 'K'
    : number.toFixed(0);
}

function openStatsPage() {
  chrome.tabs.create({ url: 'https://medium.com/me/stats' });
}
