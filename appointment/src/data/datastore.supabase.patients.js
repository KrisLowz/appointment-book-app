import { supabase } from "../lib/supabaseClient";

/**
 * Patients (Supabase) - compatible with your current DataStore API
 * Expect clinicId to be the ACTIVE CLINIC UUID stored in localStorage.
 */

export async function getPatients(clinicId) {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addPatient(clinicId, patient) {
  const payload = {
    clinic_id: clinicId,
    name: patient.name,
    phone: patient.phone || null,
    email: patient.email || null,
    id_number: patient.idNumber || patient.id_number || null,
    address: patient.address || null,
    legacy_id: patient.id || null, // optional if you are migrating legacy later
    created_by: (await supabase.auth.getUser()).data.user?.id || null,
  };

  const { data, error } = await supabase
    .from("patients")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  // Return in your app’s expected shape (you used idNumber camelCase)
  return {
    ...data,
    idNumber: data.id_number,
  };
}

export async function updatePatient(patientUuid, updates) {
  const payload = {
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
    ...(updates.email !== undefined ? { email: updates.email } : {}),
    ...(updates.idNumber !== undefined ? { id_number: updates.idNumber } : {}),
    ...(updates.address !== undefined ? { address: updates.address } : {}),
  };

  const { data, error } = await supabase
    .from("patients")
    .update(payload)
    .eq("id", patientUuid)
    .select("*")
    .single();

  if (error) throw error;

  return { ...data, idNumber: data.id_number };
}

export async function deletePatient(patientUuid) {
  const { error } = await supabase.from("patients").delete().eq("id", patientUuid);
  if (error) throw error;
  return true;
}

export async function getPatientById(patientUuid) {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientUuid)
    .single();

  if (error) throw error;
  return { ...data, idNumber: data.id_number };
}

/**
 * Search: simplest approach is client-side filter after fetching,
 * because your current DataStore searches local array.
 * (Later you can add server-side search with ilike.)
 */
export async function searchPatients(clinicId, query) {
  const q = (query || "").trim().toLowerCase();
  const patients = await getPatients(clinicId);

  if (!q) return patients;

  return patients.filter((p) => {
    const idNumber = (p.id_number || "").toLowerCase();
    const addr = (p.address || "").toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(q) ||
      (p.phone || "").includes(query) ||
      (p.email || "").toLowerCase().includes(q) ||
      idNumber.includes(q) ||
      addr.includes(q)
    );
  });
}
