loggly.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  sendConsoleErrors: true,
  tag: 'mes-notifications'
});

const $notificationExtrasHolder = document.querySelector('.metabar-block .buttonSet');
let $notificationExtras = document.querySelector('.notifications-extras');

if (!$notificationExtras) {
  const notificationExtras = document.createElement('div');
  notificationExtras.className = 'notifications-extras';
  $notificationExtrasHolder.appendChild(notificationExtras);
  $notificationExtras = document.querySelector('.notifications-extras');
}

$notificationExtrasHolder.addEventListener('mouseenter',
  () => $notificationExtras.classList.add('show'));
$notificationExtrasHolder.addEventListener('mouseleave',
  () => $notificationExtras.classList.remove('show'));
$notificationExtrasHolder.addEventListener('click',
  () => loadNotificationData().then(updateNotificationsDom));

timer(0, 60000)
  .subscribe(() => loadNotificationData().then(updateNotificationsDom));

function loadNotificationData() {
  logNotifications('load data');
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: 'GET_NOTIFICATIONS'}, {}, resolve));
}

function updateNotificationsDom(notifications) {
  const content = Object.keys(notifications).sort().map(key => {
    const count = notifications[key];
    return `
          <div>
            <span class="value">${count}</span>
            <span class="type">${capitalize(key)}${count > 1 ? 's' : ''}</span>
          </div>  
        `;
  }).join('\n') || 'No new notifications';
  $notificationExtras.innerHTML = `<div class="triangle"></div>${content}`;
  logNotifications('notifications DOM updated')
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function logNotifications(...args) {
  console.log('Medium Enhanced Stats [notifications] -', ...args);
}

