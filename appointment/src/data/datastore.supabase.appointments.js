import { supabase } from "../lib/supabaseClient";

const mapAppointment = (row) => ({
  id: row.id,
  clinicId: row.clinic_id,
  patientId: row.patient_id,
  dentistId: row.dentist_id,
  roomId: row.room_id,
  treatmentId: row.treatment_id,
  date: row.date,
  startTime: row.start_time,
  endTime: row.end_time,
  duration: row.duration,
  status: row.status,
  notes: row.notes,
  createdAt: row.created_at,
});

export async function getAppointments(clinicId) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

export async function addAppointment(clinicId, appointment) {
  const payload = {
    clinic_id: clinicId,
    patient_id: appointment.patientId || null,
    dentist_id: appointment.dentistId || null,
    room_id: appointment.roomId || null,
    treatment_id: appointment.treatmentId || null,
    date: appointment.date,
    start_time: appointment.startTime,
    end_time: appointment.endTime || null,
    duration: appointment.duration || null,
    status: appointment.status || "confirmed",
    notes: appointment.notes || null,
  };
  const { data, error } = await supabase
    .from("appointments")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return mapAppointment(data);
}

export async function updateAppointment(id, updates) {
  const payload = {
    ...(updates.patientId !== undefined ? { patient_id: updates.patientId || null } : {}),
    ...(updates.dentistId !== undefined ? { dentist_id: updates.dentistId || null } : {}),
    ...(updates.roomId !== undefined ? { room_id: updates.roomId || null } : {}),
    ...(updates.treatmentId !== undefined ? { treatment_id: updates.treatmentId || null } : {}),
    ...(updates.date !== undefined ? { date: updates.date } : {}),
    ...(updates.startTime !== undefined ? { start_time: updates.startTime } : {}),
    ...(updates.endTime !== undefined ? { end_time: updates.endTime || null } : {}),
    ...(updates.duration !== undefined ? { duration: updates.duration } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
  };
  const { data, error } = await supabase
    .from("appointments")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapAppointment(data);
}

export async function deleteAppointment(id) {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
  return true;
}
