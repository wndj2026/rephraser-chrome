const MENU_ID = "rephrase-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Rephrase "%s"',
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = (info.selectionText || "").trim();
  if (!text) return;

  await chrome.storage.local.set({ pendingDraft: text, autoRun: true });

  try {
    if (!chrome.action.openPopup) throw new Error("openPopup unavailable");
    await chrome.action.openPopup({ windowId: tab && tab.windowId });
  } catch {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html?standalone=1"),
      type: "popup",
      width: 420,
      height: 640
    });
  }
});
