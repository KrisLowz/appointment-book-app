export default function Header({ title, onNewAppointment, onToggleSidebar }) {
  return (
    <header className="header">
      <div className="header-left">
        <button
          className="btn btn-icon mobile-menu-btn"
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="header-title">{title}</h1>
      </div>
      <div className="header-right">
        <button className="btn btn-primary" type="button" onClick={onNewAppointment}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Appointment
        </button>
      </div>
    </header>
  );
}
