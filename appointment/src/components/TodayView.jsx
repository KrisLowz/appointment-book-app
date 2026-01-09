import { useMemo } from 'react';
import { todayISO, formatDayLong } from '../utils/date';
import { addMinutes, formatTime } from '../utils/time';
import { getInitials } from '../utils/people';

export default function TodayView({ appointments, patients, rooms, treatments, onAppointmentSelect }) {
  const isoToday = todayISO();
  const todaysAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date === isoToday)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [appointments]);

  const patientName = (id) => {
    const p = patients.find((pt) => pt.id === id);
    return p ? p.name : 'Unknown';
  };
  const patientDetails = (id) => patients.find((pt) => pt.id === id);
  const roomName = (id) => {
    const r = rooms.find((rm) => rm.id === id);
    return r ? r.name : 'Room';
  };
  const treatmentName = (id) => {
    const t = treatments.find((tr) => tr.id === id);
    return t ? t.name : undefined;
  };

  const totalMinutes = todaysAppointments.reduce((sum, apt) => sum + (apt.duration || 30), 0);
  const nextAppointment = todaysAppointments.find((apt) => {
    const now = new Date();
    const [h, m] = apt.startTime.split(':').map(Number);
    const aptTime = new Date();
    aptTime.setHours(h, m, 0, 0);
    return aptTime >= now;
  });

  const statusLabel = (status) => {
    if (status === 'no-show') return 'No Show';
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Confirmed';
  };

  return (
    <div className="today-view-container">
      <div className="today-header">
        <div>
          <h2 className="today-date">Today's Appointments</h2>
          <p>{formatDayLong(new Date())}</p>
        </div>
        <div className="today-summary">
          <div className="today-summary-card">
            <div className="today-summary-label">Total</div>
            <div className="today-summary-value">{todaysAppointments.length}</div>
          </div>
          <div className="today-summary-card">
            <div className="today-summary-label">Minutes</div>
            <div className="today-summary-value">{totalMinutes}</div>
          </div>
          <div className="today-summary-card">
            <div className="today-summary-label">Next</div>
            <div className="today-summary-value">
              {nextAppointment ? formatTime(nextAppointment.startTime) : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="today-appointments-list">
        {todaysAppointments.length === 0 && (
          <div className="today-empty-state">
            <h3 className="today-empty-state-title">No appointments today</h3>
            <p>Schedule a new appointment to see it here.</p>
          </div>
        )}
        {todaysAppointments.map((apt) => {
          const patient = patientDetails(apt.patientId);
          return (
            <div
              key={apt.id}
              className="today-appointment-card"
              onClick={() => onAppointmentSelect && onAppointmentSelect(apt)}
              style={{ cursor: 'pointer' }}
            >
              <div className="today-appointment-time">
                <span className="today-appointment-time-start">{formatTime(apt.startTime)}</span>
                <span className="today-appointment-divider">-</span>
                <span className="today-appointment-time-end">
                  {formatTime(apt.endTime || addMinutes(apt.startTime, apt.duration || 30))}
                </span>
              </div>
              <div className="today-appointment-info">
                <div className="today-appointment-header">
                  <div className="today-appointment-patient">
                    <span className="today-appointment-avatar">
                      {patient ? getInitials(patient.name) : 'P'}
                    </span>
                    <span>{patientName(apt.patientId)}</span>
                  </div>
                  <span className={`today-status-pill ${apt.status || 'confirmed'}`}>
                    {statusLabel(apt.status)}
                  </span>
                </div>
                <div className="today-appointment-meta">
                  <span className="today-appointment-meta-item">{apt.duration || 30} mins</span>
                  {apt.roomId && (
                    <span className="today-appointment-meta-item">{roomName(apt.roomId)}</span>
                  )}
                  {apt.treatmentId && (
                    <span className="today-appointment-meta-item">{treatmentName(apt.treatmentId)}</span>
                  )}
                </div>
                {apt.notes && <div className="today-appointment-notes">{apt.notes}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
