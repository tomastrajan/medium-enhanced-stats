const $body = document.querySelector('body');
const $table = document.querySelector('table');
const $year = document.querySelector('.year');
const $version = document.querySelector('.version');
const $welcome = document.querySelector('.welcome');
const $user = document.querySelector('.user');
const $userAvatar = document.querySelector('.user-avatar');
const $userSelector = document.querySelector('.user-selector');
const $chartProgress = document.querySelector('.chart .progress');
const $chartReach = document.querySelector('.chart .reach');
const $chartMilestone = document.querySelector('.chart .milestone');
const $buttonOpenStats = document.querySelector('.open-stats');
const $buttonRefreshStats = document.querySelector('.refresh-stats');

const AVATAR_URL = 'https://cdn-images-1.medium.com/fit/c/64/64/';

let data;

$year.textContent = (new Date()).getFullYear();
$version.textContent = 'v' + chrome.runtime.getManifest().version;
$welcome.addEventListener('click', () => $userSelector.style.display = 'block');
$buttonOpenStats.addEventListener('click', () => openStatsPage());
$buttonRefreshStats.addEventListener('click', () => {
  init();
  setTimeout(() => $buttonRefreshStats.blur(), 1000);
});
init();

function init() {
  $body.classList.add('loading');
  $chartProgress.setAttribute('stroke-dasharray', `0 100`);
  chrome.runtime.sendMessage({ type: 'GET_TOTALS'}, {}, s => {
    data = s;
    updateUserSelector(data);
    updateUI(data.user);
    $body.classList.remove('loading');
  });
}

function updateUI(account) {
  updateStatsTable('articles', account.totals.articles);
  updateStatsTable('responses', account.totals.responses);
  updateChart(account.totals);
  updateUser(account.name, account.avatar);
}

function updateAccount(id) {
  $chartProgress.setAttribute('stroke-dasharray', `0 100`);
  $chartProgress.style.display = 'none';
  const account = id === 'user' ? data.user : data.collections[id];
  setTimeout(() => {
    $chartProgress.style.display = 'block';
    $userSelector.style.display = 'none';
    updateUI(account);
  });
}

function updateStatsTable(type, totals) {
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

function updateChart(totals) {
  const { articles, responses } = totals;
  const reach = articles.views + responses.views;
  const milestone = '1'.padEnd(reach.toString().length + 1, '0');
  const progress = ((reach / milestone) * 100).toFixed(0);
  $chartProgress.setAttribute('stroke-dasharray', `${progress} 100`);
  $chartReach.textContent = formatValue(reach);
  $chartMilestone.textContent = formatWholeNumber(milestone);
}

function updateUser(name, avatar) {
  $user.textContent = name;
  $userAvatar.src = AVATAR_URL + avatar;
}

function updateUserSelector(data) {
  const { user, collections } = data;
  const options = collections
    .map((c, index)=> ({ id: index, label: c.name, avatar: c.avatar, account: c }));
  options.unshift({ id: 'user', label: user.name, avatar: user.avatar, account: user });

  $userSelector.innerHTML = `
    ${options.map(o => `
        <div class="option" data-id="${o.id}">
            <span class="user">${o.label}</span>
            <img class="user-avatar" src="${AVATAR_URL}${o.avatar}" />
        </div>`
    )}
  `;
  Array.from(document.querySelectorAll('.user-selector div'))
    .forEach(n => n.addEventListener('click', () => updateAccount(n.getAttribute('data-id'))));
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
