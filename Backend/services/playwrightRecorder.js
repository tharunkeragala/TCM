const { chromium } = require("playwright");
const crypto = require("crypto");
const { broadcast } = require("./wsHub");

const sessions = {};

function escapeSingleQuoted(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function selectorToString(sel) {
  if (!sel) return "";
  if (typeof sel === "string") return sel;
  if (sel.id) return `#${sel.id}`;
  if (sel.xpath) return `xpath=${sel.xpath}`;
  if (sel.name) return `[name="${sel.name}"]`;
  if (sel.testid) return `[data-testid="${sel.testid}"]`;
  if (sel.css) return sel.css;
  if (sel.tag) return sel.tag;
  return "";
}

function generateScript(actions = []) {
  const deduped = actions.reduce((acc, action) => {
    if (
      action.action === "fill" &&
      acc.length > 0 &&
      acc[acc.length - 1].action === "fill" &&
      JSON.stringify(acc[acc.length - 1].selector) ===
        JSON.stringify(action.selector)
    ) {
      acc[acc.length - 1] = action;
      return acc;
    }
    acc.push(action);
    return acc;
  }, []);

  return deduped
    .map((action) => {
      const sel = selectorToString(action.selector);
      switch (action.action) {
        case "navigate":
          return `await page.goto('${escapeSingleQuoted(action.url)}');`;
        case "click":
          return `await page.click('${escapeSingleQuoted(sel)}');`;
        case "fill":
          return `await page.fill('${escapeSingleQuoted(sel)}', '${escapeSingleQuoted(action.value || "")}');`;
        case "select":
          return `await page.selectOption('${escapeSingleQuoted(sel)}', '${escapeSingleQuoted(action.value || "")}');`;
        case "wait":
          return `await page.waitForTimeout(${Number(action.value) || 1000});`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

async function startRecording(url) {
  const browser = await chromium.launch({
    headless: false,
    executablePath:
      process.env.PLAYWRIGHT_BROWSER_PATH ||
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage();
  const sessionId = crypto.randomUUID();

  sessions[sessionId] = {
    browser,
    page,
    actions: [{ action: "navigate", url }],
  };

  await page.exposeFunction("__recordAction", (action) => {
    const session = sessions[sessionId];
    if (!session) return;

    const { actions } = session;
    if (
      action.action === "fill" &&
      actions.length > 0 &&
      actions[actions.length - 1].action === "fill" &&
      JSON.stringify(actions[actions.length - 1].selector) ===
        JSON.stringify(action.selector)
    ) {
      actions[actions.length - 1] = action;
    } else {
      actions.push(action);
    }

    broadcast({ type: "record_action", sessionId, action });
  });

  await page.addInitScript(() => {
    function getXPath(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return "";
      const parts = [];
      let node = el;
      while (node && node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const parent = node.parentNode;
        let siblings = [];
        if (parent) {
          siblings = Array.from(parent.children).filter(
            (c) => c.tagName === node.tagName,
          );
        }
        parts.unshift(
          siblings.length > 1 ? `${tag}[${siblings.indexOf(node) + 1}]` : tag,
        );
        node = parent;
      }
      return "/" + parts.join("/");
    }

    function getSelector(el) {
      if (!el) return null;
      return {
        id: el.id || null,
        xpath: getXPath(el),
        name: el.getAttribute("name") || null,
        testid: el.getAttribute("data-testid") || null,
        tag: el.tagName ? el.tagName.toLowerCase() : null,
      };
    }

    document.addEventListener(
      "click",
      (e) => {
        window.__recordAction({
          action: "click",
          selector: getSelector(e.target),
        });
      },
      true,
    );

    document.addEventListener(
      "change",
      (e) => {
        const t = e.target;
        const tag = t.tagName;
        const sel = getSelector(t);
        if (tag === "INPUT" || tag === "TEXTAREA") {
          window.__recordAction({
            action: "fill",
            selector: sel,
            value: t.value,
          });
        }
        if (tag === "SELECT") {
          window.__recordAction({
            action: "select",
            selector: sel,
            value: t.value,
          });
        }
      },
      true,
    );

    document.addEventListener(
      "input",
      (e) => {
        const t = e.target;
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") {
          window.__recordAction({
            action: "fill",
            selector: getSelector(t),
            value: t.value,
          });
        }
      },
      true,
    );
  });

  await page.goto(url);
  return sessionId;
}

async function stopRecording(sessionId) {
  const session = sessions[sessionId];
  if (!session) throw new Error("Session not found");

  const actions = session.actions;
  const script = generateScript(actions);

  if (session.browser) await session.browser.close().catch(() => {});
  delete sessions[sessionId];

  return { actions, script };
}

module.exports = {
  sessions,
  startRecording,
  stopRecording,
  generateScript,
  selectorToString,
};
