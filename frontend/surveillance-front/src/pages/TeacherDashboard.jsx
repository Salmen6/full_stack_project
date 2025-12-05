import React, { useEffect, useState, useMemo } from 'react';
import ExamService from '../services/ExamService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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
      colorClasses = "text-emerald-900";
      icon = "✅";
      break;
    case 'danger':
      colorClasses = "text-rose-900";
      icon = "🚨";
      break;
    default:
      colorClasses = "text-blue-900";
      icon = "💡";
  }

  return (
    <div 
      className={`relative overflow-hidden rounded-[20px] border border-white/30 p-4 flex items-center mb-6 ${colorClasses}`}
      style={{
        background: 'rgba(255, 255, 255, 0.36)',
        backdropFilter: 'blur(21px)',
        WebkitBackdropFilter: 'blur(21px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 34px 17px rgba(255, 255, 255, 0.07)'
      }}
      role="alert"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
      <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-white/80 via-transparent to-white/30"></div>
      
      <span className="mr-3 text-2xl drop-shadow-sm">{icon}</span>
      <p className="text-sm font-semibold tracking-wide">{text}</p>
    </div>
  );
};

const UserStatsCard = ({ user, teacherData }) => (
  <div 
    className="relative overflow-hidden rounded-[20px] border border-white/30 p-6 transition-all duration-300 hover:scale-[1.02]"
    style={{
      background: 'rgba(255, 255, 255, 0.36)',
      backdropFilter: 'blur(21px)',
      WebkitBackdropFilter: 'blur(21px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 34px 17px rgba(255, 255, 255, 0.07)'
    }}
  >
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
    <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-white/80 via-transparent to-white/30"></div>
    
    <h3 className="mb-5 flex items-center gap-3 border-b border-white/30 pb-4 text-xl font-bold text-slate-900">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 shadow-lg backdrop-blur-sm">
        <span className="text-lg">👤</span>
      </div>
      Teacher Profile
    </h3>
    
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-800 font-semibold">Name</span>
<span className="font-bold text-slate-900">          {user?.nomComplet || 'N/A'}
        </span>
      </div>
      
      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-800 font-semibold">Grade</span>
        <span className="font-bold text-slate-900">{teacherData?.grade || '—'}</span>
      </div>

      <div className="mt-3 border-t border-white/30 pt-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-800 font-semibold">Current Quota</span>
          <span className="flex items-center gap-2 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">
             {teacherData?.chargeSurveillance ?? '—'} 
             <span className="text-xs font-semibold text-slate-700">sessions</span>
          </span>
        </div>
      </div>
    </div>
  </div>
);

