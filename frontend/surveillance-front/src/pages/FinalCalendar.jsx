import React, { useState, useEffect, useRef } from "react";
import { Calendar, Clock, Printer, Download, RefreshCw, BookOpen, X } from "lucide-react";
import ExamService from "../services/ExamService";
import { useAuth } from "../context/AuthContext";

// -------------------------------------------------------
// Helper Functions
// -------------------------------------------------------

const parseDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  
  let dateObj;
  if (typeof dateStr === 'string') {
    dateObj = new Date(dateStr + 'T00:00:00');
  } else {
    dateObj = new Date(dateStr);
  }
  
  if (isNaN(dateObj.getTime())) return null;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  dateObj.setHours(hours || 0);
  dateObj.setMinutes(minutes || 0);
  dateObj.setSeconds(0);
  dateObj.setMilliseconds(0);
  return dateObj;
};

const formatDate = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  return formatDate(d1) === formatDate(d2);
};

// -------------------------------------------------------
// Event Cell Component (Updated with Cancel Button)
// -------------------------------------------------------

const EventCell = ({ event, onCancel, isCancelling }) => {
  if (!event) return null;

  return (
    <div className="absolute inset-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-2 shadow-lg border-2 border-indigo-300 overflow-hidden hover:scale-105 transition-transform duration-200 group">
      <div className="text-white text-xs font-bold truncate flex items-center gap-1">
        <BookOpen size={12} className="flex-shrink-0" />
        <span className="truncate">{event.title}</span>
      </div>
      <div className="text-indigo-100 text-[10px] font-semibold mt-1">
        {event.timeRange}
      </div>
      
      {/* NEW: Cancel Button - Appears on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel(event);
        }}
        disabled={isCancelling}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        title="Cancel this assignment"
      >
        {isCancelling ? (
          <div className="animate-spin rounded-full h-3 w-3 border-b border-white" />
        ) : (
          <X size={12} />
        )}
      </button>
    </div>
  );
};

// -------------------------------------------------------
// Main Component
// -------------------------------------------------------

export default function FinalCalendar() {
  const { user, refreshUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null); // NEW: Track which event is being cancelled
  const [message, setMessage] = useState(null); // NEW: Show success/error messages
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const scrollRef = useRef(null);

  // Hours range: 8 AM to 5 PM
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  // -------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------
  const fetchData = async () => {
    if (!user?.id_user) {
      setLoading(false);
      return;
    }

    try {
      const res = await ExamService.getEnseignantByUserId(user.id_user);
      const teacherData = res.data;

      if (!teacherData?.affectations || teacherData.affectations.length === 0) {
        setEvents([]);
        return;
      }

      const mappedEvents = teacherData.affectations
        .map((a) => {
          const se = a.seance;
          if (!se) return null;

          const dateStr = se.date || se.date_seance || se.dateSeance;
          const startStr = se.heureDebut || se.heure_debut || se.start;
          const endStr = se.heureFin || se.heure_fin || se.end;

          const start = parseDateTime(dateStr, startStr);
          const end = parseDateTime(dateStr, endStr);

          if (!start || !end) return null;

          const duration = (end - start) / (1000 * 60);

          const titleText = (se.epreuves || [])
            .map((ev) => ev.nom || ev.matiere?.nom)
            .filter(Boolean)
            .join(', ');

          return {
            id: a.id,
            seanceId: se.id, // NEW: Store seance ID for cancellation
            title: titleText || "Exam Session",
            startDate: start,
            endDate: end,
            date: formatDate(start),
            startHour: start.getHours(),
            startMinute: start.getMinutes(),
            durationMinutes: duration,
            timeRange: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
          };
        })
        .filter(Boolean);

      mappedEvents.sort((a, b) => a.startDate - b.startDate);
      setEvents(mappedEvents);

    } catch (err) {
      console.error("Error fetching calendar:", err);
      setEvents([]);
    }
  };

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };

    loadInitialData();
  }, [user?.id_user]);

  // Refresh when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id_user) {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id_user]);

  // Manual refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage(null);
    await refreshUser();
    await fetchData();
    setRefreshing(false);
    setLastUpdate(Date.now());
  };

  // -------------------------------------------------------
  // NEW: Cancel Event Handler
  // -------------------------------------------------------
  /**
   * Handle cancellation of an assignment
   * 
   * This function:
   * 1. Calls the backend cancelVoeu endpoint
   * 2. Refreshes the user context
   * 3. Reloads the calendar data
   * 4. Shows success/error message
   * 
   * @param {Object} event - The event object to cancel
   */
  const handleCancelEvent = async (event) => {
    if (!user?.enseignantDTO?.id || !event.seanceId) {
      setMessage({ type: 'error', text: 'Unable to cancel: missing teacher or session ID' });
      return;
    }

    setCancellingId(event.id);
    setMessage(null);

    try {
      const res = await ExamService.cancelVoeu(user.enseignantDTO.id, event.seanceId);

      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        
        // Refresh user context to update stored data
        await refreshUser();
        
        // Reload calendar to show updated assignments
        await fetchData();
        
        setLastUpdate(Date.now());
      } else {
        setMessage({ type: 'error', text: res.data.message });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to cancel assignment.';
      setMessage({ type: 'error', text: errorMsg });
      console.error('Cancel error:', err);
    } finally {
      setCancellingId(null);
    }
  };

  // -------------------------------------------------------
  // Generate unique dates from events
  // -------------------------------------------------------
  const dateColumns = React.useMemo(() => {
    if (events.length === 0) return [];

    const uniqueDates = new Set();
    events.forEach(event => {
      uniqueDates.add(event.date);
    });

    return Array.from(uniqueDates)
      .sort()
      .map(dateStr => new Date(dateStr + 'T00:00:00'));
  }, [events]);

  // -------------------------------------------------------
  // Get event for specific date and hour
  // -------------------------------------------------------
  const getEventForCell = (date, hour) => {
    const dateStr = formatDate(date);
    return events.find(e => e.date === dateStr && e.startHour === hour);
  };

  // -------------------------------------------------------
  // Statistics
  // -------------------------------------------------------
  const stats = React.useMemo(() => {
    if (events.length === 0) return null;

    const totalHours = events.reduce((sum, e) => sum + (e.durationMinutes / 60), 0);
    const dates = events.map(e => e.startDate);
    const earliestDate = new Date(Math.min(...dates));
    const latestDate = new Date(Math.max(...dates));

    return {
      totalSessions: events.length,
      totalHours: Math.round(totalHours * 10) / 10,
      startDate: earliestDate,
      endDate: latestDate,
      daysWithSessions: dateColumns.length,
    };
  }, [events, dateColumns]);

  // -------------------------------------------------------
  // Print & Download Functions
  // -------------------------------------------------------
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const calendarData = {
      teacherName: user?.nomComplet || 'Unknown Teacher',
      generatedDate: new Date().toISOString(),
      lastUpdate: new Date(lastUpdate).toISOString(),
      statistics: stats,
      assignments: events.map(e => ({
        title: e.title,
        date: e.startDate.toLocaleDateString(),
        time: e.timeRange,
        duration: `${Math.round(e.durationMinutes / 60 * 10) / 10} hours`,
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(calendarData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `surveillance_calendar_${user?.nomComplet || 'teacher'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <>
      <style>{`
        /* Print Styles - Force Everything on One Page */
        @media print {
          @page {
            size: landscape;
            margin: 0.3cm;
          }
          
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          
          body * {
            visibility: hidden;
          }
          
          #printable-calendar,
          #printable-calendar * {
            visibility: visible;
          }
          
          #printable-calendar {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100vh;
            background: white;
            display: flex;
            flex-direction: column;
            page-break-inside: avoid;
            page-break-after: avoid;
            page-break-before: avoid;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-header {
            display: block !important;
            page-break-after: avoid;
            flex-shrink: 0;
            margin-bottom: 0.3cm;
            padding-bottom: 0.2cm;
          }
          
          .print-header h1 {
            font-size: 16px !important;
            margin-bottom: 0.1cm !important;
          }
          
          .print-header p,
          .print-header div {
            font-size: 10px !important;
            margin: 0 !important;
          }
          
          .calendar-print-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            page-break-inside: avoid;
          }
          
          * {
            overflow: visible !important;
            scrollbar-width: none;
          }
          
          *::-webkit-scrollbar {
            display: none;
          }
          
          table {
            width: 100% !important;
            height: auto !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          
          thead, tbody, tr, th, td {
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          
          table {
            font-size: 7px !important;
          }
          
          th {
            padding: 0.1cm !important;
            font-size: 7px !important;
          }
          
          th > div {
            font-size: 6px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
          }
          
          th > div.text-xl {
            font-size: 10px !important;
          }
          
          td {
            padding: 0.05cm !important;
            height: auto !important;
            min-height: 0.8cm !important;
            max-height: 1.2cm !important;
          }
          
          .event-cell-print {
            font-size: 6px !important;
            padding: 0.05cm !important;
            border-radius: 2px !important;
          }
          
          .event-cell-print svg {
            width: 8px !important;
            height: 8px !important;
          }
          
          /* Hide cancel buttons in print */
          .event-cell-print button {
            display: none !important;
          }
          
          * {
            box-shadow: none !important;
            transition: none !important;
            animation: none !important;
            transform: none !important;
          }
          
          table, th, td {
            border-width: 0.5pt !important;
          }
          
          .sticky {
            position: relative !important;
          }
          
          .bg-gradient-to-br,
          .bg-indigo-600,
          .bg-purple-600,
          .bg-slate-600,
          .bg-slate-700 {
            background: #4a5568 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .from-indigo-500 {
            background: #6366f1 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        
        {/* Header - Hidden in print */}
        <header className="bg-white border-b border-slate-200 shadow-sm no-print sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg">
                  <Calendar className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Surveillance Calendar</h1>
                  <p className="text-sm text-slate-600">
                    {user?.nomComplet || 'Teacher'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-2 transition-colors border border-indigo-200 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg flex items-center gap-2 transition-colors border border-green-200"
                >
                  <Printer size={16} /> Print
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-2 transition-colors border border-blue-200"
                >
                  <Download size={16} /> Export
                </button>
              </div>
            </div>

            {/* NEW: Message Display */}
            {message && (
              <div className={`p-3 rounded-lg mb-2 ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            {/* Statistics - Hidden in print */}
            {!loading && stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-indigo-50 rounded-lg p-2.5 border border-indigo-200">
                  <div className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide">Sessions</div>
                  <div className="text-xl font-bold text-indigo-900 mt-0.5">{stats.totalSessions}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-2.5 border border-purple-200">
                  <div className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide">Hours</div>
                  <div className="text-xl font-bold text-purple-900 mt-0.5">{stats.totalHours}h</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-200">
                  <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">Days</div>
                  <div className="text-xl font-bold text-blue-900 mt-0.5">{stats.daysWithSessions}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200 col-span-2">
                  <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Period</div>
                  <div className="text-sm font-bold text-emerald-900 mt-0.5">
                    {stats.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {stats.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          
          {/* Print Container */}
          <div id="printable-calendar">
            {/* Print Header - Only visible when printing */}
            <div className="hidden print-header">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Surveillance Calendar</h1>
              <div className="flex justify-between items-center text-sm">
                <div>
                  <p className="font-semibold">Teacher: {user?.nomComplet || 'N/A'}</p>
                  <p className="text-slate-600">Generated: {new Date().toLocaleDateString()}</p>
                </div>
                {stats && (
                  <div className="text-right">
                    <p className="font-semibold">Sessions: {stats.totalSessions} • Hours: {stats.totalHours}h</p>
                    <p className="text-slate-600">
                      {stats.startDate.toLocaleDateString()} - {stats.endDate.toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="text-center">
                  <div className="mb-4 h-16 w-16 mx-auto rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                  <p className="text-xl font-bold text-slate-800">Loading calendar...</p>
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center py-32">
                <div className="text-center">
                  <div className="bg-slate-100 rounded-full p-8 inline-block mb-6">
                    <Calendar size={64} className="text-slate-400" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mb-2">No Surveillance Sessions</p>
                  <p className="text-slate-600 mb-6">You have no surveillance assignments scheduled.</p>
                  <button
                    onClick={handleRefresh}
                    className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all shadow-lg"
                  >
                    Check for Updates
                  </button>
                </div>
              </div>
            ) : (
              <div className="calendar-print-container bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                {/* Calendar Table */}
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {/* Time column header */}
                        <th className="sticky left-0 z-20 bg-gradient-to-br from-slate-700 to-slate-600 text-white font-bold text-sm p-3 border-r-2 border-slate-400 min-w-[80px]">
                          Time
                        </th>
                        
                        {/* Date column headers */}
                        {dateColumns.map((date, idx) => {
                          const isToday = isSameDay(date, new Date());
                          return (
                            <th
                              key={idx}
                              className={`${
                                isToday 
                                  ? 'bg-gradient-to-br from-indigo-600 to-purple-600' 
                                  : 'bg-gradient-to-br from-slate-600 to-slate-500'
                              } text-white text-center p-3 border-r border-slate-300 min-w-[140px]`}
                            >
                              <div className="text-xs font-semibold uppercase tracking-wider">
                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                              </div>
                              <div className="text-xl font-bold mt-1">
                                {date.getDate()}
                              </div>
                              <div className="text-xs opacity-90 mt-1">
                                {date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    
                    <tbody>
                      {hours.map((hour) => (
                        <tr key={hour} className="border-b border-slate-200">
                          {/* Hour label */}
                          <td className="sticky left-0 z-10 bg-slate-100 text-slate-700 font-bold text-center p-3 border-r-2 border-slate-300">
                            <div className="text-sm">
                              {hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                            </div>
                          </td>
                          
                          {/* Date cells */}
                          {dateColumns.map((date, idx) => {
                            const event = getEventForCell(date, hour);
                            const isToday = isSameDay(date, new Date());
                            const isCurrentHour = isToday && new Date().getHours() === hour;
                            
                            return (
                              <td
                                key={idx}
                                className={`relative p-1 border-r border-slate-200 h-20 ${
                                  isCurrentHour ? 'bg-yellow-50' : 'bg-white'
                                }`}
                              >
                                {event ? (
                                  <EventCell 
                                    event={event} 
                                    onCancel={handleCancelEvent}
                                    isCancelling={cancellingId === event.id}
                                  />
                                ) : (
                                  <div className="h-full"></div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}