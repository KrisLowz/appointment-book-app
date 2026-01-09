import { supabase } from "../lib/supabaseClient";

const mapProfile = (row) => ({
  id: row.id,
  username: row.email || "",
  email: row.email || "",
  role: row.role || "dentist",
  clinicId: row.clinic_id || "",
  name: row.full_name || "",
  status: row.status || "active",
  createdAt: row.created_at,
});

export async function getProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapProfile);
}

export async function getProfileById(id) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return mapProfile(data);
}

export async function updateProfile(id, updates) {
  const payload = {
    ...(updates.email !== undefined ? { email: updates.email } : {}),
    ...(updates.fullName !== undefined ? { full_name: updates.fullName } : {}),
    ...(updates.role !== undefined ? { role: updates.role } : {}),
    ...(updates.clinicId !== undefined ? { clinic_id: updates.clinicId || null } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
  };
  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapProfile(data);
}

export async function deactivateProfile(id) {
  return updateProfile(id, { status: "inactive" });
}
