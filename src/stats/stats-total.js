log('start');

const { from, fromEvent, merge, combineLatest, timer, BehaviorSubject } = rxjs;
const { tap, map, mapTo, exhaustMap, filter, debounceTime } = rxjs.operators;

const BAR_CHART_DATE_IDS = generateDateIds();
let barChartIdsOffest = 0;
let barChartExtrasDOM;
let barChartActionsSubscription;

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
  });


function loadData() {
  log('load data');
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_TOTALS'}, {}, data => {
      resolve(data);
    });
  });
}

function cleanBarChartExtras() {
  if (barChartExtrasDOM) {
    barChartExtrasDOM.innerHTML = '';
  }
}

function updateBarChart(data) {
  log('update barchart');
  const bars = document.querySelectorAll('.bargraph-bar');
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
  barChartExtrasDOM.innerHTML = '';


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

  const offset = barChartIdsOffest === 0 ? 0 : barChartIdsOffest * 30;
  const points = BAR_CHART_DATE_IDS.slice(offset, offset + 30).map(id => datePostMap[id]).reverse();

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
    });
}

function updateTableSummary(data) {
  const { items, views, syndicatedViews, reads, fans, claps, ratio } = data;
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
          ${syndicatedViews ? `<span>+${formatValue(syndicatedViews)}</span>` : ''}
        </td>
        <td title="${formatWholeNumber(reads)}">${formatValue(reads)}</td>
        <td title="Weighted average">${ratio}%</td>
        <td title="${formatWholeNumber(fans)}">
            ${formatValue(fans)}
            <span class="claps">${formatValue(claps)}</span>
        </td>
      </tr>
    `;
}

function updateTableRows(data) {
  log('update table rows');
  const rows = document.querySelectorAll('table tbody tr');
  Array.from(rows)
    .filter(row => row.getAttribute('data-action-value'))
    .forEach(row => {
      const postId = row.getAttribute('data-action-value');
      const post = data.posts.find(post => post.postId === postId);
      const fansCell = row.querySelector('td:last-child .sortableTable-number');
      let claps = fansCell.querySelector('.claps');
      if (!claps) {
        claps = document.createElement('span');
        claps.className = 'claps';
        fansCell.appendChild(claps);
      }
      if (post) {
        claps.textContent = formatValue(post.claps);
      }
    });
  document.querySelector('table thead th:last-child button').textContent = 'Fans & Claps';
}

function isNewPage() {
  return urlIncludes('stats') && !document.querySelector('table tfoot');
}

function urlIncludes(text) {
  return window.location.pathname.includes(text);
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

function log(item) {
  console.log('Medium Enhanced Stats -', item);
}
