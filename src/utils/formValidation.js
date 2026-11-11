// Run after React commits inline errors. Choose DOM order in the current form,
// rather than validation-object insertion order, and focus without a second scroll.
export function focusFirstInvalid(root) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    const form = typeof root === "function" ? root() : root;
    if (!form) return;
    const field = form.querySelector('[aria-invalid="true"], .sr-invalid-field, .pr-invalid-field');
    if (!field) return;
    const visibleField = field.matches('input[type="file"],input[type="hidden"]') ? field.parentElement : field;
    const control = visibleField.matches('input,select,textarea,button,[tabindex]') ? visibleField :
      visibleField.querySelector('input:not([type="hidden"]):not([type="file"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])') || visibleField.querySelector('input[type="file"]');
    const anchor = visibleField.closest(".sr-form-field,.pr-field,.pr-invalid-field") || visibleField;
    const scrollAnchor = anchor.getBoundingClientRect().height > window.innerHeight - 140 && control ? control : anchor;
    const box = scrollAnchor.getBoundingClientRect();
    if (box.top < 100 || box.bottom > window.innerHeight - 20) {
      scrollAnchor.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center", inline: "nearest" });
    }
    control?.focus({ preventScroll: true });
  }));
}

export function backendFieldErrors(error, aliases = {}) {
  const result = {};
  for (const [key, message] of Object.entries(error?.fieldErrors || {})) {
    if (typeof message === "string" && message.trim()) result[aliases[key] || key] = message;
  }
  return result;
}

// Revalidating on Submit must not replace a precise error with a generic one.
// Only retain messages for fields that are still invalid; corrected fields clear.
export function retainInvalidFieldMessages(validation, previous = {}) {
  return Object.fromEntries(Object.entries(validation).map(([key, message]) => [key,
    typeof previous[key] === "string" && previous[key].trim() ? previous[key] : message,
  ]));
}
