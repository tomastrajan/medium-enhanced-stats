const loggly = new LogglyTracker();
loggly.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  sendConsoleErrors: true,
  tag: 'mes-stats'
});

log('start');

const { from, fromEvent, merge, combineLatest, timer, BehaviorSubject, Subject } = rxjs;
const { tap, map, mapTo, exhaustMap, filter, debounceTime, delay } = rxjs.operators;

const BAR_CHART_DATE_IDS = generateDateIds();
let barChartIdsOffest = 0;
let barChartExtrasDOM;
let barChartActionsSubscription;
let barChartTypesSubscription;
let barChartPostsStats = {};

const barChartRefreshTrigger = new Subject(undefined);
const stateSubject = new BehaviorSubject(undefined);
const state$ = stateSubject.asObservable().pipe(
  filter(s => !!s),
  map(s => urlIncludes('responses') ? s.user.totals.responses : s.user.totals.articles)
);

state$.subscribe(s => {
  log('new state');
  updateTableSummary(s);
  updateTableRows(s);
  updateBarChart(s);
});

combineLatest(fromEvent(window, 'scroll'), state$)
  .pipe(debounceTime(500))
  .subscribe(([ , s]) => updateTableRows(s));

combineLatest(fromEvent(window, 'resize'), state$)
  .pipe(tap(cleanBarChartExtras), debounceTime(500))
  .subscribe(([, s]) => updateBarChart(s));

// periodically check for new page
timer(0, 1000)
  .pipe(
    filter(isNewPage),
    tap(cleanBarChartExtras),
    exhaustMap(() => from(loadData()))
  )
  .subscribe(data => {
    barChartIdsOffest = 0;
    stateSubject.next(data);

    // setup actions on current page
    if (barChartActionsSubscription) { barChartActionsSubscription.unsubscribe(); }
    barChartActionsSubscription = combineLatest(
      merge(
        fromEvent(document.querySelector('.chartPage button:first-child'), 'click').pipe(mapTo('left')),
        fromEvent(document.querySelector('.chartPage button:last-child'), 'click').pipe(mapTo('right'))
      ),
      state$
    )
    .pipe(
      tap(([direction]) => {
        cleanBarChartExtras();
        direction === 'left' ? barChartIdsOffest++ : barChartIdsOffest--;
        barChartIdsOffest = barChartIdsOffest < 0 ? 0 : barChartIdsOffest;
      }),
      debounceTime(1500)
    )
    .subscribe(([, s]) => updateBarChart(s));

    if (barChartTypesSubscription) { barChartTypesSubscription.unsubscribe(); }
    barChartTypesSubscription = combineLatest(
      merge(
        fromEvent(document.querySelector('li[data-action="switch-graph"]:nth-child(1)'), 'click'),
        fromEvent(document.querySelector('li[data-action="switch-graph"]:nth-child(2)'), 'click'),
        fromEvent(document.querySelector('li[data-action="switch-graph"]:nth-child(3)'), 'click'),
        barChartRefreshTrigger.asObservable(),
      ),
      state$
    )
    .pipe(tap(() => cleanBarChartExtras()), delay(1000))
    .subscribe(([, s]) => updateBarChart(s));
  });


function loadData() {
  log('load data');
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: 'GET_TOTALS'}, {}, data => resolve(data)));
}

function loadPostStats(postId) {
  log('load post stats');
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: 'GET_POST_STATS', postId }, {}, data => resolve(data)));
}

function loadPostStatsToday(postId) {
    log('load post stats today');
    return new Promise((resolve) =>
        chrome.runtime.sendMessage({ type: 'GET_POST_STATS', postId }, {}, data => resolve(data)));
}

function cleanBarChartExtras() {
  if (barChartExtrasDOM) {
    barChartExtrasDOM.innerHTML = '';
  }
  cleanBarChartPostBars();
}

function cleanBarChartPostBars() {
  document.querySelectorAll('.mes-post-bar').forEach(node => node.remove());
}

