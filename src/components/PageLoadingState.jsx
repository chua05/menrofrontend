import "../styles/page-loading-state.css";

export default function PageLoadingState({ message }) {
  return (
    <div className="page-loading-state" role="status" aria-live="polite">
      {message}
    </div>
  );
}
