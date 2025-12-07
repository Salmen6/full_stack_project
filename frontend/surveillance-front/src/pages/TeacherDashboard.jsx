import React, { useEffect, useState, useMemo } from 'react';
import ExamService from '../services/ExamService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, AlertTriangle, Clock, Users, BookOpen } from 'lucide-react';

// --- Helper Functions ---
const fmtStart = (s) => s?.heureDebut || s?.heure_debut || '—';
const fmtEnd = (s) => s?.heureFin || s?.heure_fin || '—';

const getHour = (timeStr) => {
  if (!timeStr) return -1;
  const part = timeStr.split(':')[0];
  return parseInt(part, 10);
};

// --- Reusable UI Components ---

const Alert = ({ type, text }) => {
  let colorClasses = "";
  let icon = "";

  switch (type) {
    case 'success':
      colorClasses = "text-emerald-900 border-emerald-200 bg-emerald-50";
      icon = "✅";
      break;
    case 'danger':
      colorClasses = "text-rose-900 border-rose-200 bg-rose-50";
      icon = "🚨";
      break;
    default:
      colorClasses = "text-blue-900 border-blue-200 bg-blue-50";
      icon = "💡";
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 flex items-center mb-6 ${colorClasses} shadow-lg`}
      role="alert"
    >
      <span className="mr-3 text-2xl drop-shadow-sm">{icon}</span>
      <p className="text-sm font-semibold tracking-wide">{text}</p>
    </div>
  );
};

const UserStatsCard = ({ user, teacherData }) => {
  const currentAssignments = teacherData?.affectations?.length || 0;
  const maxAssignments = teacherData?.chargeSurveillance || 0;
  const percentage = maxAssignments > 0 ? (currentAssignments / maxAssignments) * 100 : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-white p-6 shadow-xl">
      <h3 className="mb-5 flex items-center gap-3 border-b border-indigo-100 pb-4 text-xl font-bold text-slate-900">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 shadow-lg">
          <span className="text-lg">👤</span>
        </div>
        Teacher Profile
      </h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 font-medium">Name</span>
          <span className="font-bold text-slate-900">{user?.nomComplet || 'N/A'}</span>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 font-medium">Grade</span>
          <span className="font-bold text-slate-900">{teacherData?.grade || '—'}</span>
        </div>

        <div className="mt-4 pt-4 border-t border-indigo-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-600 font-medium">Surveillance Quota</span>
            <span className="text-sm font-bold text-indigo-600">
              {currentAssignments} / {maxAssignments}
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentage >= 100 ? 'bg-rose-500' : percentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>

          {percentage >= 100 && (
            <p className="text-xs text-rose-600 mt-2 font-medium">
              ⚠ You have reached your maximum surveillance quota
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
const TeacherDashboard = () => {
  const { user } = useAuth();
  const [seances, setSeances] = useState([]);
  const [teacherData, setTeacherData] = useState(null);
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submittingWish, setSubmittingWish] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id_user) loadData();
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const seancesRes = await ExamService.getSeances();
      setSeances(seancesRes.data || []);

      const teacherRes = await ExamService.getEnseignantByUserId(user.id_user);
      setTeacherData(teacherRes.data || null);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to load data from backend.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWish = async (idSeance) => {
    if (!teacherData) return;

    setSubmittingWish(idSeance);
    setMessage(null);

    try {
      const res = await ExamService.submitVoeu(teacherData.id, idSeance);

      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        await loadData();
      } else {
        setMessage({ type: 'danger', text: res.data.message });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to submit wish.';
      setMessage({ type: 'danger', text: errorMsg });
    } finally {
      setSubmittingWish(null);
    }
  };

  /**
   * Determines the status of a session for the current teacher
   * 
   * Priority order: 
   * 1. assigned → Already assigned (green)
   * 2. subject_conflict → Teacher teaches this subject (red)
   * 3. survey_conflict → Conflicts with teacher's taught session at same time (red)
   * 4. quota → Quota reached (rose)
   * 5. overlap → Time conflict with existing assignment (rose)
   * 6. full → Session full (gray)
   * 7. open → Available (indigo)
   */
  const getSessionStatus = (s) => {
    if (!teacherData) return { status: 'loading', label: 'Loading...', reason: '' };

    // Check if already assigned
    const alreadyAssigned = teacherData.affectations?.some(a => a.seance.id === s.id);
    if (alreadyAssigned) {
      return { status: 'assigned', label: 'Already Assigned', reason: 'You are already assigned to this session' };
    }

    // CRITICAL: Check if teacher teaches this subject (subject conflict)
    if (ExamService.subjectConflict(teacherData, s)) {
      return { 
        status: 'subject_conflict', 
        label: 'Your Subject', 
        reason: 'You teach this subject and cannot supervise it' 
      };
    }

    // NEW: Check for survey conflict
    // Teacher cannot survey sessions that conflict with sessions where they teach
    if (ExamService.surveyConflict(teacherData, s, seances)) {
      return {
        status: 'survey_conflict',
        label: 'Survey Conflict',
        reason: 'Conflicts with a session of your subject at the same time'
      };
    }

    // Check quota
    const currentAssignments = teacherData.affectations?.length || 0;
    const maxAssignments = teacherData.chargeSurveillance || 0;
    if (currentAssignments >= maxAssignments) {
      return { status: 'quota', label: 'Quota Reached', reason: 'You have reached your surveillance quota' };
    }

    // Check time overlap with existing assignments
    if (ExamService.timeOverlap(teacherData, s)) {
      return { status: 'overlap', label: 'Time Conflict', reason: 'You have another assignment at this time' };
    }

    // Check if full
    const ins = s.nbSurveillantsInscrits ?? 0;
    const need = s.nbSurveillantsNecessaires ?? 0;
    if (ins >= need) {
      return { status: 'full', label: 'Full', reason: 'This session has reached capacity' };
    }

    return { status: 'open', label: 'Available', reason: '' };
  };

  /**
   * Calculate date range: from ACTUAL first session to ACTUAL last session
   * Exclude Sundays from the display
   * 
   * FIXED: Now correctly finds min and max dates across ALL sessions,
   * regardless of gaps in the data
   */
  const calendarDates = useMemo(() => {
    if (seances.length === 0) return [];
    
    // Extract all valid dates from sessions and parse them as Date objects
    const sessionDates = seances
      .map(s => s.date || s.date_seance)
      .filter(Boolean)
      .map(dateStr => new Date(dateStr));
    
    if (sessionDates.length === 0) return [];
    
    // Find ACTUAL minimum and maximum dates using timestamps
    const minTimestamp = Math.min(...sessionDates.map(d => d.getTime()));
    const maxTimestamp = Math.max(...sessionDates.map(d => d.getTime()));
    
    const firstDate = new Date(minTimestamp);
    const lastDate = new Date(maxTimestamp);
    
    // Generate ALL dates between first and last (inclusive), excluding Sundays
    const dateRange = [];
    const currentDate = new Date(firstDate);
    
    while (currentDate <= lastDate) {
      // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      if (currentDate.getDay() !== 0) {
        dateRange.push(currentDate.toISOString().split('T')[0]);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dateRange;
  }, [seances]);

  const calendarHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  const getSessionsForCell = (dateStr, hour) => {
    return seances.filter(s => {
      const sDate = s.date || s.date_seance;
      const sHour = getHour(s.heureDebut || s.heure_debut);
      return sDate === dateStr && sHour === hour;
    });
  };

  const SessionCard = ({ session }) => {
    const { status, label, reason } = getSessionStatus(session);
    const isSubmitting = submittingWish === session.id;

    let cardClass = "mt-2 p-4 rounded-2xl border transition-all duration-300 relative group flex flex-col justify-between min-h-[140px] ";
    let btnClass = "mt-auto w-full py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider text-center transition-all duration-300 border shadow-md hover:shadow-lg flex items-center justify-center gap-2 ";
    let textColor = "text-slate-900";
    let Icon = null;

    // Style for assigned sessions (green)
    if (status === 'assigned') {
      cardClass += "bg-emerald-50 border-emerald-300 shadow-emerald-100";
      btnClass += "bg-emerald-200 border-emerald-300 text-emerald-800 cursor-default";
      textColor = "text-emerald-900";
      Icon = Check;
    } 
    // Style for subject conflict sessions (distinctive red/orange)
    else if (status === 'subject_conflict') {
      cardClass += "bg-red-50 border-red-400 shadow-red-100 opacity-90";
      btnClass += "bg-red-200 border-red-400 text-red-800 cursor-not-allowed";
      textColor = "text-red-900";
      Icon = Lock;
    }
    // NEW: Style for survey conflict sessions (same red as subject conflict)
    else if (status === 'survey_conflict') {
      cardClass += "bg-red-50 border-red-400 shadow-red-100 opacity-90";
      btnClass += "bg-red-200 border-red-400 text-red-800 cursor-not-allowed";
      textColor = "text-red-900";
      Icon = Lock;
    }
    // Style for other locked sessions (overlap, quota)
    else if (status === 'overlap' || status === 'quota') {
      cardClass += "bg-rose-50 border-rose-300 shadow-rose-100 opacity-75";
      btnClass += "bg-rose-100 border-rose-300 text-rose-700 cursor-not-allowed";
      textColor = "text-rose-900";
      Icon = Lock;
    } 
    // Style for full sessions
    else if (status === 'full') {
      cardClass += "bg-slate-100 border-slate-300 shadow-slate-100 opacity-75";
      btnClass += "bg-slate-200 border-slate-300 text-slate-600 cursor-not-allowed";
      textColor = "text-slate-800";
      Icon = Users;
    } 
    // Style for available sessions
    else {
      cardClass += "bg-white border-indigo-200 shadow-indigo-100 hover:shadow-xl hover:scale-[1.02]";
      btnClass += "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-indigo-400 hover:from-indigo-600 hover:to-purple-600";
      Icon = Check;
    }

    return (
      <div className={cardClass}>
        {/* Lock icon for all locked sessions */}
        {(status === 'subject_conflict' || status === 'survey_conflict' || status === 'overlap' || status === 'quota') && (
          <div className="absolute top-2 right-2">
            <Lock className={status === 'subject_conflict' || status === 'survey_conflict' ? 'text-red-600' : 'text-rose-500'} size={20} />
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-3">
            <span className={`font-bold text-sm tracking-tight ${textColor} flex items-center gap-1`}>
              <Clock size={14} />
              {fmtStart(session)} - {fmtEnd(session)}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm ${
              status === 'open' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
              'bg-slate-100 text-slate-600 border-slate-300'
            }`}>
              {session.nbSurveillantsInscrits ?? 0}/{session.nbSurveillantsNecessaires ?? 0}
            </span>
          </div>

          <div className={`text-xs font-semibold leading-relaxed mb-3 line-clamp-2 ${textColor} flex items-start gap-1`}>
            <BookOpen size={14} className="mt-0.5 flex-shrink-0" />
            <span>{(session.epreuves || []).map(e => e.matiere?.nom || e.nom).join(', ') || 'Unknown Subject'}</span>
          </div>

          {reason && (
            <div className={`text-[10px] rounded px-2 py-1 mb-2 flex items-center gap-1 ${
              status === 'subject_conflict' || status === 'survey_conflict'
                ? 'text-red-700 bg-red-100 border border-red-300' 
                : 'text-slate-600 bg-slate-50'
            }`}>
              <AlertTriangle size={10} />
              {reason}
            </div>
          )}
        </div>

        <button
          onClick={() => status === 'open' && !isSubmitting && handleWish(session.id)}
          disabled={status !== 'open' || isSubmitting}
          className={btnClass}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Submitting...
            </>
          ) : (
            <>
              {Icon && <Icon size={14} />}
              {status === 'assigned' ? 'Assigned' :
               status === 'subject_conflict' ? 'Your Subject' :
               status === 'survey_conflict' ? 'Survey Conflict' :
               status === 'open' ? 'Submit Wish' :
               label}
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 text-slate-800 font-sans">
      
      <div className="relative z-10 p-6 lg:p-10">
        
        {/* Header */}
        <header className="mb-10 flex flex-col gap-6 rounded-2xl border border-indigo-200 bg-white p-8 shadow-xl md:flex-row md:justify-between md:items-end">
          <div>
            <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900">
              Teacher Dashboard
            </h1>
            <p className="mt-3 text-slate-700 font-semibold text-lg">
              Browse sessions and submit your wishes (automatic assignment)
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-5 rounded-full border border-indigo-200 bg-white px-6 py-3 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
                <Lock size={12} /> Your Subject
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
                <Lock size={12} /> Locked
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Users size={12} /> Full
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                <Check size={12} /> Available
              </div>
            </div>

            <button
              onClick={() => navigate("/final-calendar")}
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-7 py-3 font-bold text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
            >
              📅 View Calendar
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">

          <div className="space-y-6 lg:col-span-3">
            {message && <Alert type={message.type} text={message.text} />}
            {user && <UserStatsCard user={user} teacherData={teacherData} />}
          </div>

          <div className="lg:col-span-9">
            <div className="rounded-2xl border border-indigo-200 bg-white shadow-xl overflow-hidden">

              <div className="flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-400 shadow-lg">
                    <span className="text-2xl">🗓</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900">Session Calendar</span>
                </div>
              </div>

              {isLoading ? (
                <div className="flex h-96 items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 h-12 w-12 mx-auto rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                    <p className="text-lg font-bold text-slate-800">Loading sessions...</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[1000px] p-6">
                    <div
                      className="grid gap-[2px] rounded-2xl border border-indigo-200 bg-indigo-50 shadow-inner overflow-hidden"
                      style={{ gridTemplateColumns: `90px repeat(${calendarDates.length}, minmax(170px, 1fr))` }}
                    >
                      
                      <div className="sticky left-0 z-30 flex items-center justify-center bg-gradient-to-br from-indigo-700 to-purple-700 p-4 text-xs font-black uppercase tracking-widest text-white shadow-lg">
                        Time
                      </div>

                      {calendarDates.map(date => (
                        <div key={date} className="flex flex-col items-center justify-center bg-white p-4 border-r border-indigo-100">
                          <div className="text-[11px] font-black uppercase tracking-widest text-indigo-600">
                            {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="mt-1.5 text-lg font-black text-slate-900">
                            {new Date(date).getDate()}
                          </div>
                        </div>
                      ))}

                      {calendarHours.map(hour => (
                        <React.Fragment key={hour}>
                          <div className="sticky left-0 z-20 flex items-start justify-center bg-gradient-to-br from-indigo-600 to-purple-600 p-3 pt-5 text-sm font-black text-white shadow-md border-b border-indigo-500">
                            {hour}:00
                          </div>

                          {calendarDates.map(date => {
                            const sessions = getSessionsForCell(date, hour);
                            return (
                              <div key={`${date}-${hour}`} className="relative min-h-[150px] p-2 bg-white border-r border-b border-indigo-100">
                                {sessions.length > 0 ? (
                                  sessions.map(s => <SessionCard key={s.id} session={s} />)
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;