const loggly = new LogglyTracker();
loggly.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  sendConsoleErrors: true,
  tag: 'mes-popup'
});

const $body = document.querySelector('body');
const $table = document.querySelector('table');
const $year = document.querySelector('.year');
const $version = document.querySelector('.version');
const $welcome = document.querySelector('.welcome');
const $user = document.querySelector('.user');
const $userAvatar = document.querySelector('.user-avatar');
const $userMembership = document.querySelector('.user-membership');
const $userFollowers = document.querySelector('.user-followers');
const $userSelector = document.querySelector('.user-selector');
const $confetti = document.querySelector('.confetti');
const $milestoneReached = document.querySelector('.milestone-reached-value');
const $milestoneReachedValue = document.querySelector('.milestone-reached-value .value');
const $milestoneReachedUnit = document.querySelector('.milestone-reached-value .unit');
const $infoMilestonePrev = document.querySelector('.info .milestone-prev');
const $infoMilestoneNext = document.querySelector('.info .milestone-next');
const $infoMilestoneCurrent = document.querySelector('.info .milestone-current');
const $infoMilestoneProgress = document.querySelector('.info .milestone-progress');
const $infoMilestoneDiff = document.querySelector('.info .milestone-diff');
const $chartProgress = document.querySelector('.chart .progress');
const $chartReach = document.querySelector('.chart .reach');
const $chartMilestone = document.querySelector('.chart .milestone');
const $buttonOpenStats = document.querySelector('.open-stats');
const $buttonRefreshStats = document.querySelector('.refresh-stats');

const AVATAR_URL = 'https://cdn-images-1.medium.com/fit/c/64/64/';
const MILESTONES = generateMilestones();

let data;

$year.textContent = (new Date()).getFullYear();
$version.textContent = 'v' + chrome.runtime.getManifest().version;
$welcome.addEventListener('click', () => $userSelector.style.display = 'block');
$confetti.addEventListener('click', () => confetti($confetti)); // easter egg
$buttonOpenStats.addEventListener('click', () => openStatsPage());
$buttonRefreshStats.addEventListener('click', () => {
  init();
  setTimeout(() => $buttonRefreshStats.blur(), 1000);
});
init();

function init() {
  $body.classList.add('loading');
  $chartProgress.setAttribute('stroke-dasharray', `0 100`);
  chrome.runtime.sendMessage({ type: 'GET_TOTALS'}, {}, response => {
    data = response;
    updateUserSelector(data);
    updateUI(data.user);
    $body.classList.remove('loading');
  });
}

function updateUI(account) {
  updateStatsTable('articles', account.totals.articles);
  updateStatsTable('responses', account.totals.responses);
  updateChart(account.totals, account.id);
  updateUser(account.name, account.avatar, account.followers, account.isMember);
}

function updateAccount(id) {
  $body.classList.add('loading');
  $chartProgress.setAttribute('stroke-dasharray', `0 100`);
  const account = id === 'user' ? data.user : data.collections[id];
  setTimeout(() => {
    $body.classList.remove('loading');
    $userSelector.style.display = 'none';
    updateUI(account);
  });
}

function updateStatsTable(type, totals) {
  const { items, views, reads, fans, claps, clapsPerFan, ratio } = totals;
  const $cols = $table.querySelectorAll(`.${type} td`);
  $cols[0].textContent = `${type.slice(0, 1).toUpperCase()}${type.slice(1)}`;
  $cols[1].textContent = formatValue(items);
  $cols[2].textContent = formatValue(views);
  $cols[3].textContent = formatValue(reads);
  $cols[4].textContent = ratio + '%';
  $cols[5].textContent = formatValue(fans);
  $cols[6].textContent = formatValue(claps);
  $cols[7].textContent = clapsPerFan;
}

