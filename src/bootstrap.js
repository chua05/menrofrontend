export const STARTUP_MESSAGE = "MENRO could not load. Please reload the page. If the problem continues, contact MENRO support.";

export function showStartupFailure(root, documentLike = document) {
  const panel = documentLike.createElement("section");
  panel.className = "startup-panel";
  panel.setAttribute("role", "alert");
  const title = documentLike.createElement("h1");
  title.textContent = "Unable to load MENRO";
  const message = documentLike.createElement("p");
  message.textContent = STARTUP_MESSAGE;
  const reload = documentLike.createElement("a");
  reload.href = "";
  reload.textContent = "Reload page";
  panel.append(title, message, reload);
  root.replaceChildren(panel);
}

export async function bootstrapApplication(load, root, report = error => console.error("MENRO startup failed:", error)) {
  try {
    const application = await load();
    application.mount(root);
    return true;
  } catch (error) {
    showStartupFailure(root);
    report(error);
    return false;
  }
}
