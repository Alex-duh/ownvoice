// Severity switcher for the demo clip. The four files are pre-rendered by the
// same simulator at the same seed, so nothing has to run on a server for this
// page to work. That matters: the site is static and has no backend.
const player = document.getElementById("player");
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-on"));
    chip.classList.add("is-on");
    const wasPlaying = !player.paused;
    player.src = chip.dataset.src;
    if (wasPlaying) player.play().catch(() => {});
  });
});
