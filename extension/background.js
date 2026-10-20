/**
 * Service worker. Two jobs only.
 *
 * It does NOT create the capture stream. getMediaStreamId binds the id it
 * returns to the context that called it, and the consumer here is the side
 * panel, not the worker. Minting it in the worker produced a stream the panel
 * could not open. The worker therefore answers only the question the panel
 * cannot answer for itself: which tab is in front.
 */

// Do NOT use openPanelOnActionClick. That opens the panel without routing the
// click through this worker, and tabCapture then reports "Extension has not
// been invoked for the current page". Handling onClicked ourselves grants
// activeTab for the clicked tab AND opens the panel, which is what capture
// needs. Clicking the icon again on a different tab re-grants it there.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => {});
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (e) {
    // Older builds want the window instead of the tab.
    try { await chrome.sidePanel.open({ windowId: tab.windowId }); } catch (_) {}
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "getActiveTab") return;

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab) {
      sendResponse({ error: "no-active-tab" });
      return;
    }
    // Chrome refuses capture on its own pages and the Web Store. tab.url is
    // only readable once activeTab has been granted, so an empty url is not
    // proof the tab is fine; it is just unknown and we let capture decide.
    if (/^(chrome|edge|about|devtools):|chromewebstore\.google\.com/.test(tab.url || "")) {
      sendResponse({ error: "unsupported-tab" });
      return;
    }
    sendResponse({ tabId: tab.id, url: tab.url || "" });
  });
  return true; // keep the channel open for the async response above
});
