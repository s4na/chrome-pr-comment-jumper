const {
  SELECTORS,
  extractCommentData,
  collectComments,
  deduplicateComments,
  escapeHtml,
} = require("../content");

describe("extractCommentData", () => {
  function makeComment({ author, avatar, body, type }) {
    const el = document.createElement("div");
    el.innerHTML =
      '<a class="author">' +
      (author || "") +
      "</a>" +
      (avatar
        ? '<img class="avatar" src="' + avatar + '" />'
        : "") +
      '<div class="comment-body">' +
      (body || "") +
      "</div>";
    return { el, type: type || "review" };
  }

  test("extracts author, avatar, preview, and type", () => {
    const { el } = makeComment({
      author: "octocat",
      avatar: "https://example.com/avatar.png",
      body: "Looks good!",
    });
    const data = extractCommentData(el, "review");
    expect(data).toEqual({
      element: el,
      author: "octocat",
      avatar: "https://example.com/avatar.png",
      preview: "Looks good!",
      type: "review",
    });
  });

  test("returns null for empty comment body", () => {
    const { el } = makeComment({ author: "user", body: "" });
    expect(extractCommentData(el, "review")).toBeNull();
  });

  test("returns null for whitespace-only body", () => {
    const { el } = makeComment({ author: "user", body: "   \n\t  " });
    expect(extractCommentData(el, "review")).toBeNull();
  });

  test("returns null for null element", () => {
    expect(extractCommentData(null, "review")).toBeNull();
  });

  test("handles missing author gracefully", () => {
    const el = document.createElement("div");
    el.innerHTML = '<div class="comment-body">Some text</div>';
    const data = extractCommentData(el, "general");
    expect(data.author).toBe("Unknown");
  });

  test("handles missing avatar gracefully", () => {
    const el = document.createElement("div");
    el.innerHTML =
      '<a class="author">user</a>' +
      '<div class="comment-body">Some text</div>';
    const data = extractCommentData(el, "review");
    expect(data.avatar).toBe("");
  });

  test("truncates preview to 120 characters", () => {
    const longText = "a".repeat(200);
    const { el } = makeComment({ author: "user", body: longText });
    const data = extractCommentData(el, "review");
    expect(data.preview).toHaveLength(120);
  });
});

describe("collectComments", () => {
  test("collects review comments", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<div class="review-comment">' +
      '<a class="author">alice</a>' +
      '<div class="comment-body">Review feedback</div>' +
      "</div>";
    const result = collectComments(root);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("review");
    expect(result[0].author).toBe("alice");
  });

  test("collects general comments", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<div class="timeline-comment">' +
      '<a class="author">bob</a>' +
      '<div class="comment-body">General comment</div>' +
      "</div>";
    const result = collectComments(root);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("general");
  });

  test("does not double-count nested comments", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<div class="review-comment">' +
      '<div class="timeline-comment">' +
      '<a class="author">charlie</a>' +
      '<div class="comment-body">Nested comment</div>' +
      "</div>" +
      "</div>";
    const result = collectComments(root);
    // Should only appear once as review comment
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("review");
  });

  test("returns empty array when no comments", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>No comments here</p>";
    expect(collectComments(root)).toEqual([]);
  });

  test("collects both review and general comments", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<div class="review-comment">' +
      '<a class="author">alice</a>' +
      '<div class="comment-body">Review</div>' +
      "</div>" +
      '<div class="timeline-comment">' +
      '<a class="author">bob</a>' +
      '<div class="comment-body">General</div>' +
      "</div>";
    const result = collectComments(root);
    expect(result).toHaveLength(2);
  });
});

describe("deduplicateComments", () => {
  test("removes duplicate elements", () => {
    const el = document.createElement("div");
    const comments = [
      { element: el, author: "a", preview: "x", type: "review" },
      { element: el, author: "a", preview: "x", type: "review" },
    ];
    expect(deduplicateComments(comments)).toHaveLength(1);
  });

  test("keeps distinct elements", () => {
    const el1 = document.createElement("div");
    const el2 = document.createElement("div");
    const comments = [
      { element: el1, author: "a", preview: "x", type: "review" },
      { element: el2, author: "b", preview: "y", type: "general" },
    ];
    expect(deduplicateComments(comments)).toHaveLength(2);
  });

  test("handles empty array", () => {
    expect(deduplicateComments([])).toEqual([]);
  });
});

describe("escapeHtml", () => {
  test("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).not.toContain(
      "<script>"
    );
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  test("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  test("escapes double quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  test("escapes single quotes", () => {
    expect(escapeHtml("'hello'")).toBe("&#39;hello&#39;");
  });

  test("passes through safe strings unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  test("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});
