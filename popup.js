const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

const SYSTEM_PROMPT = `You are a chat rephraser tool. The user will give you a rough or broken-English draft of a chat message (for Slack, WhatsApp, Teams, Discord, or quick work messages).

Fix the grammar and phrasing and return 3 natural variations in JSON format:
1. "Relaxed & Pro": Professional enough for work, but relaxed, human, and conversational. Not stiff, not robotic, no corporate buzzwords.
2. "Short & Direct": Concise, punchy, casual-professional. Gets straight to the point in as few words as possible.
3. "Warm & Friendly": Polite, warm, and approachable while still sounding like a real person in chat.

Rules:
- Keep the exact original meaning and intent.
- Never add stiff email openings/closings like "I hope this message finds you well" or "Best regards".
- Do not use em-dashes (—) or overly fancy vocabulary.
- Match the casual-professional register of modern workplace chat.

Respond ONLY with valid JSON in this exact structure:
{
  "variations": [
    {"label": "Relaxed & Pro", "text": "..."},
    {"label": "Short & Direct", "text": "..."},
    {"label": "Warm & Friendly", "text": "..."}
  ]
}`;

const standalone = new URLSearchParams(location.search).has("standalone");

const els = {
  settings: document.getElementById("settings"),
  settingsToggle: document.getElementById("settingsToggle"),
  apiKey: document.getElementById("apiKey"),
  keyVisibility: document.getElementById("keyVisibility"),
  keyStatus: document.getElementById("keyStatus"),
  saveKey: document.getElementById("saveKey"),
  draft: document.getElementById("draft"),
  run: document.getElementById("run"),
  paste: document.getElementById("paste"),
  clear: document.getElementById("clear"),
  error: document.getElementById("error"),
  results: document.getElementById("results"),
  cards: document.getElementById("cards"),
  copiedNote: document.getElementById("copiedNote")
};

let apiKey = "";
let running = false;
let draftTimer = null;
let copiedTimer = null;

init();

async function init() {
  const saved = await chrome.storage.local.get(["apiKey", "draft", "pendingDraft", "autoRun"]);
  apiKey = String(saved.apiKey || "").trim();
  els.apiKey.value = apiKey;

  const selection = await readPageSelection();
  const pending = String(saved.pendingDraft || "").trim();
  const incoming = selection || pending;
  const autoRun = Boolean(saved.autoRun) && Boolean(incoming);

  if (saved.pendingDraft || saved.autoRun) {
    await chrome.storage.local.remove(["pendingDraft", "autoRun"]);
  }

  els.draft.value = incoming || String(saved.draft || "");

  if (!apiKey) {
    setSettingsOpen(true);
    els.keyStatus.textContent = "Key not set";
    return;
  }

  if (autoRun) {
    runRephrase();
  } else {
    els.draft.focus();
    const end = els.draft.value.length;
    els.draft.setSelectionRange(end, end);
  }
}

async function readPageSelection() {
  if (standalone) return "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return "";
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.activeElement;
        if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
          try {
            return el.value.substring(el.selectionStart, el.selectionEnd);
          } catch (err) {
            /* fall through to document selection */
          }
        }
        return window.getSelection ? window.getSelection().toString() : "";
      }
    });
    return String((result && result.result) || "").trim();
  } catch (err) {
    return "";
  }
}

function setSettingsOpen(open) {
  els.settings.hidden = !open;
  els.settingsToggle.setAttribute("aria-expanded", String(open));
  if (open) {
    els.apiKey.focus();
  } else {
    els.draft.focus();
  }
}

els.settingsToggle.addEventListener("click", () => {
  const open = els.settings.hidden;
  setSettingsOpen(open);
  if (!open) els.keyStatus.textContent = "";
});

els.keyVisibility.addEventListener("click", () => {
  const show = els.apiKey.type === "password";
  els.apiKey.type = show ? "text" : "password";
  els.keyVisibility.textContent = show ? "Hide" : "Show";
});