function updateBarChart(data) {
  log('update barchart');
  const bars = document.querySelectorAll('.bargraph-bar:not(.mes-post-bar)');
  if (!bars.length || bars.length > 30) {
    setTimeout(() => updateBarChart(data), 500);
    return;
  }

  barChartExtrasDOM = document.querySelector('.mes-barchart-extras');
  if (!barChartExtrasDOM) {
    barChartExtrasDOM = document.createElement('div');
    barChartExtrasDOM.className = 'mes-barchart-extras';
    document.querySelector('.bargraph').appendChild(barChartExtrasDOM);
  }
  cleanBarChartExtras();


  const datePostMap = data.posts.reduce((result, post) => {
    const date = new Date(post.firstPublishedAt);
    const id = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (result[id]) {
      result[id].push(post);
    } else {
      result[id] = [post];
    }
    return result;
  }, {});

  const dateIds = getDateIds();
  const points = dateIds.map(id => datePostMap[id]).reverse();
  const postStats = barChartPostsStats.id && barChartPostsStats[barChartPostsStats.id];
  const postBars = postStats && dateIds.map(id => postStats[id]).reverse();

  Array.from(bars)
    .forEach((node, index) => {
      const posts = points[index];
      if (posts) {
        const { width, bottom, left } = node.getBoundingClientRect();
        const sizeMultiplier = parseFloat(`1.${(posts.length - 1) * 3}`);
        const pWidth = (width / 3) * sizeMultiplier;
        const pWidthBorder = (width / 8);
        const offset = (pWidth + (pWidthBorder * 2)) / 2;

        const point = document.createElement('div');
        point.style.left = (left + (width / 2) - offset) + 'px';
        point.style.top = (window.pageYOffset + bottom - offset) + 'px';
        point.style.width = pWidth + 'px';
        point.style.height = pWidth + 'px';
        point.style.borderWidth = pWidthBorder + 'px';
        point.setAttribute('data-tooltip', posts.map((p, i) =>
          `${posts.length > 1 ? `${i + 1}. ` : ''}${p.title}`).join(' '));
        barChartExtrasDOM.appendChild(point);
      }

      if (postBars && postBars[index]) {
        const [value, type, ...rest] = node.getAttribute('data-tooltip').split(' ');
        const nodeValue = parseInt(value.replace(',', ''), 10);
        const postValue = postBars[index][type];
        const ratio = nodeValue === 0 ? 0 : parseFloat((postValue / nodeValue).toFixed(2));
        const percentage = (ratio * 100).toFixed(0);
        const height = ratio == 0 && postValue > 0 ? 5 : (parseFloat(node.getAttribute('height')) * ratio).toFixed(1);
        const title = data.posts.find(p => p.postId === barChartPostsStats.id).title;
        const postBar = node.cloneNode();
        postBar.setAttribute('class', 'bargraph-bar mes-post-bar');
        postBar.setAttribute('height', height);
        postBar.setAttribute('y', parseFloat(postBar.getAttribute('y')) + parseFloat(node.getAttribute('height')) - height);
        postBar.setAttribute('data-tooltip', `${formatWholeNumber(postValue)} ${type} ${rest.join(' ')} (${percentage}% of total daily ${type}) ${title}`);
        node.insertAdjacentElement('afterend', postBar);
      }
    });
}

