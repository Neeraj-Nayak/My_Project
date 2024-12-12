// A helper function to handle the initialization of the content script
const initContentScript = (tabId, url) => {
  const videoId = new URLSearchParams(new URL(url).search).get("v");
  if (videoId) {
    // Send a message to the content script to notify a new video has been loaded
    chrome.tabs.sendMessage(tabId, { type: "NEW", videoId });
  }
};

// Listener for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the tab has fully loaded and is a YouTube video page
  if (changeInfo.status === "complete" && tab.url.includes("youtube.com/watch")) {
    initContentScript(tabId, tab.url);
  }
});

// Listener for history state updates (e.g., when navigating to a new video via in-page links)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.url.includes("youtube.com/watch")) {
    initContentScript(details.tabId, details.url);
  }   
});

// Function to show a badge on the extension icon
const showBadge = () => {
  chrome.action.setBadgeText({ text: "\u2713" });
  chrome.action.setBadgeBackgroundColor({ color: "#32bea6" });

  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, 1500);
};

// Listener for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SHOW_BADGE") {
    showBadge();
  }
});

// Listener for adding a new bookmark
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'ADD_BOOKMARK') {
    addNewBookmarkEventHandler();
  }
});