// --- Main Component ---
const TeacherDashboard = () => {
  const { user } = useAuth();
  const [seances, setSeances] = useState([]);
  const [teacherData, setTeacherData] = useState(null);
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
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
    try {
      const se = seances.find(s => s.id === idSeance);
      if (ExamService.subjectConflict(teacherData, se))
        return setMessage({ type: 'danger', text: 'Subject conflict.' });

      if (ExamService.timeOverlap(teacherData, se))
        return setMessage({ type: 'danger', text: 'Time conflict.' });

      const res = await ExamService.submitVoeu(teacherData.id, idSeance);
      setMessage({ type: 'success', text: res.data || 'Wish submitted.' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to submit wish.' });
    }
  };

  const getSessionStatus = (s) => {
    if (!teacherData) return { status: 'loading', label: 'Loading...' };
    if (ExamService.subjectConflict(teacherData, s)) return { status: 'conflict', label: 'Subject Conflict' };
    if (ExamService.timeOverlap(teacherData, s)) return { status: 'overlap', label: 'Time Conflict' };
    const ins = s.nbSurveillantsInscrits ?? 0;
    const need = s.nbSurveillantsNecessaires ?? 0;
    if (ins >= need) return { status: 'full', label: 'Full' };
    return { status: 'open', label: 'Available' };
  };

  const calendarDates = useMemo(() => {
    const dates = [...new Set(seances.map(s => s.date || s.date_seance))].filter(Boolean);
    dates.sort();
    return dates.slice(0, 10);
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
    const { status } = getSessionStatus(session);
    
    let btnClass = "mt-auto w-full py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider text-center transition-all duration-300 border shadow-md hover:shadow-lg ";
    let textColor = "text-slate-900";
    
    if (status === 'conflict' || status === 'overlap') {
      btnClass += "bg-red-100/60 border-red-200/50 text-red-700 cursor-not-allowed";
      textColor = "text-red-900";
    } else if (status === 'full') {
      btnClass += "bg-slate-200/60 border-slate-300/50 text-slate-600 cursor-not-allowed";
      textColor = "text-slate-800";
    } else {
      btnClass += "bg-gradient-to-r from-cyan-400/80 to-blue-400/80 text-white border-cyan-300/50 hover:from-cyan-500 hover:to-blue-500 hover:scale-105";
    }

    return (
      <div 
        className="mt-2 p-4 rounded-[20px] border border-white/30 transition-all duration-300 relative group flex flex-col justify-between min-h-[120px] hover:scale-[1.02]"
        style={{
          background: 'rgba(255, 255, 255, 0.36)',
          backdropFilter: 'blur(21px)',
          WebkitBackdropFilter: 'blur(21px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 34px 17px rgba(255, 255, 255, 0.07)'
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-white/80 via-transparent to-white/30"></div>
        
        <div>
            <div className="flex justify-between items-center mb-3">
                <span className={`font-bold text-sm tracking-tight ${textColor}`}>
                    {fmtStart(session)} - {fmtEnd(session)}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm ${status === 'open' ? 'bg-emerald-100/80 text-emerald-700 border-emerald-300/60' : 'bg-slate-100/80 text-slate-600 border-slate-300/60'}`}>
                    {session.nbSurveillantsInscrits ?? 0}/{session.nbSurveillantsNecessaires ?? 0}
                </span>
            </div>
            
            <div className={`text-xs font-semibold leading-relaxed mb-3 line-clamp-2 ${status === 'conflict' || status === 'overlap' ? 'text-red-800' : 'text-slate-800'}`}>
                {(session.epreuves || []).map(e => e.matiere?.nom || e.nom).join(', ') || 'Unknown Subject'}
            </div>
        </div>

        <button
          onClick={() => status === 'open' && handleWish(session.id)}
          disabled={status !== 'open'}
          className={btnClass}
        >
          {status === 'open' ? '+ Submit Wish' : (status === 'full' ? 'Fully Booked' : 'Unavailable')}
        </button>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-slate-100 via-indigo-50 to-purple-50 text-slate-800 font-sans overflow-hidden">
      
      {/* Enhanced Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-200/40 via-purple-100/30 to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-cyan-200/40 via-blue-100/30 to-transparent"></div>
        
        {/* Animated Glow Orbs */}
        <div className="absolute top-[-15%] left-[-10%] h-[600px] w-[600px] rounded-full bg-gradient-to-br from-indigo-300/30 to-purple-400/30 blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] h-[700px] w-[700px] rounded-full bg-gradient-to-tl from-cyan-300/25 to-blue-400/25 blur-[140px] animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-[40%] right-[20%] h-[400px] w-[400px] rounded-full bg-gradient-to-br from-pink-200/20 to-rose-300/20 blur-[120px] animate-pulse" style={{animationDelay: '2s'}}></div>
        
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{backgroundImage: 'repeating-linear-gradient(0deg, #000 0px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #000 0px, transparent 1px, transparent 40px)'}}></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-6 lg:p-10">
        
        {/* Header */}
        <header 
          className="mb-10 flex flex-col gap-6 rounded-[20px] border border-white/30 p-8 transition-all duration-300 md:flex-row md:justify-between md:items-end relative overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.36)',
            backdropFilter: 'blur(21px)',
            WebkitBackdropFilter: 'blur(21px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 34px 17px rgba(255, 255, 255, 0.07)'
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
          <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-white/80 via-transparent to-white/30"></div>
          
          <div>
            <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900">
              Teacher Dashboard
            </h1>
            <p className="mt-3 text-slate-800 font-semibold text-lg">
              Browse the session calendar and submit your wishes
            </p>
          </div>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-5 rounded-full border border-white/50 bg-white/40 px-6 py-3 backdrop-blur-xl shadow-lg">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm"></div> Conflict
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-500 shadow-sm"></div> Full
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700">
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-sm"></div> Available
              </div>
            </div>

            <button
              onClick={() => navigate("/final-calendar")}
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-7 py-3 font-bold text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 backdrop-blur-sm"
            >
              View Final Calendar
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          
          <div className="space-y-6 lg:col-span-3">
            {message && <Alert type={message.type} text={message.text} />}
            {user && <UserStatsCard user={user} teacherData={teacherData} />}
          </div>

          <div className="lg:col-span-9">
            <div 
              className="rounded-[20px] border border-white/30 transition-all duration-300 relative overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.36)',
                backdropFilter: 'blur(21px)',
                WebkitBackdropFilter: 'blur(21px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 34px 17px rgba(255, 255, 255, 0.07)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>
              <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-white/80 via-transparent to-white/30"></div>
              
              <div className="flex items-center justify-between border-b border-white/40 bg-white/20 p-7 backdrop-blur-xl rounded-t-[20px]">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400/40 to-purple-400/40 shadow-lg backdrop-blur-sm">
                    <span className="text-2xl">🗓️</span>
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
                <div className="overflow-x-auto pb-2 scrollbar-hide">

                  <div className="min-w-[1000px] p-6">

                    <div className="grid gap-[2px] rounded-2xl border border-white/50 bg-white/20 shadow-inner overflow-hidden"
                      style={{ gridTemplateColumns: `90px repeat(${calendarDates.length}, minmax(170px, 1fr))` }}>
                      
                      <div className="sticky left-0 z-30 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4 text-xs font-black uppercase tracking-widest text-white shadow-lg">
                        Time
                      </div>

                      {calendarDates.map(date => (
                        <div key={date} className="flex flex-col items-center justify-center bg-white/40 backdrop-blur-xl p-4 border-r border-white/30">
                          <div className="text-[11px] font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">
                            {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="mt-1.5 text-lg font-black text-slate-900">
                            {new Date(date).getDate()}
                          </div>
                        </div>
                      ))}

                      {calendarHours.map(hour => (
                        <React.Fragment key={hour}>
                          <div className="sticky left-0 z-20 flex items-start justify-center bg-gradient-to-br from-slate-700 to-slate-800 p-3 pt-5 text-sm font-black text-white shadow-md border-b border-slate-600/30">
                            {hour}:00
                          </div>

                          {calendarDates.map(date => {
                            const sessions = getSessionsForCell(date, hour);
                            return (
                              <div key={`${date}-${hour}`} className="relative min-h-[150px] p-2 bg-white/20 backdrop-blur-md border-r border-b border-white/30">
                                {sessions.length > 0 ? (
                                  sessions.map(s => <SessionCard key={s.id} session={s} />)
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400/40"></div>
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