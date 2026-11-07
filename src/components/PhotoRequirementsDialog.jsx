import { FiCamera, FiCheckCircle, FiX } from "react-icons/fi";
import ModalDialog from "./ModalDialog";

export default function PhotoRequirementsDialog({ onClose, onTakePhoto }) {
  return (
    <ModalDialog label="Photo Verification Requirements" onClose={onClose}>
      <div className="pr-requirements-backdrop" role="presentation">
        <div
          className="pr-requirements-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-requirements-title"
        >
          <button
            type="button"
            className="pr-requirements-close"
            onClick={onClose}
            aria-label="Close photo verification requirements"
          >
            <FiX size={18} />
          </button>
          <h2 id="photo-requirements-title">Photo Verification Requirements</h2>
          <ul>
            <li><FiCheckCircle /> Turn ON your phone&apos;s Location/GPS.</li>
            <li><FiCheckCircle /> Enable location tags in Camera settings.</li>
            <li><FiCheckCircle /> Allow Camera to access your location.</li>
            <li><FiCheckCircle /> Take the photo at the actual planting site.</li>
            <li><FiCheckCircle /> Upload the original, unedited photo.</li>
          </ul>
          <div className="pr-requirements-note">
            <strong>Important:</strong> Turning on GPS alone does not guarantee that location information will be saved in the photo.
          </div>
          <button type="button" className="pr-primary-button" onClick={onTakePhoto} autoFocus>
            <FiCamera size={15} /> I Understand — Take Photo
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
