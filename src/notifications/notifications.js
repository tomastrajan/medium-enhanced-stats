loggly.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  sendConsoleErrors: true,
  tag: 'mes-notifications'
});

let $notificationHolder;
let $notificationButton;
let $notificationExtras;

// TODO: use MutationObserver https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver

timer(0, 5000)
  .subscribe(() => {
    if ($notificationHolder) {
      $notificationHolder.removeEventListener('mouseenter', showNotifications);
      $notificationHolder.removeEventListener('mouseleave', hideNotifications);
      $notificationHolder.removeEventListener('click', loadNotificationDataAndUpdateDom);
    }

    $notificationHolder = document.querySelector('.metabar-block .buttonSet');
    $notificationButton = document.querySelector('.metabar-block button[title="Notifications"]');
    $notificationExtras = document.querySelector('.notifications-extras');

    if (!$notificationExtras && $notificationHolder) {
      const notificationExtras = document.createElement('div');
      notificationExtras.className = 'notifications-extras';
      $notificationHolder.appendChild(notificationExtras);
      $notificationExtras = document.querySelector('.notifications-extras');
      loadNotificationDataAndUpdateDom();
    }

    if ($notificationHolder) {
      $notificationHolder.addEventListener('mouseenter', showNotifications);
      $notificationHolder.addEventListener('mouseleave', hideNotifications);
      $notificationHolder.addEventListener('click', loadNotificationDataAndUpdateDom);
    }
  });

timer(0, 60000).subscribe(() => loadNotificationDataAndUpdateDom());

fromEvent(window, 'resize')
  .pipe(debounceTime(500))
  .subscribe(updateNotificationExtraLeftPosition);

function updateNotificationExtraLeftPosition() {
  $notificationExtras.style.left = `${$notificationButton.offsetLeft - 66}px`;
}

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

