import { getActiveTabURL } from "./utils.js";
import { getTime } from "./utils.js";

// Show the modal for editing a bookmark note
const showEditModal = (bookmark) => {
  const editModal = document.getElementById("editModal");
  const editNoteText = document.getElementById("editNoteText");

  editNoteText.value = bookmark.desc;
  editModal.style.display = "block";

  const saveButton = document.getElementById("saveEdit");
  saveButton.onclick = () => {
    const editedText = editNoteText.value;
    editBookmarkNote(bookmark, editedText);
  };

  const cancelButton = document.getElementById("cancelEdit");
  cancelButton.onclick = () => {
    editModal.style.display = "none";
  };
};

// Edit a bookmark note
const editBookmarkNote = async (bookmark, editedText) => {
  const activeTab = await getActiveTabURL();
  const currentVideo = new URLSearchParams(activeTab.url.split("?")[1]).get("v");

  chrome.storage.sync.get([currentVideo], (data) => {
    let currentBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];

    // Find and update the corresponding bookmark
    for (let i = 0; i < currentBookmarks.length; i++) {
      if (currentBookmarks[i].time === bookmark.time) {
        currentBookmarks[i].desc = editedText;
        // break;
      }
    }

    // Update the stored bookmarks with the new note in chrome storage
    chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentBookmarks) }, () => {
      console.log("Bookmark note updated.");
    });

    // Refresh the bookmarks view
    viewBookmarks(currentBookmarks);
  });

  // Hide the modal
  document.getElementById("editModal").style.display = "none";
};

// Show the full note when a bookmark is clicked
const showFullNote = (bookmarkNoteElement, note) => {
  const fullNote = document.createElement("div");
  fullNote.innerHTML = note;
  fullNote.className = "full-note";
  fullNote.style.display = "none";
  bookmarkNoteElement.appendChild(fullNote);

  bookmarkNoteElement.addEventListener("click", () => {
    if (fullNote.style.display === "none") {
      fullNote.style.display = "block";
    } else {
      fullNote.style.display = "none";
    }
  });
};

// Add a new bookmark to the bookmarks view
const addNewBookmark = (bookmarksElement, bookmark) => {
  const bookmarkTimestampElement = document.createElement("div");
  const bookmarkNoteElement = document.createElement("div");
  const newBookmarkElement = document.createElement("div");
  const controlsElement = document.createElement("div");

  bookmarkTimestampElement.textContent = getTime(bookmark.time);
  bookmarkTimestampElement.className = "bookmark-timestamp";
  bookmarkNoteElement.textContent = bookmark.desc;
  bookmarkNoteElement.className = "bookmark-note";
  showFullNote(bookmarkNoteElement, bookmark.desc);
  controlsElement.className = "bookmark-controls";

  setBookmarkAttributes("play", onPlay, controlsElement);
  setBookmarkAttributes("edit", onEdit, controlsElement);

  // Create a closure for the onDelete event listener
  const onDeleteClosure = (e) => {
    onDelete(e, bookmark.time);
  };
  setBookmarkAttributes("delete", onDeleteClosure, controlsElement);

  newBookmarkElement.id = "bookmark-" + bookmark.time.toFixed(3);
  newBookmarkElement.className = "bookmark";
  newBookmarkElement.setAttribute("timestamp", bookmark.time);

  newBookmarkElement.appendChild(bookmarkTimestampElement);
  newBookmarkElement.appendChild(bookmarkNoteElement);
  newBookmarkElement.appendChild(controlsElement);
  bookmarksElement.appendChild(newBookmarkElement);
};

