import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { todayISO } from '../utils/date';
import { addMinutes } from '../utils/time';

const emptyPatient = {
  name: '',
  idNumber: '',
  dob: '',
  gender: '',
  taxNumber: '',
  phone: '',
  email: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  allergies: '',
  medicalConditions: '',
  medications: '',
  source: '',
  preferredDentist: '',
  insurance: '',
  notes: '',
};

const emptyAppointment = {
  date: todayISO(),
  startTime: '09:00',
  duration: 30,
  treatmentId: '',
  notes: '',
};

export default function PublicBookingView({ clinicSlug }) {
  const [clinic, setClinic] = useState(null);
  const [dentists, setDentists] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [patientType, setPatientType] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [patient, setPatient] = useState({ ...emptyPatient });
  const [appointment, setAppointment] = useState({ ...emptyAppointment });

  useEffect(() => {
    let isActive = true;
    const loadClinic = async () => {
      setLoading(true);
      setError('');
      const { data, error: loadError } = await supabase
        .from('clinics')
        .select('id, name, slug')
        .eq('slug', clinicSlug)
        .maybeSingle();
      if (!isActive) return;
      if (loadError || !data) {
        setClinic(null);
        setError('Clinic not found. Please check the link.');
        setLoading(false);
        return;
      }
      setClinic(data);
      setLoading(false);
    };
    loadClinic();
    return () => {
      isActive = false;
    };
  }, [clinicSlug]);

  useEffect(() => {
    if (!clinic?.id) return;
    let isActive = true;
    const loadClinicData = async () => {
      const [{ data: dentistData }, { data: treatmentData }] = await Promise.all([
        supabase
          .from('staff')
          .select('id, name, role')
          .eq('clinic_id', clinic.id)
          .eq('role', 'dentist')
          .order('name', { ascending: true }),
        supabase
          .from('treatments')
          .select('id, name, duration')
          .eq('clinic_id', clinic.id)
          .order('name', { ascending: true }),
      ]);
      if (!isActive) return;
      setDentists(dentistData || []);
      setTreatments(treatmentData || []);
    };
    loadClinicData();
    return () => {
      isActive = false;
    };
  }, [clinic]);

  useEffect(() => {
    if (!appointment.treatmentId) return;
    const selected = treatments.find((t) => String(t.id) === String(appointment.treatmentId));
    if (selected && typeof selected.duration === 'number') {
      setAppointment((prev) => ({ ...prev, duration: selected.duration }));
    }
  }, [appointment.treatmentId, treatments]);

  const endTime = useMemo(
    () => addMinutes(appointment.startTime, appointment.duration),
    [appointment.startTime, appointment.duration]
  );

  const updatePatient = (field) => (event) => {
    setPatient((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const updateAppointment = (field) => (event) => {
    setAppointment((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const isValidPatientStep = () => {
    if (patientType === 'existing') {
      if (!lookupEmail.trim()) {
        setError('Please enter your email.');
        return false;
      }
      if (!lookupEmail.includes('@')) {
        setError('Please enter a valid email.');
        return false;
      }
      return true;
    }
    if (!patient.name.trim()) {
      setError('Please enter patient name.');
      return false;
    }
    if (!patient.phone.trim()) {
      setError('Please enter phone number.');
      return false;
    }
    return true;
  };

  const isValidAppointmentStep = () => {
    const now = new Date();
    const today = todayISO();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (!appointment.date || !appointment.startTime) {
      setError('Please choose a date and time.');
      return false;
    }
    if (appointment.date < today || (appointment.date === today && appointment.startTime <= currentTime)) {
      setError('Please choose a future date and time.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 0 && !patientType) {
      setError('Please choose new or existing patient.');
      return;
    }
    if (step === 1 && !isValidPatientStep()) return;
    if (step === 2 && !isValidAppointmentStep()) return;
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(false);

    if (!clinic) {
      setError('Clinic not found. Please check the link.');
      return;
    }

    if (!patientType) {
      setError('Please choose new or existing patient.');
      return;
    }
    if (!isValidPatientStep() || !isValidAppointmentStep()) return;

    setSubmitting(true);
    const { error: insertError } = await supabase
      .from('appointment_requests')
      .insert([
        {
          clinic_id: clinic.id,
          patient_name: patientType === 'new' ? patient.name.trim() : lookupEmail.trim(),
          phone: patientType === 'new' ? patient.phone.trim() || null : null,
          email: patientType === 'new' ? patient.email.trim() || null : lookupEmail.trim(),
          preferred_dates: appointment.date ? [appointment.date] : [],
          preferred_times: appointment.startTime ? [appointment.startTime] : [],
          notes: appointment.notes.trim() || null,
          is_new_patient: patientType === 'new',
          lookup_email: patientType === 'existing' ? lookupEmail.trim() : null,
          patient_id_number: patientType === 'new' ? patient.idNumber.trim() || null : null,
          patient_dob: patientType === 'new' ? patient.dob || null : null,
          patient_gender: patientType === 'new' ? patient.gender || null : null,
          patient_tax_number: patientType === 'new' ? patient.taxNumber.trim() || null : null,
          patient_address: patientType === 'new' ? patient.address.trim() || null : null,
          emergency_contact_name: patientType === 'new' ? patient.emergencyContactName.trim() || null : null,
          emergency_contact_phone: patientType === 'new' ? patient.emergencyContactPhone.trim() || null : null,
          allergies: patientType === 'new' ? patient.allergies.trim() || null : null,
          medical_conditions: patientType === 'new' ? patient.medicalConditions.trim() || null : null,
          medications: patientType === 'new' ? patient.medications.trim() || null : null,
          source: patientType === 'new' ? patient.source || null : null,
          preferred_dentist_id: patientType === 'new' ? patient.preferredDentist || null : null,
          insurance: patientType === 'new' ? patient.insurance.trim() || null : null,
          patient_notes: patientType === 'new' ? patient.notes.trim() || null : null,
          appointment_date: appointment.date || null,
          appointment_start_time: appointment.startTime || null,
          appointment_duration: appointment.duration || null,
          appointment_treatment_id: appointment.treatmentId || null,
          appointment_notes: appointment.notes.trim() || null,
        },
      ]);

    if (insertError) {
      setError('Failed to submit. Please try again or contact the clinic.');
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setStep(0);
    setPatientType('');
    setLookupEmail('');
    setPatient({ ...emptyPatient });
    setAppointment({ ...emptyAppointment });
    setSubmitting(false);
  };

  const selectedTreatment = treatments.find((t) => String(t.id) === String(appointment.treatmentId));
  const selectedDentist = dentists.find((d) => String(d.id) === String(patient.preferredDentist));

  return (
    <div className="booking-page">
      <div className="card booking-card">
        <div className="card-header booking-header">
          <div>
            <h1 className="booking-title">Request an appointment</h1>
            <p className="booking-subtitle">
              {clinic ? clinic.name : 'Loading clinic info...'}
            </p>
          </div>
          {clinic?.slug && <span className="booking-badge">{clinic.slug}</span>}
        </div>
        <div className="card-body">
          {loading && <p className="booking-status">Loading clinic...</p>}
          {!loading && !clinic && <p className="form-error">{error}</p>}
          {!loading && clinic && success && (
            <div className="booking-success-card">
              <h2>Thank you for the booking</h2>
              <p>Please check your email. We will process your request as soon as possible.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSuccess(false)}
              >
                Back to booking page
              </button>
            </div>
          )}
          {!loading && clinic && !success && (
            <form className="booking-form" onSubmit={handleSubmit}>
              <div className="booking-steps">
                <div className={`booking-step ${step === 0 ? 'active' : step > 0 ? 'done' : ''}`}>
                  <span>1</span> Patient type
                </div>
                <div className={`booking-step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>
                  <span>2</span> Patient details
                </div>
                <div className={`booking-step ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>
                  <span>3</span> Appointment
                </div>
                <div className={`booking-step ${step === 3 ? 'active' : ''}`}>
                  <span>4</span> Review
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}
              {step === 0 && (
                <div className="booking-choice-grid">
                  <button
                    type="button"
                    className={`booking-choice ${patientType === 'new' ? 'active' : ''}`}
                    onClick={() => setPatientType('new')}
                  >
                    <div className="booking-choice-title">New patient</div>
                    <div className="booking-choice-sub">Fill in personal and medical details.</div>
                  </button>
                  <button
                    type="button"
                    className={`booking-choice ${patientType === 'existing' ? 'active' : ''}`}
                    onClick={() => setPatientType('existing')}
                  >
                    <div className="booking-choice-title">Existing patient</div>
                    <div className="booking-choice-sub">Use your email to find your record.</div>
                  </button>
                </div>
              )}

              {step === 1 && patientType === 'existing' && (
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={lookupEmail}
                    onChange={(event) => setLookupEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              )}

              {step === 1 && patientType === 'new' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={patient.name} onChange={updatePatient('name')} required />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">IC/ID</label>
                      <input className="form-input" value={patient.idNumber} onChange={updatePatient('idNumber')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">DOB</label>
                      <input className="form-input" type="date" value={patient.dob} onChange={updatePatient('dob')} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Gender</label>
                      <select className="form-select" value={patient.gender} onChange={updatePatient('gender')}>
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tax Number</label>
                      <input className="form-input" value={patient.taxNumber} onChange={updatePatient('taxNumber')} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input className="form-input" value={patient.phone} onChange={updatePatient('phone')} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-input" type="email" value={patient.email} onChange={updatePatient('email')} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input className="form-input" value={patient.address} onChange={updatePatient('address')} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Emergency Contact Name</label>
                      <input
                        className="form-input"
                        value={patient.emergencyContactName}
                        onChange={updatePatient('emergencyContactName')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Emergency Contact Phone</label>
                      <input
                        className="form-input"
                        value={patient.emergencyContactPhone}
                        onChange={updatePatient('emergencyContactPhone')}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Allergies</label>
                    <textarea className="form-textarea" value={patient.allergies} onChange={updatePatient('allergies')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Medical Conditions</label>
                    <textarea
                      className="form-textarea"
                      value={patient.medicalConditions}
                      onChange={updatePatient('medicalConditions')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Medications</label>
                    <textarea
                      className="form-textarea"
                      value={patient.medications}
                      onChange={updatePatient('medications')}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Source</label>
                      <select className="form-select" value={patient.source} onChange={updatePatient('source')}>
                        <option value="">Select</option>
                        <option value="walk-in">Walk-in</option>
                        <option value="call">Call</option>
                        <option value="social-media">Social Media</option>
                        <option value="referral">Referral</option>
                        <option value="phone">Phone</option>
                        <option value="google">Google</option>
                        <option value="website">Website</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Preferred Dentist</label>
                      <select
                        className="form-select"
                        value={patient.preferredDentist}
                        onChange={updatePatient('preferredDentist')}
                      >
                        <option value="">No preference</option>
                        {dentists.map((dentist) => (
                          <option key={dentist.id} value={dentist.id}>
                            {dentist.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Insurance</label>
                      <input className="form-input" value={patient.insurance} onChange={updatePatient('insurance')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Notes</label>
                      <textarea className="form-textarea" value={patient.notes} onChange={updatePatient('notes')} />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Date</label>
                      <input
                        className="form-input"
                        type="date"
                        value={appointment.date}
                        onChange={updateAppointment('date')}
                        min={todayISO()}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Time</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          className="form-input"
                          type="time"
                          value={appointment.startTime}
                          onChange={updateAppointment('startTime')}
                          required
                        />
                        <span className="text-muted" style={{ fontSize: 12 }}>to</span>
                        <input className="form-input" type="time" value={endTime} readOnly />
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Treatment</label>
                      <select
                        className="form-select"
                        value={appointment.treatmentId}
                        onChange={updateAppointment('treatmentId')}
                      >
                        <option value="">None</option>
                        {treatments.map((treatment) => (
                          <option key={treatment.id} value={treatment.id}>
                            {treatment.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Duration (mins)</label>
                      <input
                        className="form-input"
                        type="number"
                        min="10"
                        step="5"
                        value={appointment.duration}
                        onChange={(event) =>
                          setAppointment((prev) => ({
                            ...prev,
                            duration: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Appointment Notes</label>
                    <textarea className="form-textarea" value={appointment.notes} onChange={updateAppointment('notes')} />
                  </div>
                </>
              )}

              {step === 3 && (
                <div className="booking-summary">
                  <div className="booking-summary-section">
                    <h3>Patient details</h3>
                    <div className="booking-summary-grid">
                      <div>
                        <div className="booking-summary-label">Name</div>
                        <div>{patientType === 'new' ? patient.name || '-' : 'Existing patient'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">Phone</div>
                        <div>{patientType === 'new' ? patient.phone || '-' : '-'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">Email</div>
                        <div>{patientType === 'new' ? patient.email || '-' : lookupEmail || '-'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">IC/ID</div>
                        <div>{patientType === 'new' ? patient.idNumber || '-' : '-'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">DOB</div>
                        <div>{patientType === 'new' ? patient.dob || '-' : '-'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">Gender</div>
                        <div>{patientType === 'new' ? patient.gender || '-' : '-'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">Preferred Dentist</div>
                        <div>{patientType === 'new' ? (selectedDentist ? selectedDentist.name : 'No preference') : '-'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">Source</div>
                        <div>{patientType === 'new' ? patient.source || '-' : '-'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="booking-summary-section">
                    <h3>Appointment details</h3>
                    <div className="booking-summary-grid">
                      <div>
                        <div className="booking-summary-label">Date</div>
                        <div>{appointment.date || '-'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">Time</div>
                        <div>{appointment.startTime ? `${appointment.startTime} - ${endTime}` : '-'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">Treatment</div>
                        <div>{selectedTreatment ? selectedTreatment.name : 'None'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">Duration</div>
                        <div>{appointment.duration ? `${appointment.duration} mins` : '-'}</div>
                      </div>
                      <div>
                        <div className="booking-summary-label">Notes</div>
                        <div>{appointment.notes || '-'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="booking-actions">
                {step > 0 && (
                  <button className="btn btn-secondary btn-lg" type="button" onClick={handleBack}>
                    Back
                  </button>
                )}
                {step < 3 && (
                  <button className="btn btn-primary btn-lg" type="button" onClick={handleNext}>
                    Next
                  </button>
                )}
                {step === 3 && (
                  <button className="btn btn-primary btn-lg" type="submit" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit request'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
