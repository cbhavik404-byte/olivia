const statusBadge = document.getElementById("statusBadge");
const statusMeta = document.getElementById("statusMeta");
const wsInput = document.getElementById("wsInput");
const saveBtn = document.getElementById("saveBtn");
const scanBtn = document.getElementById("scanBtn");

function refreshStatus() {
  chrome.runtime.sendMessage({ type: "get_status" }, (res) => {
    if (chrome.runtime.lastError || !res) return;
    if (wsInput && !wsInput.value && res.wsUrl) {
      wsInput.value = res.wsUrl;
    }
    if (res.connected) {
      const label =
        res.mode === "ws"
          ? "CONNECTED (WS)"
          : res.pageBridgeWsConnected
            ? "CONNECTED (RELAY)"
            : "CONNECTED (PAGE)";
      statusBadge.textContent = label;
      statusBadge.className = "badge connected";
      statusMeta.textContent = `Tracking ${res.tabCount || 0} open Chrome tab(s). Bridge ready.`;
    } else {
      statusBadge.textContent = "OFFLINE";
      statusBadge.className = "badge offline";
      statusMeta.textContent =
        "Open NEXA in Chrome or AI Studio, then click 'Connect Open Tabs'.";
    }
  });
}

scanBtn.addEventListener("click", () => {
  statusMeta.textContent = "Scanning & injecting bridge into open NEXA tabs...";
  chrome.runtime.sendMessage({ type: "scan_tabs" }, (res) => {
    setTimeout(() => {
      refreshStatus();
      if (res && typeof res.injectedCount === "number") {
        statusMeta.textContent =
          res.injectedCount > 0
            ? `Paired with ${res.injectedCount} open NEXA/AI Studio tab(s)!`
            : "No open AI Studio or NEXA tab found. Keep NEXA open and try again.";
      }
    }, 500);
  });
});

saveBtn.addEventListener("click", () => {
  const val = (wsInput.value || "").trim();
  if (!val) return;
  chrome.storage.local.set({ nexaWsUrl: val }, () => {
    chrome.runtime.sendMessage({ type: "reconnect" }, () => {
      setTimeout(refreshStatus, 600);
    });
  });
});

refreshStatus();
setInterval(refreshStatus, 2000);
