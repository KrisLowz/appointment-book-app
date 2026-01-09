import { useEffect, useState } from 'react';
import DataStore from '../data';

// Data hook wrapping DataStore (localStorage/Supabase)
export default function useDataStore(activeClinicId) {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activity, setActivity] = useState([]);
  const [staff, setStaff] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [isReady, setIsReady] = useState(false);

  const toPromise = (value) => (value && typeof value.then === 'function' ? value : Promise.resolve(value));

  const handleAsync = (maybePromise, onSuccess) =>
    toPromise(maybePromise)
      .then((result) => {
        onSuccess(result);
        return result;
      })
      .catch((error) => {
        console.error('DataStore error:', error);
        return null;
      });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsReady(false);
      if (activeClinicId) {
        DataStore.setActiveClinicId(activeClinicId);
      } else {
        setPatients([]);
        setAppointments([]);
        setRooms([]);
        setTreatments([]);
        setSettings(null);
        setActivity([]);
        setStaff([]);
        setHolidays([]);
        setIsReady(true);
        return;
      }

      const [
        patientsData,
        appointmentsData,
        roomsData,
        treatmentsData,
        settingsData,
        activityData,
        staffData,
        holidaysData,
      ] = await Promise.all([
        toPromise(DataStore.getPatients()),
        toPromise(DataStore.getAppointments()),
        toPromise(DataStore.getRooms()),
        toPromise(DataStore.getTreatments()),
        toPromise(DataStore.getSettings()),
        toPromise(DataStore.getActivityLog()),
        toPromise(DataStore.getStaff()),
        toPromise(DataStore.getHolidays()),
      ]);

      if (cancelled) return;

      setPatients(patientsData || []);
      setAppointments(appointmentsData || []);
      setRooms(roomsData || []);
      setTreatments(treatmentsData || []);
      setSettings(settingsData || null);
      setActivity(activityData || []);
      setStaff(staffData || []);
      setHolidays(holidaysData || []);
      setIsReady(true);
    };

    load().catch((error) => console.error('Failed to load data:', error));

    return () => {
      cancelled = true;
    };
  }, [activeClinicId]);

  const refreshAppointments = () => handleAsync(DataStore.getAppointments(), (data) => setAppointments(data || []));
  const refreshPatients = () => handleAsync(DataStore.getPatients(), (data) => setPatients(data || []));
  const refreshRooms = () => handleAsync(DataStore.getRooms(), (data) => setRooms(data || []));
  const refreshTreatments = () => handleAsync(DataStore.getTreatments(), (data) => setTreatments(data || []));
  const refreshSettings = () => handleAsync(DataStore.getSettings(), (data) => setSettings(data || null));
  const refreshStaff = () => handleAsync(DataStore.getStaff(), (data) => setStaff(data || []));
  const refreshHolidays = () => handleAsync(DataStore.getHolidays(), (data) => setHolidays(data || []));
  const refreshActivity = () => handleAsync(DataStore.getActivityLog(), (data) => setActivity(data || []));

  const addPatient = (patient) =>
    handleAsync(DataStore.addPatient(patient), () => {
      refreshPatients();
      refreshActivity();
    });

  const updatePatient = (id, updates) =>
    handleAsync(DataStore.updatePatient(id, updates), () => {
      refreshPatients();
      refreshActivity();
    });

  const deletePatient = (id) =>
    handleAsync(DataStore.deletePatient(id), () => {
      refreshPatients();
      refreshActivity();
    });

  const addAppointment = (appointment) =>
    handleAsync(DataStore.addAppointment(appointment), () => {
      refreshAppointments();
      refreshActivity();
    });

  const updateAppointment = (id, updates) =>
    handleAsync(DataStore.updateAppointment(id, updates), () => {
      refreshAppointments();
      refreshActivity();
    });

  const deleteAppointment = (id) =>
    handleAsync(DataStore.deleteAppointment(id), () => {
      refreshAppointments();
      refreshActivity();
    });

  const saveSettings = (data) =>
    handleAsync(DataStore.saveSettings(data), () => {
      refreshSettings();
      refreshActivity();
    });

  const addRoom = (room) =>
    handleAsync(DataStore.addRoom(room), () => {
      refreshRooms();
      refreshActivity();
    });

  const updateRoom = (id, updates) =>
    handleAsync(DataStore.updateRoom(id, updates), () => {
      refreshRooms();
      refreshActivity();
    });

  const deleteRoom = (id) =>
    handleAsync(DataStore.deleteRoom(id), () => {
      refreshRooms();
      refreshActivity();
    });

  const addTreatment = (treatment) =>
    handleAsync(DataStore.addTreatment(treatment), () => {
      refreshTreatments();
      refreshActivity();
    });

  const updateTreatment = (id, updates) =>
    handleAsync(DataStore.updateTreatment(id, updates), () => {
      refreshTreatments();
      refreshActivity();
    });

  const deleteTreatment = (id) =>
    handleAsync(DataStore.deleteTreatment(id), () => {
      refreshTreatments();
      refreshActivity();
    });

  const addStaff = (member) =>
    handleAsync(DataStore.addStaff(member), () => {
      refreshStaff();
      refreshActivity();
    });

  const updateStaff = (id, updates) =>
    handleAsync(DataStore.updateStaff(id, updates), () => {
      refreshStaff();
      refreshActivity();
    });

  const deleteStaff = (id) =>
    handleAsync(DataStore.deleteStaff(id), () => {
      refreshStaff();
      refreshActivity();
    });

  const saveHolidays = (list) =>
    handleAsync(DataStore.saveHolidays(list), () => {
      refreshHolidays();
      refreshActivity();
    });

  const addHoliday = (holiday) =>
    handleAsync(DataStore.addHoliday(holiday), () => {
      refreshHolidays();
      refreshActivity();
    });

  const updateHoliday = (id, updates) =>
    handleAsync(DataStore.updateHoliday(id, updates), () => {
      refreshHolidays();
      refreshActivity();
    });

  const deleteHoliday = (id) =>
    handleAsync(DataStore.deleteHoliday(id), () => {
      refreshHolidays();
      refreshActivity();
    });

  const clearAll = () =>
    handleAsync(DataStore.clearAllData(), () => {
      refreshPatients();
      refreshAppointments();
      refreshRooms();
      refreshTreatments();
      refreshSettings();
      refreshStaff();
      refreshHolidays();
      refreshActivity();
    });

  return {
    patients,
    appointments,
    rooms,
    treatments,
    settings,
    activity,
    staff,
    holidays,
    isReady,
    addPatient,
    updatePatient,
    deletePatient,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    saveSettings,
    addRoom,
    updateRoom,
    deleteRoom,
    addTreatment,
    updateTreatment,
    deleteTreatment,
    addStaff,
    updateStaff,
    deleteStaff,
    saveHolidays,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    clearAll,
  };
}
