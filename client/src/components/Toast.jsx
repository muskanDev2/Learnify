export default function Toast({ message, type = 'success' }) {
  if (!message) return null;

  return (
    <div className={`appToast appToast${type === 'error' ? 'Error' : 'Success'}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
