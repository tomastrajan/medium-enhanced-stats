// Saves options to chrome.storage
function save_options() {
    var nextMilestone = document.getElementById('nextMilestone').value;
    chrome.storage.sync.set({
      nextMilestone: nextMilestone,
    }, function() {
      // Update status to let user know options were saved.
      var status = document.getElementById('status');
      status.textContent = 'Options saved.';
      setTimeout(function() {
        status.textContent = '';
      }, 750);
    });
  }
  
  function restore_options() {
    chrome.storage.sync.get({
      nextMilestone: 0,
    }, function(items) {
      document.getElementById('nextMilestone').value = items.nextMilestone;
    });
  }
  document.addEventListener('DOMContentLoaded', restore_options);
  document.getElementById('save').addEventListener('click',
      save_options);