function updateTableSummary(data) {
  const { items, views, syndicatedViews, reads, fans, claps, clapsPerFan, clapsPerViewsRatio, fansPerReadsRatio, ratio } = data;
  log('update table summary');
  const table = document.querySelector('table');
  let tfoot = table.querySelector('tfoot');
  if (!tfoot) {
    tfoot = document.createElement('tfoot');
    table.appendChild(tfoot);
  }

  tfoot.innerHTML = `
      <tr>
        <td title="Items count" class="articles-count">${formatValue(items)}</td>
        <td title="${formatWholeNumber(views)}">
          ${formatValue(views)}
          ${syndicatedViews ? `<span class="syndicated-views">+${formatValue(syndicatedViews)}</span>` : ''}
        </td>
        <td title="${formatWholeNumber(reads)}">${formatValue(reads)}</td>
        <td title="Weighted average">${ratio}%</td>
        <td title="${formatWholeNumber(fans)}">
            ${formatValue(fans)}
            <span class="claps" title="${formatWholeNumber(claps)}">
                ${formatValue(claps)}
                <span class="claps-per-fan" title="Claps per Fan">${clapsPerFan}</span>
                <span class="claps-per-views-ratio" title="Claps per View Ratio">${clapsPerViewsRatio}%</span>
                <span class="fans-per-reads-ratio" title="Fans per Reads Ratio">${fansPerReadsRatio}%</span>
            </span>
        </td>
        <td id="today_count" style="text-align:center !important" title="Views Today(Reads)">${formatValue(total_views_today)}</td>
        
      </tr>
    `;
}
let total_views_today  = 0;
let total_reads_today = 0;
function getAllPostStats(posts) {
    let promiseArr = [];
    posts.forEach((post) => {
        promiseArr.push(loadPostStatsToday(post.postId));
        //promiseArr.push(loadPostStats(post.postId));
    });
    Promise.all(promiseArr).then((result)=>{
       for(let i = 0; i < result.length; i++) {
           posts[i].view_today = result[i];
           posts[i].read_today = result[i]
           posts[i].total_views_today = process_views_today(posts[i]);
           posts[i].total_reads_today = process_read_today(posts[i])
           total_views_today += posts[i].total_views_today
           total_reads_today += posts[i].total_reads_today
       }

       let today_count_div = document.querySelector("#today_count")
       today_count_div.textContent = total_views_today + "(" + total_reads_today + ") ";
       total_reads_today = 0;
       total_views_today = 0;

        const rows = document.querySelectorAll('table tbody tr');
        Array.from(rows)
            .filter(row => row.getAttribute('data-action-value'))
            .forEach(row => {
                const postId = row.getAttribute('data-action-value');
                const post = posts.find(post => post.postId === postId);
                const fansCell = row.querySelector('td:nth-child(5) .sortableTable-number');
                let claps = fansCell.querySelector('.claps');
                if (!claps) {
                    claps = document.createElement('span');
                    claps.className = 'claps';
                    fansCell.appendChild(claps);

                }
                let read_today = fansCell.querySelector('.read_today');
                if(!read_today){
                    read_today = document.createElement('span');
                    read_today.className = 'read_today';
                    fansCell.appendChild(read_today);
                }
                let today_cell = row.querySelector('.today_cell');
                if (!today_cell) {
                    today_cell = row.insertCell(-1);
                    let view_today_number = process_views_today(post);
                    let read_today_number = process_read_today(post);

        
                    today_cell.innerHTML = `<span class="sortableTable-value">${view_today_number}</span>
                      <span class="sortableTable-number" style="text-align: center" title="${view_today_number}">${view_today_number + "(" +read_today_number  +  ")"}</span>`;
                    today_cell.className = "today_cell";
                }

            });
    });
}

function updateTableRows(data) {
  getAllPostStats(data.posts);
  const rows = document.querySelectorAll('table tbody tr');
  Array.from(rows)
    .filter(row => row.getAttribute('data-action-value'))
    .forEach(row => {
      const postId = row.getAttribute('data-action-value');
      const post = data.posts.find(post => post.postId === postId);
      const fansCell = row.querySelector('td:nth-child(5) .sortableTable-number');
      const articleTitle = row.querySelector('.sortableTable-title');
      articleTitle.title = (new Date(post.firstPublishedAt)).toLocaleDateString();
      let claps = fansCell.querySelector('.claps');
      if (!claps) {
        claps = document.createElement('span');
        claps.className = 'claps';
        fansCell.appendChild(claps);

      }
      if (post) {
        const clapsPerFan = post.upvotes === 0 ? 0 : (post.claps / post.upvotes).toFixed(2);
        const clapsPerViewsRatio = post.upvotes === 0 ? 0 : ((post.claps / post.views) * 100).toFixed(1);
        const fansPerReadsRatio = post.upvotes === 0 ? 0 : ((post.upvotes / post.reads) * 100).toFixed(1);
        claps.innerHTML = `
          <span title="${formatWholeNumber(post.claps)}">${formatValue(post.claps)}</span>
          <span class="claps-per-fan" title="Claps per Fan">${clapsPerFan}</span>
          <span class="claps-per-views-ratio" title="Claps per Views Ratio">${clapsPerViewsRatio}%</span>
          <span class="fans-per-reads-ratio" title="Fans Per Reads Ratio">${fansPerReadsRatio}%</span>
        `;
      }
      const postTitleCell = row.querySelector('td:first-child');
      const postTitleCellActions = postTitleCell.querySelector('.sortableTable-text');
      if (postTitleCellActions.children.length <= 4) {
         postTitleCellActions.innerHTML += '<span class="middotDivider"></span>';
         postTitleCell.addEventListener('click', () => {
           scrollToBarChart();
           cleanBarChartExtras();
           barChartPostsStats.id = undefined;
           Promise
             .resolve()
             .then(() => barChartPostsStats[postId] || loadPostStats(postId))
             .then(postStats => {
                 console.log("is coming here", postStats);
               barChartPostsStats[postId] = postStats;
               const dateId = Object.keys(postStats)[0];
               let dateIds = getDateIds();
               while (dateId > dateIds[0]) {
                 barChartIdsOffest--;
                 dateIds = getDateIds();
               }
               barChartRefreshTrigger.next();
             });
         });
         const showPostChartInAction = document.createElement('button');
         showPostChartInAction.textContent = 'Show in chart';
         showPostChartInAction.className = 'mes-action-show-in-chart';
         showPostChartInAction.addEventListener('click', event => {
           event.stopPropagation();
           deselectActivePost();
           scrollToBarChart();
           cleanBarChartPostBars();
           Promise
             .resolve()
             .then(() => barChartPostsStats[postId] || loadPostStats(postId))
             .then(postStats => {
                 console.log("postStats neel", postStats);
               barChartPostsStats.id = postId;
               barChartPostsStats[postId] = postStats;
               barChartRefreshTrigger.next();
             });
         });
         postTitleCellActions.appendChild(showPostChartInAction);
      }
    });
  const fansHeadCell = document.querySelector('table thead th:nth-child(5) button');
  fansHeadCell.innerHTML = `Fans <span class="claps">Claps </span>`;
  fansHeadCell.title = 'Fans, Claps and Claps per Fan';

  let table_head = document.querySelector('table thead tr');
    let read_today_heading = table_head.querySelector('.read_today_heading');
    if (!read_today_heading) {
        read_today_heading = document.createElement('th');
        read_today_heading.className = 'read_today_heading';
        read_today_heading.classList.add("sortableTable-header");
        read_today_heading.innerHTML = `<button class="button button--chromeless u-baseColor--buttonNormal js-views" data-action="sort-table" data-action-value="read_today<" data-label="Sort by">Views Today(Read)</button><span class="svgIcon svgIcon--sortAscending svgIcon--19px"><svg class="svgIcon-use" width="19" height="19"><path d="M5.4 11L4 9.667l5.517-6.11L15 9.597 13.6 11 9.5 6.8 5.4 11z"></path><path d="M8.5 15.4h2v-9h-2z" fill-rule="evenodd"></path></svg></span><span class="svgIcon svgIcon--sortDescending svgIcon--19px"><svg class="svgIcon-use" width="19" height="19"><path d="M5.4 8.4L4 9.733l5.517 6.11L15 9.803 13.6 8.4l-4.1 4.2-4.1-4.2z"></path><path d="M8.5 4h2v9h-2z" fill-rule="evenodd"></path></svg></span>`;
        table_head.appendChild(read_today_heading);
    }

}

