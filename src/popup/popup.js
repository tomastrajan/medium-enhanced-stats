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
const $buttonScreenshot = document.querySelector('.screenshot-stats');
const $buttonExport = document.querySelector('.export-stats');
const $downloadLink = document.createElement('a');

const AVATAR_URL = 'https://cdn-images-1.medium.com/fit/c/64/64/';
let MILESTONES = [];
generateMilestones().then(res => {
  MILESTONES = res;
});

let data;
let accoundData;

$year.textContent = (new Date()).getFullYear();
$version.textContent = 'v' + chrome.runtime.getManifest().version;
$welcome.addEventListener('click', () => $userSelector.style.display = 'block');
$buttonScreenshot.addEventListener('click', () =>
  html2canvas(document.body, {
    scale: window.devicePixelRatio,
    height: 400,
    width: 450,
    foreignObjectRendering: true,
    ignoreElements: ignoreScreenshotElement
  }).then(canvas => {
    repaintIgnoredScreenshotElements(canvas);
    downloadCanvas(canvas);
  }));
$confetti.addEventListener('click', () => confetti($confetti)); // easter egg
$buttonExport.addEventListener('click', () => exportStats());
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
  accoundData = account;
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

function ignoreScreenshotElement(element) {
  const isIgnoredClass = ['info', 'side-actions']
    .some(ignoredClass => {
      if (element && element.className && typeof element.className === 'string') {
        return element.className.includes(ignoredClass);
      } else {
        return false;
      }
    });
  const isIgnoredElement = element.nodeName === 'svg';
  return isIgnoredClass || isIgnoredElement;
}

function repaintIgnoredScreenshotElements(canvas) {
  const CIRCLE_START = -0.5 * Math.PI;
  const { articles, responses } = accoundData.totals;
  const reach = articles.views + responses.views;
  const milestone = MILESTONES.find(m => m > reach);
  const milestonePrev = MILESTONES[MILESTONES.indexOf(milestone) - 1];
  const milestoneDiff = milestone - milestonePrev;
  const progress = milestoneDiff === 0 ? 0 : ((reach - milestonePrev) / milestoneDiff);
  const ctx = canvas.getContext("2d");
  const scale = window.devicePixelRatio;
  const fontSizeSmall =  12 * scale;
  const fontSizeMedium =  16 * scale;
  const fontSizeBig =  32 * scale;
  ctx.beginPath();
  ctx.arc(225 * scale, 150 * scale, 80 * scale, 0, 2 * Math.PI);
  ctx.lineWidth = 10 * scale;
  ctx.strokeStyle = '#eee';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(225 * scale, 150 * scale, 80 * scale, CIRCLE_START, (2 * Math.PI * progress) + CIRCLE_START);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#03a87c';
  ctx.stroke();


  ctx.font = `${fontSizeSmall}px sans-serif`;
  ctx.fillStyle = "#aaa";
  ctx.textAlign = "center";
  ctx.fillText("TOTAL REACH", canvas.width/2, 120 * scale);
  ctx.fillText("NEXT MILESTONE", canvas.width/2, 180 * scale);

  ctx.fillStyle = "#03a87c";
  ctx.font = `bold ${fontSizeBig}px sans-serif`;
  ctx.fillText(formatValue(reach), canvas.width/2, 150 * scale);

  ctx.fillStyle = "#000";
  ctx.font = `${fontSizeMedium}px sans-serif`;
  ctx.fillText(formatWholeNumber(milestone), canvas.width/2, 200 * scale);
}

function downloadCanvas(canvas) {
  const accountName = accoundData.name.toLowerCase().replace(' ', '-');
  $downloadLink.download = `medium-enhanced-stats-${accountName}.png`;
  $downloadLink.href = canvas.toDataURL('image/png');
  $downloadLink.click();
}

function exportStats() {
  const accountName = accoundData.name.toLowerCase().replace(' ', '-');
  const props = [
    'postId',
    'title',
    'slug',
    'firstPublishedAt',
    'readingTime',
    'views',
    'reads',
    'upvotes',
    'claps'
  ];
  const csv = [
    props.join(';'),
    ...data.user.export.articles.map(article => props.map(prop => article[prop]).join(';')),
    '',
    ...data.user.export.responses.map(article => props.map(prop => article[prop]).join(';'))
  ].join('\n');
  const encodedUri = encodeURI(`data:text/csv;charset=utf-8,\uFEFF${csv}`);

  $downloadLink.href = encodedUri;
  $downloadLink.download = `medium-enhanced-stats-${accountName}.csv`;
  $downloadLink.click();
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
  return new Promise((resolve, reject) => {
    try {
      let defaultMilestones = [
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

      chrome.storage.sync.get({
        nextMilestone: 0,
      }, items => {
        if (items.nextMilestone > 0) {
          defaultMilestones.push(items.nextMilestone);
          defaultMilestones.sort(function(a, b) {
            return a - b;
          });
        }
        resolve(defaultMilestones);
      });      
    } catch (ex) {
      reject(ex);
    }
  });
}
