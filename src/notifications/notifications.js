loggly.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  sendConsoleErrors: true,
  tag: 'mes-notifications'
});

loadData().then(data => console.log(data));

function loadData() {
  log('load data');
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: 'GET_NOTIFICATIONS'}, {}, data => resolve(data)));
}

function log(...args) {
  console.log('Medium Enhanced Stats [notifications] -', ...args);
}