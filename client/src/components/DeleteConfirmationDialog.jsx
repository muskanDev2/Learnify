export default function DeleteConfirmationDialog({
  title = 'Confirm Delete',
  message = 'This action cannot be undone.',
  impact,
  isProcessing = false,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="lightboxOverlay" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="lightboxCard deleteConfirmationCard">
        <div className="deleteConfirmationIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11.2A2 2 0 0 1 14.3 22H9.7a2 2 0 0 1-2-1.8L7 9Zm3 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z" />
          </svg>
        </div>
        <h3 className="deleteConfirmationMessage">{message}</h3>
        {impact && <p className="deleteConfirmationImpact">{impact}</p>}
        <div className="deleteConfirmationActions">
          <button type="button" className="deleteCancelButton" onClick={onCancel} disabled={isProcessing}>
            No, cancel
          </button>
          <button type="button" className="deleteConfirmButton" onClick={onConfirm} disabled={isProcessing} autoFocus>
            {isProcessing ? 'Deleting...' : "Yes, I'm sure"}
          </button>
        </div>
      </div>
    </div>
  );
}
