log('start');

let data;
let checkPageChange;
let checkTableChange;
let isLoading = false;

loadData();

checkPageChange = setInterval(() => {
  if (!isLoading && urlIncludes('stats') && !document.querySelector('table tfoot')) {
    loadData();
    if (checkTableChange) {
      checkTableChange.disconnect();
      checkTableChange.observe(document.querySelector('table tbody'), { childList: true });
    }
    log('page refresh detected');
  }
}, 1000);

checkTableChange = new MutationObserver(() => {
  if (data) { updateUI(data); }
  log('table mutation detected');
});
checkTableChange.observe(document.querySelector('table tbody'), { childList: true });

window.addEventListener('unload', cleanup);

function loadData() {
  isLoading = true;
  chrome.runtime.sendMessage({ type: 'GET_TOTALS'}, {}, d => {
    isLoading = false;
    data = d;
    updateUI(data);
    log('data loaded');
  });
}

function updateUI(data) {
  const { items, views, syndicatedViews, reads, fans, claps, ratio, posts } =
    urlIncludes('responses') ? data.responses : data.articles;

  const datesBars = Array.from(document.querySelectorAll('.bargraph-bar'))
    .map(node => node.getAttribute('data-tooltip'))
    .map(tooltip => tooltip.replace('\xa0', ' ').split(' ').slice(-2))
    .map(([month, day]) => [getMonthIndex(month), day]);
  const datesItems = posts
    .map(item => new Date(item.firstPublishedAt))
    .map(date => [date.getFullYear(), date.getMonth(), date.getDate()]);

  // console.log(datesBars, datesItems);

  updateTableSummary(items, views, syndicatedViews, reads, ratio, fans, claps);
  updateTableRows(posts);
}

function updateTableSummary(items, views, syndicatedViews, reads, ratio, fans, claps) {
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

function updateTableRows(posts) {
  const rows = document.querySelectorAll('table tbody tr');
  Array.from(rows)
    .filter(row => row.getAttribute('data-action-value'))
    .forEach(row => {
      const postId = row.getAttribute('data-action-value');
      const post = posts.find(post => post.postId === postId);
      const fansCell = row.querySelector('td:last-child .sortableTable-number');
      let claps = fansCell.querySelector('.claps');
      if (!claps) {
        claps = document.createElement('span');
        claps.className = 'claps';
        fansCell.appendChild(claps);
      }
      claps.textContent = formatValue(post.claps);
    });
  document.querySelector('table thead th:last-child button').textContent = 'Fans & Claps';
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

function urlIncludes(text) {
  return window.location.pathname.includes(text);
}

function getMonthIndex(month) {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ].indexOf(month);
}

function cleanup() {
  clearInterval(checkPageChange);
  if (checkTableChange) {
    checkTableChange.disconnect();
  }
}

function log(item) {
  console.log('Medium Enhanced Stats -', item);
}
