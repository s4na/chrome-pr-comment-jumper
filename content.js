// PR Comment Jumper - Content Script

const SELECTORS = {
  reviewComment: ".review-comment, .js-comment-container",
  generalComment: ".timeline-comment, .js-timeline-item .comment",
  commentBody: ".comment-body, .js-comment-body",
  authorLink: ".author, a.Link--primary[data-hovercard-type='user']",
  avatar: "img.avatar, img.avatar-user",
  outdatedContainer: ".outdated-comment",
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
  var existing = document.getElementById("pr-comment-jumper-panel");
  if (existing) existing.remove();
  var existingToggle = document.getElementById("pr-comment-jumper-toggle");
  if (existingToggle) existingToggle.remove();

  var toggle = document.createElement("button");
  toggle.id = "pr-comment-jumper-toggle";
  toggle.setAttribute("aria-label", "Toggle comment panel");
  toggle.textContent = "\uD83D\uDCAC";
  toggle.addEventListener("click", togglePanel);
  document.body.appendChild(toggle);

  var panel = document.createElement("div");
  panel.id = "pr-comment-jumper-panel";
  panel.innerHTML =
    '<div class="panel-header">' +
    "<span>Comments</span>" +
    '<span class="comment-count"></span>' +
    "</div>" +
    '<div class="panel-body"></div>';
  document.body.appendChild(panel);

  renderCommentList();
}

function renderCommentList() {
  var panel = document.getElementById("pr-comment-jumper-panel");
  if (!panel) return;

  var body = panel.querySelector(".panel-body");
  var countEl = panel.querySelector(".comment-count");
  var comments = deduplicateComments(collectComments(document));

  if (comments.length === 0) {
    body.innerHTML = '<div class="panel-empty">No comments found</div>';
    countEl.textContent = "";
    return;
  }

  countEl.textContent = comments.length + " comments";

  body.innerHTML = comments
    .map(function (c, i) {
      var avatarHtml = c.avatar
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
    var idx = parseInt(item.getAttribute("data-index"), 10);
    item.addEventListener("click", function () {
      scrollToComment(comments[idx].element);
    });
  });
}

function togglePanel() {
  var panel = document.getElementById("pr-comment-jumper-panel");
  if (!panel) return;

  var isOpen = panel.classList.contains("open");
  if (isOpen) {
    panel.classList.remove("open");
  } else {
    renderCommentList();
    panel.classList.add("open");
  }
}

function scrollToComment(element) {
  if (!element) return;

  // Expand collapsed/outdated threads if needed
  var outdated = element.closest(".outdated-comment");
  if (outdated) {
    var showBtn = outdated.querySelector(
      "button[aria-expanded='false'], .btn-link"
    );
    if (showBtn) showBtn.click();
  }

  // Expand minimized comments
  var minimized = element.closest("details:not([open])");
  if (minimized) {
    minimized.open = true;
  }

  // Wait for layout to settle after expanding collapsed sections
  var needsLayoutWait = outdated || minimized;
  if (needsLayoutWait) {
    requestAnimationFrame(function () {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  } else {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }

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

var currentObserver = null;

function setupObserver() {
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }

  var debounceTimer = null;
  var observer = new MutationObserver(function (mutations) {
    var hasNewComments = mutations.some(function (m) {
      return m.addedNodes.length > 0;
    });
    if (hasNewComments) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var panel = document.getElementById("pr-comment-jumper-panel");
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

function init() {
  // Only run on PR pages (files tab or conversation)
  if (!/\/pull\/\d+/.test(window.location.pathname)) return;

  createPanel();
  setupObserver();
}

// GitHub SPA navigation support
document.addEventListener("turbo:load", init);

// Initial load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
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
