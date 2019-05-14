loggly.push({
  logglyKey: 'c5cb1f4e-0af5-459d-8e74-dd390ae4215d',
  sendConsoleErrors: true,
  tag: 'mes-notifications'
});

let $notificationHolder;
let $notificationButton;
let $notificationExtras;
let $notificationMutationObserver;

let mesUrl;
const mesUrlChange$ = timer(0, 1000)
  .pipe(
    map(() => window.location.href),
    filter(currentUrl => currentUrl !== mesUrl),
    tap(currentUrl => {
      console.log(currentUrl);
      mesUrl = currentUrl;
    })
  );

mesUrlChange$.subscribe(initNotifications);
timer(60000, 60000).subscribe(() => loadNotificationDataAndUpdateDom());
fromEvent(window, 'resize')
  .pipe(debounceTime(300))
  .subscribe(updateNotificationExtraLeftPosition);

function initNotifications() {
  logNotifications('init');
  if ($notificationExtras) {
    $notificationExtras.remove();
    $notificationExtras = undefined;
  }
  $notificationHolder = document.querySelector('.metabar-block .buttonSet');
  $notificationMutationObserver = new MutationObserver(mutations => {
    if (mutations[0]
      && mutations[0].addedNodes
      && mutations[0].addedNodes[0]
      && mutations[0].addedNodes[0].title === 'Notifications') {
      rebindNotificationsButtonEvents();
    }
  });

  if ($notificationHolder) {
    $notificationMutationObserver.observe($notificationHolder, { attributes: true, childList: true, subtree: true });

    if (!$notificationExtras) {
      const notificationExtras = document.createElement('div');
      notificationExtras.className = 'notifications-extras';
      $notificationHolder.appendChild(notificationExtras);
      $notificationExtras = document.querySelector('.notifications-extras');
    }

    rebindNotificationsButtonEvents();
  } else {
    logNotifications('notification holder not found, incompatible Medium DOM present on page');
  }

  loadNotificationDataAndUpdateDom();
  updateNotificationExtraLeftPosition();
}

function rebindNotificationsButtonEvents() {
  logNotifications('rebind notification button events');
  if ($notificationButton) {
    $notificationButton.removeEventListener('mouseenter', showNotifications);
    $notificationButton.removeEventListener('mouseleave', hideNotifications);
    $notificationButton.removeEventListener('click', loadNotificationDataAndUpdateDom);
  }

  $notificationButton = document.querySelector('.metabar-block .buttonSet button[title="Notifications"]');

  $notificationButton.addEventListener('mouseenter', showNotifications);
  $notificationButton.addEventListener('mouseleave', hideNotifications);
  $notificationButton.addEventListener('click', loadNotificationDataAndUpdateDom);
}

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

