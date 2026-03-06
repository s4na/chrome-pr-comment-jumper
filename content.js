// PR Comment Jumper - Content Script

const SELECTORS = {
  reviewComment: ".review-comment, .js-comment-container",
  generalComment: ".timeline-comment, .js-timeline-item .comment",
  commentBody: ".comment-body, .js-comment-body",
  authorLink: ".author, a.Link--primary[data-hovercard-type='user']",
  avatar: "img.avatar, img.avatar-user",
  outdatedContainer: ".outdated-comment",
  expandButton: "button[aria-expanded='false'], .btn-link",
};

function extractCommentData(element, type) {
  if (!element) return null;

  const bodyEl = element.querySelector(SELECTORS.commentBody);
  const text = bodyEl ? bodyEl.textContent.trim() : "";
  if (!text) return null;

  const authorEl = element.querySelector(SELECTORS.authorLink);
  const avatarEl = element.querySelector(SELECTORS.avatar);

  return {
    element: element,
    author: authorEl ? authorEl.textContent.trim() : "Unknown",
    avatar: avatarEl ? avatarEl.src : "",
    preview: text.slice(0, 120),
    type: type,
  };
}

function collectComments(rootElement) {
  const root = rootElement || document;
  const comments = [];

  root.querySelectorAll(SELECTORS.reviewComment).forEach(function (el) {
    const data = extractCommentData(el, "review");
    if (data) comments.push(data);
  });

  root.querySelectorAll(SELECTORS.generalComment).forEach(function (el) {
    // Skip if already captured as review comment
    if (el.closest(SELECTORS.reviewComment)) {
      return;
    }
    const data = extractCommentData(el, "general");
    if (data) comments.push(data);
  });

  return comments;
}

