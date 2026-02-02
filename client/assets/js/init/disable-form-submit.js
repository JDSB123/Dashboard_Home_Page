document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll("form.sportsbook-actions-row, form.sportsbook-credentials-group")
    .forEach((f) => {
      f.addEventListener("submit", (e) => e.preventDefault());
    });
});
