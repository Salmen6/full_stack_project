import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Printer, Download } from "lucide-react";
import ExamService from "../services/ExamService";
import { useAuth } from "../context/AuthContext";

// -------------------------------------------------------
// Helper Functions
// -------------------------------------------------------

const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const getHoursArray = () => Array.from({ length: 24 }, (_, i) => i);

const parseDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const dateObj = new Date(dateStr);
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
  return date.toISOString().split('T')[0];
};

// -------------------------------------------------------
// Sub-Components
// -------------------------------------------------------

/**
 * EventCard - Displays a single event within a time slot
 * Positioned absolutely within its time cell based on start time and duration
 */
const EventCard = ({ event }) => {
  // Calculate position within the hour cell (0-100%)
  const topPosition = (event.startMinute / 60) * 100;
  // Calculate height based on duration (each hour = 80px)
  const height = Math.max((event.durationMinutes / 60) * 80, 40);

  return (
    <div
      className={`absolute left-1 right-1 p-2 rounded-lg border-l-4 text-xs cursor-pointer hover:brightness-95 transition-all shadow-sm z-10 ${event.color}`}
      style={{
        top: `${topPosition}%`,
        height: `${height}px`,
        minHeight: "40px",
      }}
      title={`${event.title}\n${event.timeRange}`}
    >
      <div className="font-semibold truncate leading-tight text-xs">{event.title}</div>
      <div className="flex items-center gap-1 opacity-90 truncate text-[10px] mt-0.5">
        <Clock size={10} />
        {event.timeRange}
      </div>
    </div>
  );
};

// -------------------------------------------------------
// Main Component
// -------------------------------------------------------

