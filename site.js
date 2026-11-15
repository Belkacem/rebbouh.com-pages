// Keep the section when changing language. The page works without JavaScript.
document.querySelectorAll(".language a").forEach((link) => {
  link.addEventListener("click", () => {
    link.hash = window.location.hash;
  });
});
