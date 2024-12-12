// Global variables to store references to YouTube controls and player
let youtubeLeftControls, youtubePlayer, youtubeProgressBar;
let currentVideo = ""; // ID of the current video
let currentVideoBookmarks = []; // List of bookmarks for the current video

// Function to fetch bookmarks from Chrome storage
const fetchBookmarks = () => {
  return new Promise((resolve) => {
    if (chrome.runtime && !chrome.runtime.lastError) {
      chrome.storage.sync.get([currentVideo], (obj) => {
        resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]) : []);
      });
    } else {
      console.error("Extension context invalidated.");
      resolve([]);
    }
  });
};

// Function to add a marker to the progress bar
const addBookmarkMarker = (time) => {
  const marker = document.createElement("div");
  marker.className = "bookmark-marker";
  marker.id = "remove" + time.toFixed(3);
  marker.style.left = `${(time / youtubePlayer.duration) * 100}%`;
  youtubeProgressBar.appendChild(marker);
};

// Function to remove a marker from the progress bar
const removeBookmarkMarker = (time) => {
  const markerId = "remove" + time.toFixed(3);
  const marker = document.getElementById(markerId);
  if (marker) {
    marker.parentNode.removeChild(marker);
  }
};

// Function to remove all markers from the progress bar
const removeAllBookmarkMarkers = () => {
  const markers = document.getElementsByClassName("bookmark-marker");
  while (markers.length > 0) {
    markers[0].parentNode.removeChild(markers[0]);
  }
};

// Function to add markers for all bookmarks
const addAllBookmarkMarkers = (bookmarks) => {
  bookmarks.forEach(bookmark => {
    addBookmarkMarker(bookmark.time);
  });
};

// Event handler to add a new bookmark
const addNewBookmarkEventHandler = async () => {
  const currentTime = youtubePlayer.currentTime;
  const newBookmark = {
    time: currentTime,
    desc: "Bookmark at " + getTime(currentTime),
  };

  currentVideoBookmarks = await fetchBookmarks();

  chrome.storage.sync.set({
    [currentVideo]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a, b) => a.time - b.time))
  });

  // Add a marker on the progress bar
  addBookmarkMarker(currentTime);

  // Send a message to the background script to show the badge
  chrome.runtime.sendMessage({ type: "SHOW_BADGE" });
};

// Function to check if the YouTube player and controls are available
const checkForPlayer = async () => {
  youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];
  youtubePlayer = document.getElementsByClassName("video-stream")[0];
  youtubeProgressBar = document.getElementsByClassName("ytp-progress-bar")[0];

  if (youtubeLeftControls && youtubePlayer && youtubeProgressBar) {
    currentVideoBookmarks = await fetchBookmarks();
    //adding a bookmark button if it doesnt exist
    const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];

    if (!bookmarkBtnExists) {
      const bookmarkBtn = document.createElement("img");

      bookmarkBtn.src = chrome.runtime.getURL("assets/bookmark.png");
      bookmarkBtn.className = "ytp-button " + "bookmark-btn";
      bookmarkBtn.title = "Click to bookmark current timestamp";

      youtubeLeftControls.appendChild(bookmarkBtn);
      bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);
    }

    // Add markers for existing bookmarks
    addAllBookmarkMarkers(currentVideoBookmarks);

    return true; // Bookmark button added and markers set
  }

  return false; // Bookmark button not added
};

// Function to add custom styles for the bookmark button and markers
const addStyles = () => {
  const style = document.createElement("style");
  style.innerHTML = `
    .bookmark-btn {
        width: 46px !important;
        height: 46px !important;
        min-width: 46px !important;
        min-height: 46px !important;
        max-width: 46px !important;
        max-height: 46px !important;
        object-fit: contain;
        margin-left: 8px;
        margin-right: 8px;
        z-index: 9999;
        padding: 0 !important;
        display: inline-block !important;
        justify-content: center;
        position: relative;
      }
     
     .bookmark-btn:hover {
        cursor: pointer;
        background-color: rgba(0, 0, 0, .05);
        border: 1px solid rgba(0, 0, 0, .05);
     }
     
    .ytp-chrome-controls {
      margin-right: 0 !important;
    }

    .bookmark-marker {
      position: absolute;
      width: 5px;
      height: 100%;
      background-color: yellow;
      z-index: 9999;
    }
  `;
  document.head.appendChild(style);
};

// Initialize the content script
const init = async () => {
  addStyles();
  return checkForPlayer();
};

//Listener for messages from the background script
chrome.runtime.onMessage.addListener(async (obj, sender, response) => {
  const { type, value, videoId } = obj;

  if (type === "NEW") {
    currentVideo = videoId;
    response(await init());
  } else if (type === "PLAY") {
    youtubePlayer.currentTime = value;
  } else if (type === "DELETE") {
    const bookmarkTime = parseFloat(value);
    currentVideoBookmarks = currentVideoBookmarks.filter((b) => b.time !== bookmarkTime);
    chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) });
    
    // Remove the visual marker
    removeBookmarkMarker(bookmarkTime);
    
    response(currentVideoBookmarks);
  } else if (type === "DELETE_ALL") {
    currentVideoBookmarks = [];
    chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) });
    
    // Remove all visual markers
    removeAllBookmarkMarkers();
    
    response(currentVideoBookmarks);
  }
});

// Utility function to format time
const getTime = t => {
  var date = new Date(0);
  date.setSeconds(t);
  return date.toISOString().substr(11, 8);
};

// Keyboard shortcut to add a new bookmark (Shift + A)
document.addEventListener('keydown', function(event) {
  if (event.shiftKey && event.key === 'A') {
    const tagName = event.target.tagName.toLowerCase();
    if (tagName !== 'input' && tagName !== 'textarea' && !event.target.isContentEditable) {
      event.preventDefault();
      addNewBookmarkEventHandler();
    }
  }
});
