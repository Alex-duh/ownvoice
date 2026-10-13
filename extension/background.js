/**
 * Service worker. Two jobs only.
 *
 * MV3 service workers have no DOM and cannot call getUserMedia, so all capture
 * happens in the side panel. What the worker owns is the thing the panel
 * cannot see: which tab is currently active. chrome.tabCapture.getMediaStreamId
 * needs that tab id, and a side panel is not a tab.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "getTabStreamId") return;

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    // Chrome refuses capture on its own pages and the Web Store, and the error
    // it raises is opaque, so fail with something the user can act on.
    if (!tab || /^(chrome|edge|about|devtools):|chromewebstore\.google\.com/.test(tab.url || "")) {
      sendResponse({ error: "unsupported-tab" });
      return;
    }
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) {
        sendResponse({ error: chrome.runtime.lastError?.message || "no-stream" });
      } else {
        sendResponse({ streamId });
      }
    });
  });
  return true; // keep the channel open for the async responses above
});