// Display the bookmarks for the current video
const viewBookmarks = (currentBookmarks = []) => {
  const bookmarksElement = document.getElementById("bookmarks");
  bookmarksElement.innerHTML = "";

  // Add "Delete all" button if there are at least 2 bookmarks
  if (currentBookmarks.length >= 2) {
    const deleteAllButton = document.createElement("button");
    deleteAllButton.textContent = "Delete all";
    deleteAllButton.id = "delete-all";
    deleteAllButton.className = "delete-all-button";
    bookmarksElement.appendChild(deleteAllButton);

    deleteAllButton.addEventListener("click", onDeleteAll);
  }

  if (currentBookmarks.length > 0) {
    for (const bookmark of currentBookmarks) {
      addNewBookmark(bookmarksElement, bookmark);
    }
  } else {
    bookmarksElement.innerHTML = '<i class="row">No bookmarks to show.</i>';
  }
};

// Event handler to play a bookmarked video time
const onPlay = async e => {
  const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
  const activeTab = await getActiveTabURL();

  chrome.tabs.sendMessage(activeTab.id, {
    type: "PLAY",
    value: bookmarkTime,
  });
};

// Event handler to edit a bookmark note
const onEdit = async e => {
  const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
  const activeTab = await getActiveTabURL();
  const currentVideo = new URLSearchParams(activeTab.url.split("?")[1]).get("v");

  chrome.storage.sync.get([currentVideo], (data) => {
    let currentBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];

    // Find the corresponding bookmark
    const bookmarkToEdit = currentBookmarks.find(bookmark => bookmark.time === parseFloat(bookmarkTime));

    if (bookmarkToEdit) {
      showEditModal(bookmarkToEdit);
    }
  });
};

// Event handler to delete a bookmark
const onDelete = async (e, bookmarkTime) => {
  const activeTab = await getActiveTabURL();
  const queryParameters = activeTab.url.split("?")[1];
  const urlParameters = new URLSearchParams(queryParameters);
  const currentVideo = urlParameters.get("v");
  const bookmarkElementToDelete = document.getElementById("bookmark-" + bookmarkTime.toFixed(3));

  bookmarkElementToDelete.parentNode.removeChild(bookmarkElementToDelete);

  // Fetch the stored bookmarks
  chrome.storage.sync.get([currentVideo], (data) => {
    let currentBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];

    // Filter out the deleted bookmarks
    currentBookmarks = currentBookmarks.filter(bookmark => Math.abs(bookmark.time - bookmarkTime) > 0.001);

    // Update the stored bookmarks
    chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentBookmarks) }, () => {
      console.log("Bookmark deleted and storage updated.");
    });
  });

  chrome.tabs.sendMessage(activeTab.id, {
    type: "DELETE",
    value: bookmarkTime,
  });
};

// Event handler to delete all bookmarks for the current video
const onDeleteAll = async () => {
  const activeTab = await getActiveTabURL();
  const currentVideo = new URLSearchParams(activeTab.url.split("?")[1]).get("v");

  // Clear all stored bookmarks for the current video
  chrome.storage.sync.set({ [currentVideo]: JSON.stringify([]) }, () => {
    console.log("All bookmarks deleted and storage updated.");
  });

  chrome.tabs.sendMessage(activeTab.id, {
    type: "DELETE_ALL",
  });

  // Refresh the bookmarks view
  viewBookmarks([]);
};

// Function to set attributes for bookmark control buttons
const setBookmarkAttributes = (src, eventListener, controlParentElement) => {
  const controlElement = document.createElement("img");

  controlElement.src = "assets/" + src + ".png";
  controlElement.title = src;
  controlElement.addEventListener("click", eventListener);
  controlParentElement.appendChild(controlElement);

  return eventListener;
};

// Initialize the popup script
document.addEventListener("DOMContentLoaded", async () => {
  const activeTab = await getActiveTabURL();
  const queryParameters = activeTab.url.split("?")[1];
  const urlParameters = new URLSearchParams(queryParameters);

  const currentVideo = urlParameters.get("v");

  if (activeTab.url.includes("youtube.com/watch") && currentVideo) {
    chrome.storage.sync.get([currentVideo], (data) => {
      const currentVideoBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];

      viewBookmarks(currentVideoBookmarks);
    });
  } else {
    const container = document.getElementsByClassName("container")[0];

    container.innerHTML = '<div class="title">This is not a YouTube video page.</div>';
  }
});