function deduplicateComments(comments) {
  const seen = new Set();
  return comments.filter(function (c) {
    if (seen.has(c.element)) return false;
    seen.add(c.element);
    return true;
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPanel() {
  const existing = document.getElementById("pr-comment-jumper-panel");
  if (existing) existing.remove();
  const existingToggle = document.getElementById("pr-comment-jumper-toggle");
  if (existingToggle) existingToggle.remove();

  const toggle = document.createElement("button");
  toggle.id = "pr-comment-jumper-toggle";
  toggle.setAttribute("aria-label", "Toggle comment panel");
  toggle.textContent = "\uD83D\uDCAC";
  toggle.addEventListener("click", togglePanel);
  document.body.appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = "pr-comment-jumper-panel";
  panel.innerHTML =
    '<div class="panel-header">' +
    "<span>Comments</span>" +
    '<div class="panel-header-right">' +
    '<span class="comment-count"></span>' +
    '<button class="panel-close" aria-label="Close panel">&times;</button>' +
    "</div>" +
    "</div>" +
    '<div class="panel-body"></div>';

  panel.querySelector(".panel-close").addEventListener("click", togglePanel);
  document.body.appendChild(panel);

  document.addEventListener("click", function (e) {
    if (panel.classList.contains("open") &&
        !panel.contains(e.target) &&
        e.target !== toggle) {
      setPanelOpen(false);
    }
  });

  renderCommentList();
}

let lastCommentSignature = "";

function renderCommentList() {
  const panel = document.getElementById("pr-comment-jumper-panel");
  if (!panel) return;

  const body = panel.querySelector(".panel-body");
  const countEl = panel.querySelector(".comment-count");
  const comments = deduplicateComments(collectComments(document));

  // Skip re-render if comment list hasn't changed
  const signature = comments.map(function (c) { return c.author + ":" + c.preview; }).join("|");
  if (signature === lastCommentSignature) return;
  lastCommentSignature = signature;

  if (comments.length === 0) {
    body.innerHTML = '<div class="panel-empty">No comments found</div>';
    countEl.textContent = "";
    return;
  }

  countEl.textContent = comments.length + (comments.length === 1 ? " comment" : " comments");

  body.innerHTML = comments
    .map(function (c, i) {
      const avatarHtml = c.avatar
        ? '<img class="comment-avatar" src="' +
          escapeHtml(c.avatar) +
          '" alt="" />'
        : "";
      return (
        '<div class="comment-item" data-index="' +
        i +
        '">' +
        avatarHtml +
        '<div class="comment-content">' +
        '<div class="comment-meta">' +
        '<span class="comment-author">' +
        escapeHtml(c.author) +
        "</span>" +
        '<span class="comment-type ' +
        escapeHtml(c.type) +
        '">' +
        escapeHtml(c.type) +
        "</span>" +
        "</div>" +
        '<div class="comment-preview">' +
        escapeHtml(c.preview) +
        "</div>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  body.querySelectorAll(".comment-item").forEach(function (item) {
    const idx = parseInt(item.getAttribute("data-index"), 10);
    item.addEventListener("click", function () {
      const target = comments[idx].element;
      if (target && target.isConnected) {
        scrollToComment(target);
      } else {
        // Element was removed from DOM (e.g. tab switch, Turbo update);
        // re-collect comments and re-render the list
        lastCommentSignature = "";
        renderCommentList();
      }
    });
  });
}

function setPanelOpen(open) {
  const panel = document.getElementById("pr-comment-jumper-panel");
  if (!panel) return;

  if (open) {
    lastCommentSignature = "";
    renderCommentList();
    panel.classList.add("open");
  } else {
    panel.classList.remove("open");
  }

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ panelOpen: open });
  }
}

function togglePanel() {
  const panel = document.getElementById("pr-comment-jumper-panel");
  if (!panel) return;

  setPanelOpen(!panel.classList.contains("open"));
}

function scrollToComment(element) {
  if (!element) return;

  // Expand collapsed/outdated threads if needed
  const outdated = element.closest(SELECTORS.outdatedContainer);
  if (outdated) {
    const showBtn = outdated.querySelector(SELECTORS.expandButton);
    if (showBtn) showBtn.click();
  }

  // Expand minimized comments
  const minimized = element.closest("details:not([open])");
  if (minimized) {
    minimized.open = true;
  }

  function scrollAndHighlight() {
    var rect = element.getBoundingClientRect();
    window.scrollBy({ top: rect.top - 10, behavior: "smooth" });

    element.classList.remove("pr-comment-jumper-highlight");
    // Force reflow to restart animation
    void element.offsetWidth;
    element.classList.add("pr-comment-jumper-highlight");

    element.addEventListener(
      "animationend",
      function () {
        element.classList.remove("pr-comment-jumper-highlight");
      },
      { once: true }
    );
  }

  // Wait for layout to settle after expanding collapsed sections
  if (outdated || minimized) {
    setTimeout(scrollAndHighlight, 200);
  } else {
    scrollAndHighlight();
  }
}

let currentObserver = null;

function setupObserver() {
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }

  let debounceTimer = null;
  const observer = new MutationObserver(function (mutations) {
    const hasNewComments = mutations.some(function (m) {
      return m.addedNodes.length > 0;
    });
    if (hasNewComments) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        const panel = document.getElementById("pr-comment-jumper-panel");
        if (panel && panel.classList.contains("open")) {
          renderCommentList();
        }
      }, 300);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  currentObserver = observer;
  return observer;
}

let lastInitUrl = null;

function init() {
  // Only run on PR pages (files tab or conversation)
  if (!/\/pull\/\d+/.test(window.location.pathname)) return;

  // Avoid duplicate init for the same URL (e.g. initial load + turbo:load)
  if (lastInitUrl === window.location.href && document.getElementById("pr-comment-jumper-panel")) return;
  lastInitUrl = window.location.href;

  lastCommentSignature = "";
  createPanel();
  setupObserver();

  // Restore panel open/close state
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("panelOpen", function (result) {
      if (result.panelOpen) {
        setPanelOpen(true);
      }
    });
  }
}

function cleanup() {
  const panel = document.getElementById("pr-comment-jumper-panel");
  if (panel) panel.remove();
  const toggle = document.getElementById("pr-comment-jumper-toggle");
  if (toggle) toggle.remove();
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }
  lastInitUrl = null;
  lastCommentSignature = "";
}

// GitHub SPA navigation support
function onTurboLoad() {
  if (!/\/pull\/\d+/.test(window.location.pathname)) {
    cleanup();
    return;
  }
  init();
}

document.addEventListener("turbo:load", onTurboLoad);

// Initial load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { init(); });
} else {
  init();
}

// Export for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SELECTORS: SELECTORS,
    extractCommentData: extractCommentData,
    collectComments: collectComments,
    deduplicateComments: deduplicateComments,
    escapeHtml: escapeHtml,
  };
}