function deselectActivePost() {
  const activePostRow = document.querySelector('tr.is-active');
  if (activePostRow) { activePostRow.click(); }
}

function scrollToBarChart() {
  document.querySelector('.chartTabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function isNewPage() {
  return urlIncludes('stats') && !document.querySelector('table tfoot');
}

function urlIncludes(text) {
  return window.location.pathname.includes(text);
}

function formatValue(number = 0) {
  return number >= 1000000000
    ? (Math.floor(number / 100000000) / 10).toFixed(1) + 'B'
    : number >= 1000000
      ? (Math.floor(number / 100000) / 10).toFixed(1) + 'M'
      :  number >= 1000
        ? (Math.floor(number / 100) / 10).toFixed(1) + 'K'
        : number.toFixed(0);
}

function formatWholeNumber(number = 0) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getDateIds() {
  const offset = barChartIdsOffest === 0 ? 0 : barChartIdsOffest * 30;
  return BAR_CHART_DATE_IDS.slice(offset, offset + 30);
}

function generateDateIds() {
  const endDate = new Date();
  let startDate = new Date(endDate.getFullYear() - 10, endDate.getMonth(), endDate.getDate());
  let start = startDate.getTime();
  const end = endDate.getTime();
  const oneDay = 24 * 3600 * 1000;
  const ids = [];
  for (; start < end; start += oneDay) {
    startDate = new Date(start);
    ids.push(`${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`);
  }
  return ids.reverse();
}

function log(...args) {
  console.log('Medium Enhanced Stats [stats] -', ...args);
}
function process_views_today(post){
  let views_today_number = post.view_today;
  const date_today = new Date();
  const key = `${date_today.getFullYear()}-${date_today.getMonth()}-${date_today.getDate()}`;
  if (post.view_today.hasOwnProperty(key)) {
      views_today_number = views_today_number[key].view_today;
  } else {
      views_today_number = 0;
  }
  return views_today_number;
}
function process_read_today(post){
  let read_today_number = post.read_today;
  const date_today = new Date();
  const key = `${date_today.getFullYear()}-${date_today.getMonth()}-${date_today.getDate()}`;
  if (post.read_today.hasOwnProperty(key)) {
      read_today_number = read_today_number[key].read_today;
  } else {
      read_today_number = 0;
  }
  return read_today_number;
}