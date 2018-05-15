const $body = document.querySelector('body');
const $table = document.querySelector('table');
const $year = document.querySelector('.year');
const $version = document.querySelector('.version');
const $chartProgress = document.querySelector('.chart .progress');
const $chartReach = document.querySelector('.chart .reach');
const $chartMilestone = document.querySelector('.chart .milestone');
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
  $chartProgress.setAttribute('stroke-dasharray', `0 100`);
  chrome.runtime.sendMessage({ type: 'GET_TOTALS'}, {}, data => {
    updateStatsTable('articles', data.articles);
    updateStatsTable('responses', data.responses);
    updateChart(data);
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

function updateChart(data) {
  const { articles, responses } = data;
  const reach = articles.views + responses.views;
  const milestone = '1'.padEnd(reach.toString().length + 1, '0');
  const progress = ((reach / milestone) * 100).toFixed(0);
  $chartProgress.setAttribute('stroke-dasharray', `${progress} 100`);
  $chartReach.textContent = formatValue(reach);
  $chartMilestone.textContent = formatWholeNumber(milestone);
}

function formatValue(number) {
  return number >= 1000000
    ? (number / 1000000).toFixed(1) + 'M'
    :  number >= 1000
        ? (number / 1000).toFixed(1) + 'K'
        : number.toFixed(0);
}

function formatWholeNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


function openStatsPage() {
  chrome.tabs.create({ url: 'https://medium.com/me/stats' });
}

// 100 1000 10000 100000 1000000 10000000
