loggly.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  sendConsoleErrors: true,
  tag: 'mes-notifications'
});

loadNotificationData().then(data => logNotifications(data));

function loadNotificationData() {
  logNotifications('load data');
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: 'GET_NOTIFICATIONS'}, {}, data => resolve(data)));
}

function logNotifications(...args) {
  console.log('Medium Enhanced Stats [notifications] -', ...args);
}