export default function FinalCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const scrollRef = useRef(null);

  // Scroll to 8 AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      // 8 hours * 80px per hour = 640px
      scrollRef.current.scrollTop = 640 - 100;
    }
  }, [loading]);

  // -------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------
  useEffect(() => {
    if (!user?.id_user) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await ExamService.getEnseignantByUserId(user.id_user);
        const teacherData = res.data;

        if (!teacherData?.affectations || teacherData.affectations.length === 0) {
          setEvents([]);
          setLoading(false);
          return;
        }

        // Map affectations to event objects
        const mappedEvents = teacherData.affectations.map((a) => {
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
            .map((ev) => ev.nom)
            .filter(Boolean)
            .join(', ');

          return {
            id: a.id,
            title: titleText || "Exam Session",
            startDate: start,
            endDate: end,
            startHour: start.getHours(),
            startMinute: start.getMinutes(),
            durationMinutes: duration,
            color: "bg-indigo-100 border-indigo-500 text-indigo-700",
            timeRange: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")} - ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
          };
        }).filter(Boolean);

        setEvents(mappedEvents);

        // Calculate date range from events
        if (mappedEvents.length > 0) {
          const dates = mappedEvents.map(e => e.startDate).sort((a, b) => a - b);
          setDateRange({
            start: dates[0],
            end: dates[dates.length - 1]
          });
        }

      } catch (err) {
        console.error("Error fetching calendar:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // -------------------------------------------------------
  // Generate Date Array
  // -------------------------------------------------------
  const dateColumns = React.useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];

    const dates = [];
    const current = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [dateRange]);

  // -------------------------------------------------------
  // Get Events for Specific Date and Hour
  // -------------------------------------------------------
  const getEventsForCell = (date, hour) => {
    const dateStr = formatDate(date);
    return events.filter(e => {
      const eventDateStr = formatDate(e.startDate);
      return eventDateStr === dateStr && e.startHour === hour;
    });
  };

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
      assignments: events.map(e => ({
        title: e.title,
        date: e.startDate.toLocaleDateString(),
        time: e.timeRange,
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(calendarData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `calendar_${user?.nomComplet || 'teacher'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const hoursArray = getHoursArray();

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-calendar, #printable-calendar * {
            visibility: visible;
          }
          #printable-calendar {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-indigo-50 text-gray-800 font-sans">

        {/* Header */}
        <header className="flex-none bg-white border-b border-gray-200 p-4 shadow-sm no-print">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarIcon className="text-indigo-600" size={28} />
                My Surveillance Calendar
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg flex items-center gap-2 transition-colors border border-green-200"
                  title="Print Calendar"
                >
                  <Printer size={16} /> Print
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-2 transition-colors border border-blue-200"
                  title="Download as JSON"
                >
                  <Download size={16} /> Download
                </button>
              </div>
            </div>

            {!loading && events.length > 0 && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Period:</span> {dateRange.start?.toLocaleDateString()} - {dateRange.end?.toLocaleDateString()}
                <span className="ml-4 font-medium">Total Assignments:</span> {events.length}
              </div>
            )}
          </div>
        </header>

        {/* Calendar Body */}
        <div ref={scrollRef} id="printable-calendar" className="flex-1 overflow-auto bg-white">
          <div className="max-w-7xl mx-auto p-4">

            {/* Print Header - Only visible when printing */}
            <div className="hidden print:block mb-4 pb-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Surveillance Calendar</h1>
              <p className="text-sm text-gray-600">Teacher: {user?.nomComplet || 'N/A'}</p>
              <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
              {dateRange.start && (
                <p className="text-sm text-gray-600">
                  Period: {dateRange.start.toLocaleDateString()} - {dateRange.end?.toLocaleDateString()}
                </p>
              )}
            </div>

            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 h-12 w-12 mx-auto rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                  <p className="text-lg font-bold text-gray-800">Loading calendar...</p>
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="flex h-96 items-center justify-center">
                <div className="text-center text-gray-500">
                  <CalendarIcon size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">No assignments found</p>
                  <p className="text-sm mt-1">You have no surveillance sessions assigned yet.</p>
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {/* Calendar Grid */}
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full">
                    <div className="grid" style={{ gridTemplateColumns: `80px repeat(${dateColumns.length}, 120px)` }}>
                      
                      {/* Header Row - Time Label */}
                      <div className="sticky top-0 left-0 z-30 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider p-3 border-r border-indigo-500 flex items-center justify-center">
                        Time
                      </div>

                      {/* Header Row - Dates */}
                      {dateColumns.map((date, idx) => {
                        const isToday = isSameDay(date, new Date());
                        return (
                          <div
                            key={idx}
                            className={`sticky top-0 z-20 p-3 border-r border-b border-gray-200 text-center ${
                              isToday ? 'bg-indigo-100 text-indigo-900 font-bold' : 'bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div className="text-xs font-semibold uppercase tracking-wide">
                              {date.toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                            <div className={`text-lg font-bold mt-1 ${isToday ? 'text-indigo-600' : ''}`}>
                              {date.getDate()}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {date.toLocaleDateString('en-US', { month: 'short' })}
                            </div>
                          </div>
                        );
                      })}

                      {/* Time Rows */}
                      {hoursArray.map((hour) => (
                        <React.Fragment key={hour}>
                          {/* Hour Label */}
                          <div className="sticky left-0 z-10 bg-gray-100 text-gray-700 text-xs font-semibold p-2 border-r border-b border-gray-200 text-center">
                            <div className="leading-tight">
                              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                            </div>
                          </div>

                          {/* Date Cells for this Hour */}
                          {dateColumns.map((date, idx) => {
                            const cellEvents = getEventsForCell(date, hour);
                            const isToday = isSameDay(date, new Date());
                            const isCurrentHour = isToday && new Date().getHours() === hour;

                            return (
                              <div
                                key={idx}
                                className={`relative border-r border-b border-gray-200 min-h-[80px] ${
                                  isCurrentHour ? 'bg-yellow-50' : 'bg-white'
                                } hover:bg-gray-50 transition-colors`}
                              >
                                {/* Current time indicator */}
                                {isCurrentHour && (
                                  <div
                                    className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                                    style={{ top: `${(new Date().getMinutes() / 60) * 100}%` }}
                                  >
                                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1 -mt-1"></div>
                                  </div>
                                )}

                                {/* Events */}
                                {cellEvents.map((event) => (
                                  <EventCard key={event.id} event={event} />
                                ))}

                                {/* Empty state indicator */}
                                {cellEvents.length === 0 && (
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-20 transition-opacity">
                                    <div className="w-1 h-1 rounded-full bg-gray-300"></div>
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
              </div>
            )}

            {/* Summary Section - Visible on print */}
            {events.length > 0 && (
              <div className="hidden print:block mt-6 pt-4 border-t border-gray-200">
                <h2 className="text-lg font-bold mb-3">Assignment Summary</h2>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {events.map((event, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-100">
                      <div>
                        <span className="font-semibold">{event.startDate.toLocaleDateString()}</span>
                        <span className="mx-2">•</span>
                        <span>{event.timeRange}</span>
                      </div>
                      <span className="text-gray-600">{event.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}