els.saveKey.addEventListener("click", async () => {
  const next = els.apiKey.value.trim();
  apiKey = next;
  await chrome.storage.local.set({ apiKey: next });
  els.keyStatus.textContent = next ? "Saved" : "Key cleared";
  if (next) {
    setTimeout(() => {
      if (els.keyStatus.textContent === "Saved") els.keyStatus.textContent = "";
      setSettingsOpen(false);
    }, 700);
  }
});

els.draft.addEventListener("input", () => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    chrome.storage.local.set({ draft: els.draft.value });
  }, 250);
});

els.run.addEventListener("click", runRephrase);

els.clear.addEventListener("click", () => {
  els.draft.value = "";
  els.cards.replaceChildren();
  els.results.hidden = true;
  els.copiedNote.textContent = "";
  clearError();
  chrome.storage.local.remove("draft");
  els.draft.focus();
});

els.paste.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    els.draft.value = els.draft.value ? els.draft.value + " " + text : text;
    els.draft.focus();
  } catch (err) {
    showError("Couldn't read the clipboard. Use Ctrl/Cmd+V instead.");
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    runRephrase();
  }
});

els.draft.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    runRephrase();
  }
});

async function runRephrase() {
  const text = els.draft.value.trim();
  if (running) return;

  if (!apiKey) {
    setSettingsOpen(true);
    showError("Save your DeepSeek API key first.");
    return;
  }
  if (!text) {
    showError("Type or paste a message to rephrase.");
    els.draft.focus();
    return;
  }

  clearError();
  setRunning(true);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 600
      }),
      signal: controller.signal
    });

    const raw = await response.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch (err) {
      throw new Error("Unexpected response from DeepSeek.");
    }

    if (!response.ok) {
      const reason = body && body.error && body.error.message ? body.error.message : "";
      throw new Error("DeepSeek API error (" + response.status + ")" + (reason ? ": " + reason : ""));
    }

    const content = body && body.choices && body.choices[0] && body.choices[0].message
      ? body.choices[0].message.content
      : "";
    if (!content) throw new Error("DeepSeek returned an empty response.");

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error("Couldn't parse the variations. Try again.");
    }

    const variations = Array.isArray(parsed.variations)
      ? parsed.variations.filter((item) => item && typeof item.text === "string" && item.text.trim())
      : [];
    if (!variations.length) throw new Error("DeepSeek returned no variations. Try again.");

    render(variations);
  } catch (err) {
    if (err.name === "AbortError") {
      showError("Request timed out. Try again.");
    } else if (err instanceof TypeError) {
      showError("Network error. Check your connection and try again.");
    } else {
      showError(err.message || "Something went wrong.");
    }
  } finally {
    clearTimeout(timeout);
    setRunning(false);
  }
}

function render(variations) {
  els.cards.replaceChildren();
  els.copiedNote.textContent = "";

  variations.forEach((variation, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";

    const head = document.createElement("span");
    head.className = "card-head";

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = variation.label || "Variation " + (index + 1);

    const action = document.createElement("span");
    action.className = "action";
    action.textContent = "Copy";

    head.append(label, action);

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = variation.text.trim();

    card.append(head, text);
    card.addEventListener("click", () => copyVariation(card, action, text.textContent));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        copyVariation(card, action, text.textContent);
      }
    });

    els.cards.append(card);
  });

  els.results.hidden = false;
}

async function copyVariation(card, action, text) {
  let ok = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    ok = fallbackCopy(text);
  }
  if (!ok) {
    showError("Couldn't copy to the clipboard.");
    return;
  }

  els.cards.querySelectorAll(".card.copied").forEach((other) => {
    other.classList.remove("copied");
    const otherAction = other.querySelector(".action");
    if (otherAction) otherAction.textContent = "Copy";
  });

  card.classList.add("copied");
  action.textContent = "Copied";
  els.copiedNote.textContent = "Copied";

  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    card.classList.remove("copied");
    action.textContent = "Copy";
    els.copiedNote.textContent = "";
  }, 1800);
}

function fallbackCopy(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (err) {
    ok = false;
  }
  field.remove();
  return ok;
}

function setRunning(next) {
  running = next;
  els.run.disabled = next;
  els.run.textContent = next ? "Rephrasing..." : "Rephrase";
}

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
}

function clearError() {
  els.error.textContent = "";
  els.error.hidden = true;
}
