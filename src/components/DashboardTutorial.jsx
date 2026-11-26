import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";

import ModalDialog from "./ModalDialog";
import { normalizeRole } from "../utils/roleRoutes";
import { tutorialStepsForRole } from "../data/dashboardTutorials";
import "../styles/dashboard-tutorial.css";

const SWIPE_DISTANCE = 50;
const seenKey = (role, uid) => `menro-tutorial-seen:${role}:${uid || "anonymous"}`;

function readSeen(key) {
  try { return window.localStorage.getItem(key) === "1"; } catch { return true; }
}
function markSeen(key) {
  try { window.localStorage.setItem(key, "1"); } catch { /* private mode: show again next time */ }
}

// "How to use" button for the dashboard. Opens a swipeable, step-by-step guide for the signed-in
// user's own role only, and opens itself once on a user's first dashboard visit.
export default function DashboardTutorial({ role, uid }) {
  const normalizedRole = normalizeRole(role);
  const steps = tutorialStepsForRole(normalizedRole);
  const storageKey = seenKey(normalizedRole, uid);
  // Open by itself the first time this user reaches their dashboard.
  const [open, setOpen] = useState(() => Boolean(uid) && !readSeen(storageKey));

  useEffect(() => {
    if (open) markSeen(storageKey);
  }, [open, storageKey]);

  return (
    <>
      <button type="button" className="tutorial-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Info size={16} aria-hidden="true" />
        How to use
      </button>
      {open && (
        <TutorialDialog
          steps={steps}
          role={normalizedRole}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TutorialDialog({ steps, role, onClose }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const pointer = useRef(null);
  const last = steps.length - 1;
  const goTo = next => setIndex(Math.min(Math.max(next, 0), last));
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  // Arrow keys change steps wherever focus is inside the open guide (including the dialog itself).
  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      setIndex(current => Math.min(Math.max(current + (event.key === "ArrowRight" ? 1 : -1), 0), last));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [last]);
  const onPointerDown = event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: null };
  };
  const onPointerMove = event => {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (start.horizontal === null && Math.hypot(dx, dy) > 8) {
      start.horizontal = Math.abs(dx) > Math.abs(dy);
      if (start.horizontal) event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    // Resist dragging past the first and last steps.
    if (start.horizontal) setDrag((index === 0 && dx > 0) || (index === last && dx < 0) ? dx / 4 : dx);
  };
  const onPointerEnd = event => {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    pointer.current = null;
    if (start.horizontal && Math.abs(drag) > SWIPE_DISTANCE) goTo(index + (drag < 0 ? 1 : -1));
    setDrag(0);
  };

  const step = steps[index];
  return (
    <ModalDialog onClose={onClose} className="tutorial-dialog" label={`${roleLabel} guide: how to use MENRO`} returnFocusSelector=".tutorial-trigger">
      <div className="tutorial-panel">
        <header className="tutorial-header">
          <div>
            <p className="tutorial-eyebrow">{roleLabel} guide · Step {index + 1} of {steps.length}</p>
            <h2 aria-live="polite">{step.title}</h2>
          </div>
          <button type="button" className="tutorial-close" data-modal-close aria-label="Close guide">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div
          className="tutorial-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <div
            className={`tutorial-track ${drag ? "is-dragging" : ""}`}
            style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))` }}
          >
            {steps.map((item, itemIndex) => {
              const near = Math.abs(itemIndex - index) <= 1;
              return (
                <section
                  key={item.title}
                  className="tutorial-slide"
                  aria-hidden={itemIndex !== index}
                  inert={itemIndex !== index}
                >
                  <figure className="tutorial-shot">
                    {near && (
                      <img src={item.image} alt={`Screenshot: ${item.title}`} draggable="false" loading={itemIndex === index ? "eager" : "lazy"} />
                    )}
                  </figure>
                  <div className="tutorial-copy">
                    <p>{item.body}</p>
                    {item.tips?.length > 0 && (
                      <ul>
                        {item.tips.map(tip => <li key={tip}>{tip}</li>)}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <footer className="tutorial-footer">
          <button type="button" className="tutorial-nav" onClick={() => goTo(index - 1)} disabled={index === 0}>
            <ChevronLeft size={18} aria-hidden="true" />
            Back
          </button>
          <div className="tutorial-dots" role="group" aria-label="Choose a step">
            {steps.map((item, dotIndex) => (
              <button
                key={item.title}
                type="button"
                className={dotIndex === index ? "is-active" : ""}
                aria-label={`Step ${dotIndex + 1}: ${item.title}`}
                aria-current={dotIndex === index ? "step" : undefined}
                onClick={() => goTo(dotIndex)}
              />
            ))}
          </div>
          {index < last ? (
            <button type="button" className="tutorial-nav tutorial-nav-primary" onClick={() => goTo(index + 1)}>
              Next
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="tutorial-nav tutorial-nav-primary" data-modal-close>
              Get started
            </button>
          )}
        </footer>
      </div>
    </ModalDialog>
  );
}
