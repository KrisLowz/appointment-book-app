export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay active">
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
