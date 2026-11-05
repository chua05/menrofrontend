import { useEffect, useId, useRef } from "react";
import { attendanceFileError } from "../utils/attendanceFile";
import "../styles/attendance-upload.css";
function ImagePreview({ file }) {
  const image = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(file); image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={image} alt={`Attendance preview: ${file.name}`} />;
}
export default function AttendanceUpload({ file, onChange, error, onError, disabled = false }) {
  const id = useId(), input = useRef(null), errorId = `${id}-error`, helpId = `${id}-help`;
  function select(files) {
    if (disabled) return;
    if (files.length > 1) { onChange(null); return onError("Choose one attendance file per submission."); }
    const next = files[0] || null, message = attendanceFileError(next);
    onChange(message ? null : next); onError(message);
    if (input.current) input.current.value = "";
  }
  const description = `${helpId}${error ? ` ${errorId}` : ""}`;
  return <div className={`attendance-upload${error ? " attendance-upload-invalid" : ""}`}>
    <label htmlFor={id}>Attendance Photo/File (Optional)</label>
    <div className="attendance-dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); select([...event.dataTransfer.files]); }}>
      <input ref={input} id={id} type="file" hidden accept=".pdf,.jpg,.jpeg,.png" disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={description} onChange={event => select([...event.target.files])} />
      <button type="button" disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={description} onClick={() => input.current.click()}>Choose Attendance File</button>
      <span id={helpId}>Optional. Drop one PDF, JPEG or PNG here, up to 10 MB.</span>
    </div>
    {file && <div className="attendance-file">
      {file.type.startsWith("image/") && <ImagePreview file={file} />}
      <span><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} KB</small></span>
      <button type="button" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => { onChange(null); onError(""); }}>×</button>
    </div>}
    {error && <small className="pr-field-error" id={errorId} role="alert">{error}</small>}
    {error && !file && <button type="button" disabled={disabled} onClick={() => { onChange(null); onError(""); }}>Continue Without Attendance</button>}
  </div>;
}
