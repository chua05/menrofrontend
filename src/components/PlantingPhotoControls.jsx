import { useRef, useId } from "react";
// Shared presentation; callers retain their existing secure capture and EXIF pipelines.
export default function PlantingPhotoControls({ count, max = 10, onCamera, onFiles, disabled, error, onRemove, children, inputId }) {
  const input = useRef(null), generatedId = useId();
  const id = inputId || generatedId;
  return <div className="pr-upload-box">
    <input ref={input} id={id} type="file" multiple accept=".jpg,.jpeg,.png,.webp" disabled={disabled || count >= max} aria-label="Planting evidence photos" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { onFiles([...event.target.files]); event.target.value = ""; }} className="pr-file-input" />
    <div className="pr-official-actions"><button type="button" className="pr-primary-button" onClick={onCamera} disabled={disabled || count >= max}>Take Photo</button><button type="button" className="pr-secondary-button" onClick={() => input.current.click()} disabled={disabled || count >= max}>Upload Existing Photos</button></div>
    <p role="status">{count} / {max} photos selected. Original JPEG, PNG or WebP, up to 10 MB each.</p>
    {error && <small id={`${id}-error`} className="pr-field-error" role="alert">{error}</small>}{children}
    {onRemove && count > 0 && <button type="button" onClick={onRemove} disabled={disabled}>Remove selected photos</button>}
  </div>;
}
