const $ = (id) => document.getElementById(id);
const DEFAULTS = { apiKey: '', model: 'claude-opus-5-5', effort: 'high', autoAi: false };

chrome.storage.local.get(DEFAULTS).then((s) => {
  $('apiKey').value = s.apiKey;
  $('model').value = s.model;
  $('effort').value = s.effort;
  $('autoAi').checked = s.autoAi;
  if (!s.apiKey) $('settings').open = true;
});

let t;
for (const id of ['apiKey', 'model', 'effort', 'autoAi']) {
  $(id).addEventListener('change', () => {
    chrome.storage.local.set({
      apiKey: $('apiKey').value.trim(), model: $('model').value,
      effort: $('effort').value, autoAi: $('autoAi').checked,
    }).then(() => {
      $('saved').textContent = '✓ Saved';
      clearTimeout(t); t = setTimeout(() => ($('saved').textContent = ''), 1500);
    });
  });
}

$('start').addEventListener('click', async () => {
  $('err').textContent = '';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    // Same-origin iframes get the highlight styles too; frames we may not
    // touch make allFrames fail, so fall back to the top page alone.
    await chrome.scripting.insertCSS({ target: { tabId: tab.id, allFrames: true }, files: ['page.css'] })
      .catch(() => chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['page.css'] }));
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['checks.js', 'content.js'] });
    window.close();
  } catch (e) {
    $('err').textContent = /cannot be scripted|chrome:\/\/|Cannot access/i.test(e.message)
      ? 'यह page (chrome://, Web Store, PDF viewer) scan नहीं हो सकता। कोई normal website खोलें।'
      : e.message;
  }
});
