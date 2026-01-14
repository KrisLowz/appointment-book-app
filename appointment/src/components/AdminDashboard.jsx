import { useEffect, useMemo, useState } from 'react';
import DataStore from '../data';
import { updatePatient as updatePatientRecord } from '../data/datastore.supabase.patients';
import { updateStaff as updateStaffRecord } from '../data/datastore.supabase.staff';
import { updateRoom as updateRoomRecord } from '../data/datastore.supabase.rooms';
import { updateTreatment as updateTreatmentRecord } from '../data/datastore.supabase.treatments';
import Modal from './Modal';
import { todayISO } from '../utils/date';

const planOptions = ['Starter', 'Growth', 'Pro', 'Enterprise'];
const statusOptions = ['active', 'trial', 'paused'];
const ADMIN_TAB_KEY = 'appointmentApp_adminTab';

export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(ADMIN_TAB_KEY) || 'overview');
  const [clinics, setClinics] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminActivity, setAdminActivity] = useState([]);
  const [clinicDetails, setClinicDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedClinicId, setExpandedClinicId] = useState('');
  const [expandedAppointmentMonths, setExpandedAppointmentMonths] = useState({});
  const [appointmentFilter, setAppointmentFilter] = useState({ status: 'all', query: '' });
  const [modalState, setModalState] = useState({ type: null, mode: 'new' });
  const [clinicForm, setClinicForm] = useState({ id: '', name: '', city: '', plan: 'Starter', status: 'active' });
  const [userForm, setUserForm] = useState({ id: '', username: '', password: '', role: 'dentist', clinicId: '', name: '', status: 'active' });
  const [detailModal, setDetailModal] = useState({ open: false, clinicId: '', type: '' });
  const [detailForm, setDetailForm] = useState({});
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [userSuccessMessage, setUserSuccessMessage] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [clinicsData, usersData, adminActivityData] = await Promise.all([
        DataStore.getClinics(),
        DataStore.getUsers(),
        DataStore.getAdminActivity(),
      ]);
      setClinics(clinicsData || []);
      setUsers(usersData || []);
      setAdminActivity(adminActivityData || []);

      const detailsEntries = await Promise.all(
        (clinicsData || []).map(async (clinic) => {
          const [
            patients,
            appointments,
            staff,
            rooms,
            treatments,
            settings,
            holidays,
            activity,
          ] = await Promise.all([
            DataStore.getPatients(clinic.id),
            DataStore.getAppointments(clinic.id),
            DataStore.getStaff(clinic.id),
            DataStore.getRooms(clinic.id),
            DataStore.getTreatments(clinic.id),
            DataStore.getSettings(clinic.id),
            DataStore.getHolidays(clinic.id),
            DataStore.getActivityLog(clinic.id),
          ]);

          return [
            clinic.id,
            { patients, appointments, staff, rooms, treatments, settings, holidays, activity },
          ];
        })
      );

      setClinicDetails(Object.fromEntries(detailsEntries));
    } catch (err) {
      console.error(err);
      setError('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    localStorage.setItem(ADMIN_TAB_KEY, activeTab);
  }, [activeTab]);

  const clinicSummaries = useMemo(() => {
    return clinics.map((clinic) => {
      const detail = clinicDetails[clinic.id] || {};
      const stats = {
        patients: detail.patients ? detail.patients.length : 0,
        appointments: detail.appointments ? detail.appointments.length : 0,
        staff: detail.staff ? detail.staff.length : 0,
        rooms: detail.rooms ? detail.rooms.length : 0,
        treatments: detail.treatments ? detail.treatments.length : 0,
      };
      return { ...clinic, stats };
    });
  }, [clinics, clinicDetails]);

  const totals = useMemo(() => {
    const base = { clinics: clinics.length, users: users.length, patients: 0, appointments: 0, staff: 0 };
    clinicSummaries.forEach((clinic) => {
      base.patients += clinic.stats.patients;
      base.appointments += clinic.stats.appointments;
      base.staff += clinic.stats.staff;
    });
    return base;
  }, [clinicSummaries, clinics.length, users.length]);

  const appointmentTrend = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-US', { month: 'short' }),
        count: 0,
      });
    }
    const index = Object.fromEntries(months.map((m, i) => [m.key, i]));
    Object.values(clinicDetails).forEach((detail) => {
      (detail.appointments || []).forEach((apt) => {
        if (!apt.date) return;
        const key = apt.date.slice(0, 7);
        const idx = index[key];
        if (idx !== undefined) months[idx].count += 1;
      });
    });
    return months;
  }, [clinicDetails]);

  const openClinicModal = (clinic) => {
    if (clinic) {
      setClinicForm({
        id: clinic.id,
        name: clinic.name,
        city: clinic.city || '',
        plan: clinic.plan || 'Starter',
        status: clinic.status || 'active'
      });
      setModalState({ type: 'clinic', mode: 'edit' });
      return;
    }
    setClinicForm({ id: '', name: '', city: '', plan: 'Starter', status: 'active' });
    setModalState({ type: 'clinic', mode: 'new' });
  };

  const openUserModal = (user) => {
    setUserSuccessMessage('');
    if (user) {
      setUserForm({
        id: user.id,
        username: user.username || user.email || '',
        password: '',
        role: user.role || 'dentist',
        clinicId: user.clinicId || '',
        name: user.name || '',
        status: user.status || 'active'
      });
      setModalState({ type: 'user', mode: 'edit' });
      return;
    }
    setUserForm({ id: '', username: '', password: '', role: 'dentist', clinicId: clinics[0]?.id || '', name: '', status: 'active' });
    setModalState({ type: 'user', mode: 'new' });
  };

  const closeModal = () => setModalState({ type: null, mode: 'new' });

  const openDetailModal = (clinicId, type) => {
    setDetailModal({ open: true, clinicId, type });
    setDetailForm({});
    setDetailError('');
  };

  const closeDetailModal = () => {
    setDetailModal({ open: false, clinicId: '', type: '' });
    setDetailForm({});
    setDetailError('');
  };

  const getDetailItems = () => {
    const detail = clinicDetails[detailModal.clinicId] || {};
    switch (detailModal.type) {
      case 'patients':
        return detail.patients || [];
      case 'staff':
        return detail.staff || [];
      case 'rooms':
        return detail.rooms || [];
      case 'treatments':
        return detail.treatments || [];
      default:
        return [];
    }
  };

  const startEdit = (item) => {
    if (!item) return;
    switch (detailModal.type) {
      case 'patients':
        setDetailForm({
          id: item.id,
          name: item.name || '',
          phone: item.phone || '',
          email: item.email || '',
          address: item.address || '',
        });
        break;
      case 'staff':
        setDetailForm({
          id: item.id,
          name: item.name || '',
          role: item.role || 'dentist',
          phone: item.phone || '',
          specialty: item.specialty || '',
        });
        break;
      case 'rooms':
        setDetailForm({
          id: item.id,
          name: item.name || '',
          color: item.color || '',
        });
        break;
      case 'treatments':
        setDetailForm({
          id: item.id,
          name: item.name || '',
          duration: item.duration || 0,
          color: item.color || '',
        });
        break;
      default:
        setDetailForm({});
    }
  };

  const handleDetailSave = async () => {
    if (!detailForm.id) return;
    setDetailSaving(true);
    setDetailError('');
    try {
      switch (detailModal.type) {
        case 'patients':
          await updatePatientRecord(detailForm.id, detailForm);
          break;
        case 'staff':
          await updateStaffRecord(detailForm.id, detailForm);
          break;
        case 'rooms':
          await updateRoomRecord(detailForm.id, detailForm);
          break;
        case 'treatments':
          await updateTreatmentRecord(detailForm.id, {
            ...detailForm,
            duration: Number(detailForm.duration) || 0,
          });
          break;
        default:
          break;
      }
      await refresh();
      setDetailForm({});
    } catch (err) {
      setDetailError(err.message || 'Failed to save changes.');
      console.error(err);
    } finally {
      setDetailSaving(false);
    }
  };

  const handleClinicSubmit = async () => {
    if (!clinicForm.name.trim()) {
      alert('Enter clinic name');
      return;
    }
    try {
      if (clinicForm.id) {
        await DataStore.updateClinic(clinicForm.id, clinicForm);
      } else {
        await DataStore.addClinic(clinicForm);
      }
      await refresh();
      closeModal();
    } catch (err) {
      alert('Failed to save clinic');
      console.error(err);
    }
  };

  const handleUserSubmit = async () => {
    if (!userForm.username.trim()) {
      alert('Enter email');
      return;
    }
    if (!DataStore.canCreateUsers && !userForm.id) {
      alert('Create users in Supabase Auth, then assign role/clinic here.');
      return;
    }
    if (DataStore.canCreateUsers && !userForm.password.trim() && !userForm.id) {
      alert('Enter password');
      return;
    }
    try {
      if (userForm.id) {
        await DataStore.updateUser(userForm.id, userForm);
        setUserSuccessMessage('User updated successfully.');
      } else {
        const created = await DataStore.addUser(userForm);
        if (created?.id) {
          setUsers((prev) => [
            {
              id: created.id,
              username: created.email,
              email: created.email,
              role: userForm.role || 'dentist',
              clinicId: userForm.clinicId || '',
              name: created.name || userForm.name || '',
              status: created.status || 'pending',
            },
            ...prev,
          ]);
        }
        setUserSuccessMessage('User created. Ask them to verify their email before signing in.');
      }
      await refresh();
      closeModal();
    } catch (err) {
      alert(err.message || 'Failed to save user');
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (modalState.type === 'clinic' && clinicForm.id) {
      if (window.confirm('Delete this clinic?')) {
        await DataStore.deleteClinic(clinicForm.id);
        await refresh();
      }
    }
    if (modalState.type === 'user' && userForm.id) {
      if (window.confirm('Delete this user?')) {
        await DataStore.deleteUser(userForm.id);
        await refresh();
      }
    }
    closeModal();
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">AB</div>
          <div>
            <div className="admin-brand-title">Admin</div>
            <div className="admin-brand-subtitle">Clinic Ops</div>
          </div>
        </div>
        <nav className="admin-nav">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'clinics', label: 'Clinics' },
            { id: 'users', label: 'Users' },
            { id: 'activity', label: 'History' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="btn btn-secondary" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-title">Admin Dashboard</div>
            <div className="admin-subtitle">Multi-clinic management and audit overview</div>
          </div>
          <div className="admin-topbar-actions">
            <button className="btn btn-secondary btn-sm" onClick={refresh}>
              Refresh
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => openClinicModal()}>
              New Clinic
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openUserModal()}
              disabled={!DataStore.canCreateUsers}
              title={DataStore.canCreateUsers ? 'Create user' : 'Enable VITE_ENABLE_ADMIN_CREATE_USERS'}
            >
              New User
            </button>
            <div className="admin-status-pill">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </div>
          </div>
        </header>

        {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
        {loading && <div className="empty-state">Loading admin data...</div>}

        {activeTab === 'overview' && (
          <div className="admin-layout">
            <section className="admin-metrics">
              <div className="admin-card">
                <div className="admin-card-label">Clinics</div>
                <div className="admin-card-value">{totals.clinics}</div>
                <div className="admin-card-meta">Active accounts</div>
              </div>
              <div className="admin-card">
                <div className="admin-card-label">Users</div>
                <div className="admin-card-value">{totals.users}</div>
                <div className="admin-card-meta">All roles</div>
              </div>
              <div className="admin-card">
                <div className="admin-card-label">Patients</div>
                <div className="admin-card-value">{totals.patients}</div>
                <div className="admin-card-meta">Across clinics</div>
              </div>
              <div className="admin-card">
                <div className="admin-card-label">Appointments</div>
                <div className="admin-card-value">{totals.appointments}</div>
                <div className="admin-card-meta">All statuses</div>
              </div>
              <div className="admin-card">
                <div className="admin-card-label">Staff</div>
                <div className="admin-card-value">{totals.staff}</div>
                <div className="admin-card-meta">Dentists + Nurses</div>
              </div>
            </section>

            <section className="admin-spotlight">
              <div className="admin-spotlight-column">
                <div className="admin-panel">
                  <div className="admin-panel-title">Appointments Trend (Last 6 Months)</div>
                  <div className="admin-chart">
                    {appointmentTrend.map((m) => {
                      const max = Math.max(...appointmentTrend.map((x) => x.count), 1);
                      const height = Math.max(8, Math.round((m.count / max) * 120));
                      return (
                        <div key={m.key} className="admin-chart-bar">
                          <div className="admin-chart-count">{m.count}</div>
                          <div
                            className="admin-chart-fill"
                            style={{ height }}
                            title={`${m.label}: ${m.count}`}
                          ></div>
                          <div className="admin-chart-label">{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="admin-panel">
                  <div className="admin-panel-title">Clinic Snapshot</div>
                  <div className="admin-snapshot-list">
                    {clinicSummaries.map((clinic) => (
                      <div key={clinic.id} className="admin-row">
                        <div>
                          <div className="admin-row-title">{clinic.name}</div>
                          <div className="admin-row-sub">{clinic.city} - {clinic.plan} - {clinic.status}</div>
                        </div>
                        <div className="admin-row-metrics">
                          <span>{clinic.stats.patients} patients</span>
                          <span>{clinic.stats.appointments} appts</span>
                          <span>{clinic.stats.staff} staff</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="admin-spotlight-column">
                <div className="admin-panel admin-quick-actions">
                  <div className="admin-panel-title">Quick Actions</div>
                  <div className="admin-action-grid">
                    <button type="button" className="admin-action-card" onClick={() => openClinicModal()}>
                      <span>+ Add Clinic</span>
                      <small>Create a new clinic workspace</small>
                    </button>
                    <button
                      type="button"
                      className="admin-action-card"
                      onClick={() => openUserModal()}
                      disabled={!DataStore.canCreateUsers}
                    >
                      <span>+ Add User</span>
                      <small>Register a user account</small>
                    </button>
                    <button type="button" className="admin-action-card" onClick={() => setActiveTab('users')}>
                      <span>Manage Users</span>
                      <small>Assign roles and clinics</small>
                    </button>
                  </div>
                </div>

                <div className="admin-panel admin-activity-panel">
                  <div className="admin-panel-title">Recent Admin Activity</div>
                  <div className="admin-activity-list">
                    {adminActivity.slice(0, 6).map((log) => (
                      <div key={log.id} className="admin-activity-item">
                        <div className="admin-activity-title">{log.description}</div>
                        <div className="admin-activity-meta">
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          <span>{log.type.replace('_', ' ')}</span>
                        </div>
                      </div>
                    ))}
                    {adminActivity.length === 0 && (
                      <div className="empty-state">No activity logged</div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'clinics' && (
          <div className="admin-layout">
            <section className="admin-panel admin-wide">
              <div className="admin-panel-header">
                <div className="admin-panel-title">Clinic Accounts</div>
                <button className="btn btn-primary btn-sm" onClick={() => openClinicModal()}>
                  + Add Clinic
                </button>
              </div>
              <div className="admin-list">
                {clinicSummaries.map((clinic) => (
                  <div key={clinic.id} className="admin-list-item admin-list-item-column">
                    <div className="admin-list-top">
                      <div>
                        <div className="admin-row-title">{clinic.name}</div>
                        <div className="admin-row-sub">{clinic.city} - {clinic.plan} - {clinic.status}</div>
                        <div className="admin-list-meta">
                          <span>{clinic.stats.patients} patients</span>
                          <span>{clinic.stats.appointments} appointments</span>
                          <span>{clinic.stats.staff} staff</span>
                          <span>{clinic.stats.rooms} rooms</span>
                        </div>
                      </div>
                      <div className="admin-list-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => openClinicModal(clinic)}>
                          Manage
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setExpandedClinicId(expandedClinicId === clinic.id ? '' : clinic.id)}
                        >
                          {expandedClinicId === clinic.id ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>
                    </div>
                    {expandedClinicId === clinic.id && (
                      <div className="admin-clinic-details">
                        <div className="admin-detail-section">
                          <div className="admin-detail-title">Clinic Overview</div>
                          <div className="admin-grid">
                            <button
                              type="button"
                              className="admin-card admin-card-clickable"
                              onClick={() => openDetailModal(clinic.id, 'patients')}
                            >
                              <div className="admin-card-label">Patients</div>
                              <div className="admin-card-value">{clinic.stats.patients}</div>
                            </button>
                            <button
                              type="button"
                              className="admin-card admin-card-clickable"
                              onClick={() => openDetailModal(clinic.id, 'appointments')}
                            >
                              <div className="admin-card-label">Appointments</div>
                              <div className="admin-card-value">{clinic.stats.appointments}</div>
                            </button>
                            <button
                              type="button"
                              className="admin-card admin-card-clickable"
                              onClick={() => openDetailModal(clinic.id, 'staff')}
                            >
                              <div className="admin-card-label">Staff</div>
                              <div className="admin-card-value">{clinic.stats.staff}</div>
                            </button>
                            <button
                              type="button"
                              className="admin-card admin-card-clickable"
                              onClick={() => openDetailModal(clinic.id, 'rooms')}
                            >
                              <div className="admin-card-label">Rooms</div>
                              <div className="admin-card-value">{clinic.stats.rooms}</div>
                            </button>
                            <button
                              type="button"
                              className="admin-card admin-card-clickable"
                              onClick={() => openDetailModal(clinic.id, 'treatments')}
                            >
                              <div className="admin-card-label">Treatments</div>
                              <div className="admin-card-value">{clinic.stats.treatments}</div>
                            </button>
                          </div>
                        </div>

                        <div className="admin-detail-section">
                          <div className="admin-detail-title">Recent Activity</div>
                          <div className="admin-detail-list">
                            {(clinicDetails[clinic.id]?.activity || []).slice(0, 6).map((log) => (
                              <div key={log.id} className="admin-detail-row">
                                <span>{log.description}</span>
                                <span>{new Date(log.timestamp).toLocaleString()}</span>
                                <span>{log.type.replace('_', ' ')}</span>
                              </div>
                            ))}
                            {(clinicDetails[clinic.id]?.activity || []).length === 0 && (
                              <div className="empty-state">No activity yet</div>
                            )}
                          </div>
                        </div>

                        <div className="admin-detail-section">
                          <div className="admin-detail-title">Clinic Settings</div>
                          <div className="admin-detail-grid">
                            <div><strong>Clinic Name:</strong> {clinicDetails[clinic.id]?.settings?.clinicName || 'Dental Clinic'}</div>
                            <div><strong>Working Hours:</strong> {clinicDetails[clinic.id]?.settings?.workingHours?.start || '09:00'} - {clinicDetails[clinic.id]?.settings?.workingHours?.end || '18:00'}</div>
                            <div><strong>Slot Duration:</strong> {clinicDetails[clinic.id]?.settings?.slotDuration || 30} mins</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {clinicSummaries.length === 0 && <div className="empty-state">No clinics yet</div>}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-layout">
            <section className="admin-panel admin-wide">
              <div className="admin-panel-header">
                <div className="admin-panel-title">User Accounts</div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => openUserModal()}
                  disabled={!DataStore.canCreateUsers}
                  title={DataStore.canCreateUsers ? 'Create user' : 'Enable VITE_ENABLE_ADMIN_CREATE_USERS'}
                >
                  + Create User
                </button>
              </div>
              {!DataStore.canCreateUsers && (
                <div className="form-hint" style={{ marginBottom: 12 }}>
                  Create users in Supabase Auth, or set VITE_ENABLE_ADMIN_CREATE_USERS=true to enable this button.
                </div>
              )}
              {userSuccessMessage && (
                <div className="form-hint" style={{ marginBottom: 12 }}>
                  {userSuccessMessage}
                </div>
              )}
              <div className="admin-list">
                {users.map((user) => (
                  <div key={user.id} className="admin-list-item">
                    <div>
                      <div className="admin-row-title">{user.username || user.email || 'Unknown user'}</div>
                      <div className="admin-row-sub">
                        {user.role}{' '}
                        {user.clinicId
                          ? `- ${clinics.find((c) => c.id === user.clinicId)?.name || 'Clinic'}`
                          : '- Unassigned'}
                      </div>
                      <div className="admin-list-meta">
                        <span>{user.name || 'Unnamed'}</span>
                        <span>{user.status || 'active'}</span>
                      </div>
                    </div>
                    <div className="admin-list-actions">
                      {!user.clinicId && (
                        <button className="btn btn-primary btn-sm" onClick={() => openUserModal(user)}>
                          Assign Clinic
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => openUserModal(user)}>
                        Manage
                      </button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && <div className="empty-state">No users yet</div>}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="admin-layout">
            <section className="admin-panel admin-wide">
              <div className="admin-panel-title">Admin History</div>
              {adminActivity.length === 0 && <div className="empty-state">No activity logged</div>}
              {adminActivity.map((log) => (
                <div key={log.id} className="admin-row">
                  <div>
                    <div className="admin-row-title">{log.description}</div>
                    <div className="admin-row-sub">{new Date(log.timestamp).toLocaleString()}</div>
                  </div>
                  <span className="admin-tag">{log.type.replace('_', ' ')}</span>
                </div>
              ))}
            </section>
          </div>
        )}
      </main>

      {modalState.type === 'clinic' && (
        <Modal title={modalState.mode === 'edit' ? 'Edit Clinic' : 'Add Clinic'} onClose={closeModal}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Clinic Name</label>
              <input className="form-input" value={clinicForm.name} onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={clinicForm.city} onChange={(e) => setClinicForm({ ...clinicForm, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Plan</label>
                <select className="form-select" value={clinicForm.plan} onChange={(e) => setClinicForm({ ...clinicForm, plan: e.target.value })}>
                  {planOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={clinicForm.status} onChange={(e) => setClinicForm({ ...clinicForm, status: e.target.value })}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            {modalState.mode === 'edit' && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
            <div className="flex-1"></div>
            <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleClinicSubmit}>
              {modalState.mode === 'edit' ? 'Save Clinic' : 'Add Clinic'}
            </button>
          </div>
        </Modal>
      )}

      {modalState.type === 'user' && (
        <Modal title={modalState.mode === 'edit' ? 'Edit User' : 'Add User'} onClose={closeModal}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
              </div>
              {DataStore.canCreateUsers && modalState.mode === 'new' && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="dentist">Dentist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Clinic (optional; assign later)</label>
              <select className="form-select" value={userForm.clinicId} onChange={(e) => setUserForm({ ...userForm, clinicId: e.target.value })}>
                <option value="">Unassigned</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input className="form-input" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            {modalState.mode === 'edit' && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
            <div className="flex-1"></div>
            <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleUserSubmit}>
              {modalState.mode === 'edit' ? 'Save User' : 'Add User'}
            </button>
          </div>
        </Modal>
      )}
      {detailModal.open && (
        <Modal
          title={`Manage ${detailModal.type}`}
          onClose={closeDetailModal}
        >
          <div className="modal-body">
            {detailError && <div className="form-error" style={{ marginBottom: 12 }}>{detailError}</div>}
            {detailModal.type === 'appointments' ? (
              <div className="empty-state">Appointment edits are available in the clinic view.</div>
            ) : (
              <>
                <div className="admin-entity-list">
                  {getDetailItems().map((item) => (
                    <div key={item.id} className="admin-entity-item">
                      <div>
                        <div className="admin-row-title">{item.name || item.email || 'Unnamed'}</div>
                        <div className="admin-row-sub">
                          {detailModal.type === 'patients' && (item.email || item.phone || 'No contact')}
                          {detailModal.type === 'staff' && `${item.role || 'staff'} ${item.phone ? `• ${item.phone}` : ''}`}
                          {detailModal.type === 'rooms' && (item.color || 'No color')}
                          {detailModal.type === 'treatments' && `${item.duration || 0} mins`}
                        </div>
                      </div>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                    </div>
                  ))}
                  {getDetailItems().length === 0 && (
                    <div className="empty-state">No records yet</div>
                  )}
                </div>

                {detailForm.id && (
                  <div className="admin-entity-form">
                    <div className="admin-detail-title">Edit details</div>
                    {detailModal.type === 'patients' && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Name</label>
                          <input className="form-input" value={detailForm.name} onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })} />
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-input" value={detailForm.phone} onChange={(e) => setDetailForm({ ...detailForm, phone: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" value={detailForm.email} onChange={(e) => setDetailForm({ ...detailForm, email: e.target.value })} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Address</label>
                          <input className="form-input" value={detailForm.address} onChange={(e) => setDetailForm({ ...detailForm, address: e.target.value })} />
                        </div>
                      </>
                    )}

                    {detailModal.type === 'staff' && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Name</label>
                          <input className="form-input" value={detailForm.name} onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })} />
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Role</label>
                            <select className="form-select" value={detailForm.role} onChange={(e) => setDetailForm({ ...detailForm, role: e.target.value })}>
                              <option value="dentist">Dentist</option>
                              <option value="nurse">Nurse</option>
                              <option value="assistant">Assistant</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-input" value={detailForm.phone} onChange={(e) => setDetailForm({ ...detailForm, phone: e.target.value })} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Specialty</label>
                          <input className="form-input" value={detailForm.specialty} onChange={(e) => setDetailForm({ ...detailForm, specialty: e.target.value })} />
                        </div>
                      </>
                    )}

                    {detailModal.type === 'rooms' && (
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Name</label>
                          <input className="form-input" value={detailForm.name} onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Color</label>
                          <input className="form-input" value={detailForm.color} onChange={(e) => setDetailForm({ ...detailForm, color: e.target.value })} />
                        </div>
                      </div>
                    )}

                    {detailModal.type === 'treatments' && (
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Name</label>
                          <input className="form-input" value={detailForm.name} onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Duration (mins)</label>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            value={detailForm.duration}
                            onChange={(e) => setDetailForm({ ...detailForm, duration: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Color</label>
                          <input className="form-input" value={detailForm.color} onChange={(e) => setDetailForm({ ...detailForm, color: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeDetailModal}>
              Close
            </button>
            {detailForm.id && detailModal.type !== 'appointments' && (
              <button type="button" className="btn btn-primary" onClick={handleDetailSave} disabled={detailSaving}>
                {detailSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
