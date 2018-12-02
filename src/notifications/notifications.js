loggly.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  sendConsoleErrors: true,
  tag: 'mes-notifications'
});

let $notificationExtrasHolder;
let $notificationExtras;

timer(0, 10000)
  .subscribe(() => {
    if ($notificationExtrasHolder) {
      $notificationExtrasHolder.removeEventListener('mouseenter', showNotifications);
      $notificationExtrasHolder.removeEventListener('mouseleave', hideNotifications);
      $notificationExtrasHolder.removeEventListener('click', loadNotificationDataAndUpdateDom);
    }

    $notificationExtrasHolder = document.querySelector('.metabar-block .buttonSet');
    $notificationExtras = document.querySelector('.notifications-extras');

    if (!$notificationExtras && $notificationExtrasHolder) {
      const notificationExtras = document.createElement('div');
      notificationExtras.className = 'notifications-extras';
      $notificationExtrasHolder.appendChild(notificationExtras);
      $notificationExtras = document.querySelector('.notifications-extras');
    }

    if ($notificationExtrasHolder) {
      $notificationExtrasHolder.addEventListener('mouseenter', showNotifications);
      $notificationExtrasHolder.addEventListener('mouseleave', hideNotifications);
      $notificationExtrasHolder.addEventListener('click', loadNotificationDataAndUpdateDom);
    }
  });

timer(0, 60000).subscribe(() => loadNotificationDataAndUpdateDom());

function showNotifications() {
  $notificationExtras.classList.add('show')
}

function hideNotifications() {
  $notificationExtras.classList.remove('show')
}

function loadNotificationDataAndUpdateDom() {
  logNotifications('load data');
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: 'GET_NOTIFICATIONS'}, {}, resolve))
    .then(notifications => {
      const content = Object.keys(notifications).sort().map(key => {
        const count = notifications[key];
        return `
          <div>
            <span class="value">${count}</span>
            <span class="type">${capitalize(key)}${count > 1 ? 's' : ''}</span>
          </div>  
        `;
      }).join('\n') || 'No new notifications';
      if ($notificationExtras) {
        $notificationExtras.innerHTML = `<div class="triangle"></div>${content}`;
        logNotifications('notifications DOM updated')
      }
    });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function logNotifications(...args) {
  console.log('Medium Enhanced Stats [notifications] -', ...args);
}

