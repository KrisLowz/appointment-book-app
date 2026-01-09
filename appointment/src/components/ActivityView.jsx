export default function ActivityView({ activity }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ marginBottom: 12 }}>Recent Activity</h3>
      {activity.length === 0 ? (
        <div className="empty-state">
          <h3>No activity yet</h3>
          <p>Actions you take will appear here.</p>
        </div>
      ) : (
        <div className="activity-log">
          {activity.map((item) => {
            const type = item.type || '';
            const typeClass =
              type.indexOf('delete') !== -1 || type === 'appointment_deleted'
                ? 'delete'
                : type.indexOf('update') !== -1 || type.indexOf('updated') !== -1
                ? 'update'
                : 'add';
            return (
              <div key={item.id} className="activity-item">
                <div className={`activity-icon ${typeClass}`}></div>
                <div className="activity-content">
                  <div className="activity-text">{item.description}</div>
                  <div className="activity-time">{new Date(item.timestamp).toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
