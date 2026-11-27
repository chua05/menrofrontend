import LoadingIndicator from "./LoadingIndicator";

// Full-page loading inside the main content area.
export default function PageLoadingState({ message }) {
  return <LoadingIndicator variant="page" className="page-loading-state" message={message} />;
}