function updateChart(totals, id) {
  const { articles, responses } = totals;
  const reach = articles.views + responses.views;
  const milestone = MILESTONES.find(m => m > reach);
  const milestonePrev = MILESTONES[MILESTONES.indexOf(milestone) - 1];
  const milestoneDiff = milestone - milestonePrev;
  const progress = milestoneDiff === 0 ? 0 : (((reach - milestonePrev) / milestoneDiff) * 100).toFixed(0);
  $chartProgress.setAttribute('stroke-dasharray', `${progress} 100`);
  $chartReach.textContent = formatValue(reach);
  $chartMilestone.textContent = formatWholeNumber(milestone);

  $infoMilestonePrev.textContent = formatWholeNumber(milestonePrev);
  $infoMilestoneNext.textContent = formatWholeNumber(milestone);
  $infoMilestoneDiff.textContent = formatWholeNumber(milestoneDiff);
  $infoMilestoneCurrent.textContent = formatWholeNumber(reach - milestonePrev);
  $infoMilestoneProgress.textContent = `${progress}%`;

  chrome.storage.sync.get([id], result => {
    if(result[id] === undefined) {
      chrome.storage.sync.set({ [id]: { milestoneActive: milestone } });
      return;
    }
    if(milestone !== result[id].milestoneActive) {
      showMilestoneReached(milestonePrev, progress);
      chrome.storage.sync.set({ [id]: { milestoneActive: milestone } });
    }
  });
}

function showMilestoneReached(milestone, progress) {
  const value = formatValue(milestone);
  $body.classList.add('milestone-reached');
  $chartProgress.setAttribute('stroke-dasharray', `0 100`);
  $milestoneReachedValue.textContent = value.slice(0, value.length - 2);
  $milestoneReachedUnit.textContent = value.slice(-1);
  setTimeout(() => {
    $chartProgress.setAttribute('stroke-dasharray', `100 100`);
    setTimeout(() => {
      $milestoneReached.classList.add('milestone-reached-value-explode');
      setTimeout(() => {
        confetti($confetti);
        $milestoneReached.classList.remove('milestone-reached-value-explode');
        $body.classList.remove('milestone-reached');
        $milestoneReachedValue.textContent = 0;
        $milestoneReachedUnit.textContent = '';
        $chartProgress.setAttribute('stroke-dasharray', `0 100`);
        $chartProgress.style.display = 'none';
        setTimeout(() => {
          $chartProgress.setAttribute('stroke-dasharray', `${progress} 100`);
          $chartProgress.style.display = '';
        }, 100);
      }, 1000);
    }, 2000);
  });
}

function updateUser(name, avatar, followers, isMember) {
  $user.textContent = name;
  $userFollowers.textContent = formatWholeNumber(followers);
  $userAvatar.src = AVATAR_URL + avatar;
  $userMembership.style.display = isMember ? 'block' : 'none';
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
    ).join('')}
  `;
  Array.from(document.querySelectorAll('.user-selector div'))
    .forEach(n => n.addEventListener('click', () => updateAccount(n.getAttribute('data-id'))));
}

function formatValue(number = 0) {
  return number >= 1000000000
    ? (Math.floor(number / 10000000) / 100).toFixed(2) + 'B'
    : number >= 1000000
      ? (Math.floor(number / 10000) / 100).toFixed(2) + 'M'
      :  number >= 1000
          ? (Math.floor(number / 10) / 100).toFixed(2) + 'K'
          : number.toFixed(0);
}

function formatWholeNumber(number = 0) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function openStatsPage() {
  chrome.tabs.create({ url: 'https://medium.com/me/stats' });
}

function generateMilestones() {
  return [
    0,
    1000,
    5000,
    10000,
    25000,
    50000,
    75000,
    100000,
    250000,
    500000,
    750000,
    1000000,
    2000000,
    4000000,
    6000000,
    8000000,
    10000000,
    20000000,
    30000000,
    40000000,
    50000000,
    60000000,
    70000000,
    80000000,
    90000000,
    100000000,
    200000000,
    300000000,
    400000000,
    500000000,
    600000000,
    700000000,
    800000000,
    900000000,
    1000000000,
    10000000000,
    100000000000,
    1000000000000,
    10000000000000
  ];
}
