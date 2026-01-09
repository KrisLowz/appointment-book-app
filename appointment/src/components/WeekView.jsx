import { useMemo, useRef, useState } from 'react';
import { buildHolidayMap } from '../utils/calendar';
import { toISODate, todayISO, sameDate } from '../utils/date';
import { addMinutes, formatTime, minutesToTime } from '../utils/time';
import { getColorBg } from '../utils/colors';
import Modal from './Modal';

export default function WeekView({
  currentDate,
  appointments,
  patients,
  rooms,
  treatments,
  holidays,
  settings,
  onSelectDate,
  onSlotSelect,
  onAppointmentSelect,
  onAppointmentReschedule,
}) {
  const startHour = parseInt((settings && settings.workingHours && settings.workingHours.start) || '09:00', 10);
  const endHour = parseInt((settings && settings.workingHours && settings.workingHours.end) || '18:00', 10);
  const todayIso = todayISO();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const holidayMap = buildHolidayMap(holidays || []);
  const restDays = (settings && settings.restDays) || [];
  const dragRef = useRef(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [pendingReschedule, setPendingReschedule] = useState(null);

  const startOfWeek = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  const patientName = (id) => {
    const p = patients.find((pt) => pt.id === id);
    return p ? p.name : 'Unknown';
  };
  const treatmentColor = (id) => {
    const t = treatments.find((tr) => tr.id === id);
    return t ? t.color : '#4A90A4';
  };
  const treatmentName = (id) => {
    const t = treatments.find((tr) => tr.id === id);
    return t ? t.name : '';
  };
  const snapMinutes = (minutes) => Math.round(minutes / 15) * 15;

  const weekDays = Array(7)
    .fill(0)
    .map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });

  return (
    <div className="week-view">
      <div className="week-header">
        <div className="week-header-cell"></div>
        {weekDays.map((d) => {
          const iso = toISODate(d);
          const isRest = restDays.indexOf(d.getDay()) !== -1;
          const holiday = holidayMap[iso];
          const isPastDay = iso < todayIso;
          const cls = [
            'week-header-cell',
            sameDate(d, new Date()) ? 'today' : '',
            holiday ? 'holiday-day' : isRest ? 'rest-day' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={iso}
              className={cls}
              data-date={iso}
              title={holiday ? holiday.name : ''}
              onClick={() => {
                if (onSelectDate) onSelectDate(iso);
              }}
            >
              <div className="week-header-day">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className="week-header-date">{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div className="week-body" style={{ height: (endHour - startHour) * 60 }}>
        <div className="week-time-column">
          {Array(endHour - startHour)
            .fill(0)
            .map((_, i) => {
              const hour = startHour + i;
              return (
                <div key={hour} className="week-time-slot">
                  {hour % 12 || 12} {hour >= 12 ? 'PM' : 'AM'}
                </div>
              );
            })}
        </div>
        {weekDays.map((d) => {
          const iso = toISODate(d);
          const dayAppointments = appointments.filter((apt) => apt.date === iso && apt.status !== 'cancelled');
          const isRest = restDays.indexOf(d.getDay()) !== -1;
          const holiday = holidayMap[iso];
          const isPastDay = iso < todayIso;
          const isToday = iso === todayIso;
          const pastBlockHeight = isToday
            ? Math.min(Math.max(0, nowMinutes - startHour * 60), (endHour - startHour) * 60)
            : 0;
          const restClass = holiday ? 'holiday-day' : isRest ? 'rest-day' : '';
          const previewActive = dragPreview && dragPreview.date === iso;
          const handleDrop = (e) => {
            e.preventDefault();
            const dragged = dragRef.current;
            if (!dragged || !onAppointmentReschedule) return;
            if (isPastDay) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const offset = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
            const scrollOffset = e.currentTarget.scrollTop || 0;
            const pixelsFromTop = offset + scrollOffset;
            const snapped = Math.max(0, Math.min((endHour - startHour) * 60, snapMinutes(pixelsFromTop)));
            const absoluteMinutes = startHour * 60 + snapped;
            if (isToday && absoluteMinutes <= nowMinutes) return;
            const newStart = minutesToTime(absoluteMinutes);
            const duration = dragged.duration || 30;
            const updates = {
              date: iso,
              startTime: newStart,
              endTime: addMinutes(newStart, duration),
            };
            setPendingReschedule({
              appointment: dragged,
              updates,
              message: `Reschedule ${patientName(dragged.patientId)} to ${iso} at ${formatTime(newStart)}?`,
            });
            setDragPreview(null);
          };
          return (
            <div
              key={iso}
              className={`week-day-column ${restClass} ${isPastDay ? 'past-day' : ''}`}
              data-date={iso}
              style={{ position: 'relative' }}
              onDragOver={(e) => {
                if (!dragRef.current) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const offset = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
                const scrollOffset = e.currentTarget.scrollTop || 0;
                const pixelsFromTop = offset + scrollOffset;
                const snapped = Math.max(0, Math.min((endHour - startHour) * 60, snapMinutes(pixelsFromTop)));
                const absoluteMinutes = startHour * 60 + snapped;
                if (isToday && absoluteMinutes <= nowMinutes) return;
                setDragPreview({ date: iso, offset: snapped });
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={handleDrop}
              onClick={(e) => {
                if (e.target.closest('.week-appointment')) return;
                if (isPastDay) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const offset = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
                const scrollOffset = e.currentTarget.scrollTop || 0;
                const pixelsFromTop = offset + scrollOffset;
                const hourIndex = Math.floor(pixelsFromTop / 60); // snap to hour blocks
                const hourValue = Math.min(startHour + (endHour - startHour) - 1, startHour + hourIndex);
                const time = `${String(hourValue).padStart(2, '0')}:00`;
                const absoluteMinutes = hourValue * 60;
                if (isToday && absoluteMinutes <= nowMinutes) return;
                if (onSlotSelect) onSlotSelect(iso, time);
              }}
            >
              {pastBlockHeight > 0 && (
                <div className="past-block" style={{ height: pastBlockHeight }}></div>
              )}
              {Array(endHour - startHour)
                .fill(0)
                .map((_, idx) => (
                  <div key={idx} className="week-hour-line"></div>
                ))}
              {previewActive && (
                <div className="drag-preview-line" style={{ top: dragPreview.offset }}>
                  <span className="drag-preview-label">
                    {formatTime(minutesToTime(startHour * 60 + dragPreview.offset))}
                  </span>
                </div>
              )}
              {dayAppointments.map((apt) => {
                const color = treatmentColor(apt.treatmentId || apt.treatmentType);
                const startParts = apt.startTime.split(':').map(Number);
                const endParts = apt.endTime
                  ? apt.endTime.split(':').map(Number)
                  : addMinutes(apt.startTime, apt.duration || 30).split(':').map(Number);
                const top = (startParts[0] - startHour) * 60 + startParts[1];
                const height = endParts[0] * 60 + endParts[1] - (startParts[0] * 60 + startParts[1]);

                return (
                  <div
                    key={apt.id}
                    className="week-appointment"
                    draggable
                    style={{
                      top,
                      minHeight: height,
                      background: getColorBg ? getColorBg(color) : '#E8F4F8',
                      color,
                      borderLeft: `3px solid ${color}`,
                      position: 'absolute',
                    }}
                    onDragStart={(e) => {
                      dragRef.current = apt;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', apt.id);
                      e.currentTarget.classList.add('dragging');
                    }}
                    onDragEnd={(e) => {
                      dragRef.current = null;
                      if (e && e.currentTarget) {
                        e.currentTarget.classList.remove('dragging');
                      }
                      setDragPreview(null);
                    }}
                    onClick={() => {
                      if (onAppointmentSelect) onAppointmentSelect(apt);
                    }}
                  >
                    <div className="week-appointment-time">{formatTime(apt.startTime)}</div>
                    <div className="week-appointment-title">
                      {patientName(apt.patientId)}
                      {treatmentName(apt.treatmentId || apt.treatmentType)
                        ? ` - ${treatmentName(apt.treatmentId || apt.treatmentType)}`
                        : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {pendingReschedule && (
        <Modal title="Confirm reschedule" onClose={() => setPendingReschedule(null)}>
          <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
            <p style={{ marginBottom: 'var(--space-md)' }}>{pendingReschedule.message}</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setPendingReschedule(null)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={() => {
                  onAppointmentReschedule(pendingReschedule.appointment, pendingReschedule.updates);
                  setPendingReschedule(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

