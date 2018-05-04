const table = document.querySelector('table');
const tbody = document.querySelector('table tbody');

const observer = new MutationObserver(updateTableTotals);
observer.observe(tbody, { childList: true });
updateTableTotals();

function updateTableTotals() {
  const totals = getTotals();
  const { views, reads, fans, ratio } = totals;
  chrome.runtime.sendMessage(totals);
  let tfoot = table.querySelector('tfoot');
  if (!tfoot) {
    tfoot = document.createElement('tfoot');
    table.appendChild(tfoot);
  }
  tfoot.innerHTML = `
      <tr>
        <td></td>
        <td title="${formatTitle(views)}">${formatValue(views)}</td>
        <td title="${formatTitle(reads)}">${formatValue(reads)}</td>
        <td title="Weighted average">${parseFloat(ratio.toFixed(2)).toString()}%</td>
        <td title="${formatTitle(fans)}">${formatValue(fans)}</td>
      </tr>
    `;
}

function getTotals() {
  const rows = document.querySelectorAll('table tbody tr');
  const totals = {
    views: 0,
    reads: 0,
    fans: 0,
    ratio: 0
  };
  for (let row of rows) {
    if (row.childNodes.length > 1) {
      const views = getValueAsInt(row.childNodes[1]);
      const reads = getValueAsInt(row.childNodes[2]);
      const ratio = getValueAsFloat(row.childNodes[3]);
      const fans = getValueAsInt(row.childNodes[4]);
      const pViews = totals.views;
      const pRatio = totals.ratio;

      totals.views += views;
      totals.reads += reads;
      totals.fans += fans;
      totals.ratio = totals.ratio === 0
        ? ratio
        : parseFloatToPrecision(
          ((pViews * pRatio) + (views * ratio)) / (pViews + views),
          3
        );
    }
  }
  return totals;
}

function getValueAsInt(node) {
  const value = node.childNodes[0].textContent.replace(',', '');
  return parseInt(value, 10);
}
function getValueAsFloat(node) {
  const value = node.childNodes[0].textContent;
  return parseFloatToPrecision(value, 3);
}

function parseFloatToPrecision(value, precission) {
  return parseFloat(parseFloat(value).toFixed(precission));
}

function formatValue(number) {
  return number > 1000
    ? (number / 1000).toFixed(1) + 'K'
    : number;
}

function formatTitle(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
