const DEFAULT = "http://localhost:7860";

chrome.storage.sync.get({ apiBase: DEFAULT }).then(({ apiBase }) => {
  document.getElementById("api").value = apiBase;
});

document.getElementById("save").onclick = async () => {
  const raw = document.getElementById("api").value.trim() || DEFAULT;
  const url = raw.replace(/\/+$/, "");

  // A remote host needs its own grant; localhost is already in host_permissions.
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
    try {
      const granted = await chrome.permissions.request({ origins: [url + "/*"] });
      if (!granted) {
        document.getElementById("ok").textContent = "Permission declined.";
        return;
      }
    } catch (e) {
      document.getElementById("ok").textContent = String(e.message || e);
      return;
    }
  }
  await chrome.storage.sync.set({ apiBase: url });
  document.getElementById("ok").textContent = "Saved.";
  setTimeout(() => (document.getElementById("ok").textContent = ""), 2000);
};
