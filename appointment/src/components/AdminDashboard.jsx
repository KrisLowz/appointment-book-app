import { useEffect, useMemo, useState } from 'react';
import DataStore from '../data';
import { updatePatient as updatePatientRecord } from '../data/datastore.supabase.patients';
import { updateStaff as updateStaffRecord } from '../data/datastore.supabase.staff';
import { updateRoom as updateRoomRecord } from '../data/datastore.supabase.rooms';
import { updateTreatment as updateTreatmentRecord } from '../data/datastore.supabase.treatments';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
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
  const [userLoading, setUserLoading] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, clinicId: '', type: '' });
  const [detailForm, setDetailForm] = useState({});
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [userSuccessMessage, setUserSuccessMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', payload: null });

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
      setUsers((usersData || []).filter(u => u.status !== 'inactive'));
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
    setUserForm({ id: '', username: '', password: '', role: 'dentist', clinicId: '', name: '', status: 'active' });
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

    setUserLoading(true);
    try {
      if (userForm.id) {
        await DataStore.updateUser(userForm.id, userForm);
        setUserSuccessMessage('User updated successfully.');
      } else {
        const created = await DataStore.addUser(userForm);

        // Critical fix: created user starts with default metadata, we must update it
        // with the specific selected clinic and role immediately
        if (created?.id) {
          await DataStore.updateUser(created.id, {
            clinicId: userForm.clinicId,
            role: userForm.role,
            name: userForm.name,
            status: userForm.status
          });

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
        setUserSuccessMessage('User created successfully.');
      }
      await refresh();

      // Don't close immediately if success, to show the message inside modal? 
      // User asked for success message. If we close, we need to show it elsewhere.
      // Let's keep modal open if it was a create action to show the success message, or close and show toast in list?
      // "i need custom design not default browser message."
      // Let's close and rely on the persisted userSuccessMessage showing in the list view (it's already there in JSX)
      setTimeout(() => {
        closeModal();
        setUserLoading(false);
      }, 1500);

    } catch (err) {
      alert(err.message || 'Failed to save user');
      console.error(err);
      setUserLoading(false);
    }
  };

  const handleDelete = async () => {
    if (modalState.type === 'clinic' && clinicForm.id) {
      setConfirmDialog({
        open: true,
        type: 'clinic',
        payload: { id: clinicForm.id, name: clinicForm.name },
      });
    }
    if (modalState.type === 'user' && userForm.id) {
      setConfirmDialog({
        open: true,
        type: 'user',
        payload: { id: userForm.id, name: userForm.name || userForm.username },
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (confirmDialog.type === 'clinic' && confirmDialog.payload?.id) {
      await DataStore.deleteClinic(confirmDialog.payload.id);
    }
    if (confirmDialog.type === 'user' && confirmDialog.payload?.id) {
      await DataStore.deleteUser(confirmDialog.payload.id);
    }
    await refresh();
    closeModal();
    setConfirmDialog({ open: false, type: '', payload: null });
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ... existing code ...

  return (
    <div className="admin-shell">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header-mobile">
          <div className="admin-brand">
            <div className="admin-brand-mark">AB</div>
            <div className="admin-brand-title">Admin</div>
          </div>
          <button
            className="btn btn-icon sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Desktop Brand (hidden on mobile header inside sidebar if specific styles used, generally ok to keep) */}
        <div className="admin-brand desktop-only">
          <div className="admin-brand-mark">AB</div>
          <div>
            <div className="admin-brand-title">Admin</div>
            <div className="admin-brand-subtitle">Clinic Ops</div>
          </div>
        </div>

        <div className="admin-nav-label">Navigation</div>
        <nav className="admin-nav" role="tablist" aria-label="Admin sections">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'clinics', label: 'Clinics' },
            { id: 'users', label: 'Users' },
            { id: 'activity', label: 'History' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setSidebarOpen(false);
              }}
              role="tab"
              aria-selected={activeTab === tab.id}
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
          <div className="admin-topbar-left">
            <button
              className="btn btn-icon mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              style={{ marginRight: 12 }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div>
              <div className="admin-title">Admin Dashboard</div>
              <div className="admin-subtitle">Multi-clinic management</div>
            </div>
          </div>
          <div className="admin-topbar-right">
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
            {/* <div className="admin-status-pill">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </div> */}
          </div>
        </header>

        {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
        {loading && (
          <div className="admin-loading">
            <div className="skeleton skeleton-line" style={{ width: '220px', height: 16 }}></div>
            <div className="admin-loading-grid">
              <div className="skeleton skeleton-card"></div>
              <div className="skeleton skeleton-card"></div>
              <div className="skeleton skeleton-card"></div>
              <div className="skeleton skeleton-card"></div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="admin-layout">
            <section className="admin-section">
              <div className="admin-section-header">
                <div>
                  <div className="admin-section-title">Clinic Overview</div>
                  <div className="admin-section-subtitle">At-a-glance operational totals</div>
                </div>
              </div>
              <div className="admin-metrics">
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
                <div className="admin-success-banner" style={{
                  marginBottom: 16,
                  padding: '12px 16px',
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  borderRadius: '8px',
                  border: '1px solid #a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
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
            <button type="button" className="btn btn-primary" onClick={handleUserSubmit} disabled={userLoading}>
              {userLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: 12, height: 12, border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                  Saving...
                </span>
              ) : (modalState.mode === 'edit' ? 'Save User' : 'Add User')}
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
              <div className="admin-appointment-view">
                <div className="admin-filters" style={{
                  marginBottom: 20,
                  display: 'flex',
                  gap: 12,
                  background: '#f8fafc',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  alignItems: 'center'
                }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input
                      type="text"
                      placeholder="Search patient, dentist or treatment..."
                      className="admin-search-input"
                      style={{ paddingLeft: 36, width: '100%' }}
                      value={appointmentFilter.query}
                      onChange={(e) => setAppointmentFilter(prev => ({ ...prev, query: e.target.value }))}
                    />
                  </div>
                  <select
                    className="admin-select"
                    value={appointmentFilter.status}
                    onChange={(e) => setAppointmentFilter(prev => ({ ...prev, status: e.target.value }))}
                    style={{ minWidth: 140 }}
                  >
                    <option value="all">All Status</option>
                    {[...new Set((clinicDetails[detailModal.clinicId]?.appointments || []).map(a => a.status).filter(Boolean))].sort().map(status => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const details = clinicDetails[detailModal.clinicId] || {};
                  const rawAppointments = details.appointments || [];
                  const patients = details.patients || [];
                  const staff = details.staff || [];
                  const treatments = details.treatments || [];
                  const rooms = details.rooms || [];

                  // 1. Hydrate appointments
                  const appointments = rawAppointments.map(apt => {
                    const patient = patients.find(p => p.id === apt.patientId);
                    const dentist = staff.find(s => s.id === apt.dentistId);
                    const treatment = treatments.find(t => t.id === apt.treatmentId);
                    const room = rooms.find(r => r.id === apt.roomId);
                    return {
                      ...apt,
                      patient,
                      dentist,
                      treatment,
                      room,
                      patientName: patient?.name || 'Unknown Patient',
                      dentistName: dentist?.name || 'Unassigned',
                      treatmentName: treatment?.name || 'Checkup'
                    };
                  });

                  // 2. Filter
                  const filtered = appointments.filter(apt => {
                    const matchesStatus = appointmentFilter.status === 'all' || apt.status === appointmentFilter.status;
                    const q = appointmentFilter.query.toLowerCase();
                    const matchesQuery = !q ||
                      apt.patientName.toLowerCase().includes(q) ||
                      apt.dentistName.toLowerCase().includes(q) ||
                      apt.treatmentName.toLowerCase().includes(q);
                    return matchesStatus && matchesQuery;
                  });

                  // 3. Group by month
                  const grouped = filtered.reduce((acc, apt) => {
                    const monthKey = apt.date.slice(0, 7); // YYYY-MM
                    if (!acc[monthKey]) acc[monthKey] = [];
                    acc[monthKey].push(apt);
                    return acc;
                  }, {});

                  const sortedMonths = Object.keys(grouped).sort().reverse();

                  if (filtered.length === 0) return <div className="empty-state">No matching appointments</div>;

                  return (
                    <div className="admin-month-groups">
                      {sortedMonths.map(month => {
                        const dateObj = new Date(month + '-01');
                        const monthLabel = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
                        const isExpanded = expandedAppointmentMonths[month];

                        return (
                          <div key={month} className="admin-month-group" style={{ marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
                            <div
                              className="admin-month-header"
                              style={{ padding: '14px 20px', background: '#f8fafc', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: '0.95rem', color: '#334155' }}
                              onClick={() => setExpandedAppointmentMonths(prev => ({ ...prev, [month]: !prev[month] }))}
                            >
                              <span>{monthLabel} <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 6 }}>({grouped[month].length})</span></span>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{isExpanded ? '▼' : '▶'}</span>
                            </div>
                            {isExpanded && (
                              <div className="admin-month-body">
                                {grouped[month].map(apt => {
                                  const normalizedStatus = (apt.status || 'confirmed').toLowerCase().replace(' ', '-');
                                  return (
                                    <div key={apt.id} className="admin-appointment-card" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                                          <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: '#334155' }}>{apt.startTime}</span>
                                          <span style={{ color: '#cbd5e1' }}>—</span>
                                          <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: '#64748b' }}>{apt.endTime || '?'}</span>
                                          {apt.duration && <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, color: '#64748b', fontWeight: 500 }}>{apt.duration}m</span>}
                                        </div>
                                        <span className={`status-pill status-${normalizedStatus}`}>{apt.status}</span>
                                      </div>

                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.875rem' }}>
                                        {/* First Column */}
                                        <div>
                                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 2 }}>Patient</div>
                                          <div style={{ fontWeight: 500, color: '#1e293b' }}>{apt.patientName}</div>
                                          {apt.patient?.phone && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{apt.patient.phone}</div>}
                                        </div>

                                        {/* Second Column */}
                                        <div>
                                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 2 }}>Treatment</div>
                                          <div style={{ fontWeight: 500, color: '#1e293b' }}>{apt.treatmentName}</div>
                                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>with {apt.dentistName}</div>
                                        </div>
                                      </div>

                                      {/* Extra details row */}
                                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #f1f5f9', display: 'flex', gap: 16, fontSize: '0.8rem' }}>
                                        {apt.room && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: apt.room.color || '#cbd5e1' }}></div>
                                            <span style={{ color: '#475569' }}>Room: {apt.room.name}</span>
                                          </div>
                                        )}
                                        {apt.notes && (
                                          <div style={{ color: '#64748b', fontStyle: 'italic', maxWidth: '70%' }}>
                                            Note: "{apt.notes}"
                                          </div>
                                        )}
                                      </div>

                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
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
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.type === 'clinic' ? 'Delete clinic' : 'Delete user'}
        description={
          confirmDialog.type === 'clinic'
            ? 'Deleting a clinic will remove all related data for that clinic. This action cannot be undone.'
            : 'Deleting a user will revoke their access to the platform.'
        }
        confirmLabel={confirmDialog.type === 'clinic' ? 'Delete clinic' : 'Delete user'}
        confirmVariant="danger"
        onClose={() => setConfirmDialog({ open: false, type: '', payload: null })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
