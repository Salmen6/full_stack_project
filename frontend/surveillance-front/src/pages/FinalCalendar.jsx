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

// -------------------------------------------------------
// Sub-Components
// -------------------------------------------------------

const EventCard = ({ event }) => {
  const topPosition = (event.startMinute / 60) * 100;
  const height = (event.durationMinutes / 60) * 64;

  return (
    <div
      className={`absolute left-2 right-2 p-2 rounded border-l-4 text-xs sm:text-sm cursor-pointer hover:brightness-95 transition-all shadow-sm z-10 ${event.color}`}
      style={{
        top: `${topPosition}%`,
        height: `${height}px`,
        minHeight: "40px",
      }}
    >
      <div className="font-semibold truncate leading-tight">{event.title}</div>
      <div className="flex items-center gap-1 opacity-90 truncate text-xs mt-0.5">
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const printRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 512 - 50;
  }, []);

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

        if (mappedEvents.length > 0) {
          setCurrentDate(mappedEvents[0].startDate);
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
  // Date Controls
  // -------------------------------------------------------

  const navigateDay = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleDateInput = (e) => {
    const d = new Date(e.target.value);
    if (!isNaN(d.getTime())) {
      setCurrentDate(d);
    }
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

  const isToday = isSameDay(currentDate, new Date());
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const todaysEvents = events.filter((e) => isSameDay(e.startDate, currentDate));

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

      <div className="flex flex-col h-screen bg-white text-gray-800 font-sans max-w-4xl mx-auto shadow-2xl overflow-hidden border-x border-gray-200">

        {/* Header */}
        <header className="flex-none bg-white border-b border-gray-200 p-4 sticky top-0 z-30 no-print">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">📅 My Surveillance Calendar</h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrint} 
                className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-md flex items-center gap-1"
                title="Print Calendar"
              >
                <Printer size={16} /> Print
              </button>
              <button 
                onClick={handleDownload} 
                className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md flex items-center gap-1"
                title="Download as JSON"
              >
                <Download size={16} /> Save
              </button>
              <button 
                onClick={goToToday} 
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md"
              >
                Today
              </button>
              <div className="flex bg-gray-100 rounded-md p-0.5">
                <button onClick={() => navigateDay(-1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-600">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={() => navigateDay(1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-600">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className={`text-4xl font-bold ${isToday ? "text-indigo-600" : "text-gray-800"}`}>
                {currentDate.getDate()}
              </span>
              <span className="text-gray-500 font-medium uppercase tracking-wide text-sm">
                {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", year: "numeric" })}
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors relative">
              <CalendarIcon size={16} />
              <span>Jump to Date</span>
              <input
                type="date"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleDateInput}
                value={currentDate.toLocaleDateString('en-CA')}
              />
            </label>
          </div>
        </header>

        {/* Body */}
        <div ref={scrollRef} id="printable-calendar" className="flex-1 overflow-y-auto relative scroll-smooth">
          
          {/* Print Header - Only visible when printing */}
          <div className="hidden print:block p-4 border-b border-gray-200 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Surveillance Calendar</h1>
            <p className="text-sm text-gray-600">Teacher: {user?.nomComplet || 'N/A'}</p>
            <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="border-b border-gray-100 p-2 flex text-xs text-gray-500">
            <div className="w-16 text-right pr-4 font-medium pt-1">All Day</div>
            <div className="flex-1 min-h-[2rem]">
              {loading ? (
                <span className="text-gray-400">Loading...</span>
              ) : todaysEvents.length === 0 ? (
                <span className="text-gray-400 italic">No assignments today</span>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-[1440px]">
            {getHoursArray().map((hour) => (
              <div key={hour} className="flex group h-16 relative">
                <div className="w-16 flex-none border-r border-gray-100 text-right pr-3 -mt-2.5 bg-white z-10 select-none">
                  <span className="text-xs font-medium text-gray-400 block">
                    {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                  </span>
                </div>
                <div className="flex-1 relative border-b border-gray-100 border-dashed">
                  {isToday && hour === currentHour && (
                    <div 
                      className="absolute left-0 right-0 border-t-2 border-red-500 z-20 flex items-center pointer-events-none no-print" 
                      style={{ top: `${(currentMinute / 60) * 100}%` }}
                    >
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5"></div>
                    </div>
                  )}
                  {todaysEvents.filter((event) => event.startHour === hour).map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Section - Visible on print */}
        {events.length > 0 && (
          <div className="hidden print:block p-4 border-t border-gray-200 mt-4">
            <h2 className="text-lg font-bold mb-2">Assignment Summary</h2>
            <ul className="text-sm space-y-1">
              {events.map((event, idx) => (
                <li key={idx}>
                  <strong>{event.startDate.toLocaleDateString()}</strong> - {event.timeRange}: {event.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}