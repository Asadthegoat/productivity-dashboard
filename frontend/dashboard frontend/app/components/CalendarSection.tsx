import React, { useContext, useEffect, useState } from 'react';
import { DashboardContext, DashboardContextType } from '../context/DashboardContext';
import { X } from "lucide-react";


// Extend window type for socket.io
declare global {
  interface Window {
    socket?: {
      on: (event: string, cb: (data: any) => void) => void;
      off: (event: string) => void;
    };
  }
}



const BASE_URL = "https://productivity-dashboard-218x.onrender.com";
const defaultUserId = 1;

function formatDateTimeLocal(dt: string | Date | undefined): string {
  // Converts ISO string to yyyy-MM-ddTHH:mm for input[type="datetime-local"]
  if (!dt) return '';
  const d = new Date(dt);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
}

export default function CalendarSection() {
  const { data, setData } = useContext(DashboardContext) as DashboardContextType;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    all_day: false,
    start_time: '',
    end_time: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Fetch events on mount and when month changes
  useEffect(() => {
    fetch(`${BASE_URL}/api/dashboard-data?userId=${defaultUserId}`)
      .then(res => res.json())
      .then((dashboard: any) => {
        setEvents(dashboard.calendar || []);
        setData && setData((prev: any) => ({ ...prev, calendar: dashboard.calendar || [] }));
      });
  }, [setData, currentMonth]);

  // Listen for WebSocket updates (if available)
  useEffect(() => {
    if (window.socket) {
      window.socket.on('dashboard-update', (d: any) => {
        if (d.calendar) {
          setEvents(d.calendar);
          setData && setData((prev: any) => ({ ...prev, calendar: d.calendar }));
        }
      });
    }
    return () => {
      if (window.socket) window.socket.off('dashboard-update');
    };
  }, [setData]);

  // Calendar helpers
  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    // Fill leading days from previous month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(new Date(year, month, i - firstDay.getDay() + 1));
    }
    // Fill current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    // Fill trailing days from next month
    while (days.length % 7 !== 0) {
      days.push(new Date(year, month + 1, days.length - lastDay.getDate() + 1));
    }
    return days;
  };

  const monthDays = getMonthDays(currentMonth);
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Group events by date (YYYY-MM-DD), filter out invalid events
  console.log('Fetched events from backend:', events);
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  (events || []).forEach(evt => {
    if (evt && typeof evt === 'object' && typeof evt.start_time === 'string') {
      // Always use the date part as in backend (YYYY-MM-DD)
      const key = evt.start_time.slice(0, 10);
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push(evt);
    }
  });
  console.log('Grouped eventsByDate:', eventsByDate);

  // Helper to get local date string in YYYY-MM-DD
  const getLocalDateString = (date: Date) => {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  };

  // Modal handlers
  const openModal = (date: Date) => {
    setSelectedDate(date);
    setForm({ title: '', description: '', all_day: false, start_time: '', end_time: '' });
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setSelectedDate(null);
    setError('');
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(new Date(event.start_time));
    setForm({
      title: event.title,
      description: event.description || '',
      all_day: event.all_day,
      start_time: '',
      end_time: event.end_time ? new Date(event.end_time).toTimeString().slice(0, 5) : '',
    });
    setShowModal(true);
  };

  const handleDeleteEvent = async (eventId: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/calendar/${eventId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: defaultUserId })
      });
      if (!res.ok) throw new Error('Failed to delete event');
      
      // Re-fetch dashboard data to update events immediately
      const dashboardRes = await fetch(`${BASE_URL}/api/dashboard-data?userId=${defaultUserId}`);
      const dashboard = await dashboardRes.json();
      setEvents(dashboard.calendar || []);
      setData && setData((prev: any) => ({ ...prev, calendar: dashboard.calendar || [] }));
    } catch (err: any) {
      console.error('Error deleting event:', err);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let fieldValue: string | boolean = value;
    if (type === 'checkbox' && 'checked' in e.target) {
      fieldValue = (e.target as HTMLInputElement).checked;
    }
    setForm(f => ({ ...f, [name]: fieldValue }));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const start_time = selectedDate ? `${selectedDate.toISOString().slice(0, 10)}T00:00:00` : '';
      const body = {
        title: form.title,
        description: form.description,
        start_time,
        end_time: form.end_time ? `${selectedDate?.toISOString().slice(0, 10)}T${form.end_time}` : null,
        all_day: form.all_day,
        userId: defaultUserId
      };

      if (editingEvent) {
        // Update existing event
        const res = await fetch(`${BASE_URL}/api/calendar/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Failed to update event');
      } else {
        // Create new event
        const res = await fetch(`${BASE_URL}/api/calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Failed to add event');
      }

      // Re-fetch dashboard data to update events immediately
      const dashboardRes = await fetch(`${BASE_URL}/api/dashboard-data?userId=${defaultUserId}`);
      const dashboard = await dashboardRes.json();
      setEvents(dashboard.calendar || []);
      setData && setData((prev: any) => ({ ...prev, calendar: dashboard.calendar || [] }));
      closeModal();
      setEditingEvent(null);
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={() => setFullscreen(false)}>
          <div className="w-full max-w-6xl h-[90vh] bg-gray-900 rounded-xl p-8 shadow-2xl border border-gray-700 relative flex flex-col" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setFullscreen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl"
              aria-label="Close Fullscreen"
            >
              ×
            </button>
            {/* Calendar content in fullscreen */}
            {renderCalendar(true)}
          </div>
        </div>
      )}
      {/* Normal calendar card */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 mb-6 relative">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-lg font-semibold text-white">Calendar</h2>
          <button
            onClick={() => setFullscreen(true)}
            className="ml-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs border border-gray-600"
            aria-label="Expand Calendar Fullscreen"
          >
            ⛶ Full Screen
          </button>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
            >
              &lt;
            </button>
            <span className="text-white font-medium px-2">{monthName}</span>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
            >
              &gt;
            </button>
          </div>
        </div>
        {renderCalendar(false)}
        {/* Add Event Modal */}
        {showModal && selectedDate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 border border-gray-700 relative">
              <button
                onClick={closeModal}
                className="absolute top-3 right-3 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-semibold text-white mb-4">
                {editingEvent ? `Edit Event for ${selectedDate.toLocaleDateString()}` : `Add Event for ${selectedDate.toLocaleDateString()}`}
              </h3>
              <form onSubmit={handleAddEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleFormChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="all_day"
                    checked={form.all_day}
                    onChange={handleFormChange}
                    className="mr-2"
                  />
                  <span className="text-gray-300">All Day</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">End Time (optional)</label>
                  <input
                    name="end_time"
                    type="time"
                    value={form.end_time}
                    onChange={handleFormChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                {error && <div className="text-red-500 text-sm">{error}</div>}
                <div className="flex gap-3 mt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    {editingEvent ? 'Update Event' : 'Add Event'}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Helper to render the calendar grid, accepts a fullscreen flag for larger size
  function renderCalendar(isFullscreen: boolean) {
    return (
      <>
        <div className={`grid grid-cols-7 gap-2 text-xs mb-2 ${isFullscreen ? 'text-base' : ''}`}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-gray-400 text-center font-medium">{d}</div>
          ))}
        </div>
        <div className={`grid grid-cols-7 gap-2 ${isFullscreen ? 'text-base min-h-[120px]' : ''}`}>
          {monthDays.map((date, idx) => {
            const key = getLocalDateString(date);
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            const todayKey = getLocalDateString(new Date());
            const isToday = key === todayKey;
            const dayEvents = eventsByDate[key] || [];
            return (
              <div
                key={key + idx}
                className={`rounded-lg p-2 min-h-[70px] cursor-pointer border transition-colors flex flex-col bg-gray-700/80 ${isCurrentMonth ? 'border-gray-600' : 'border-gray-800 opacity-60'} ${isToday ? 'ring-2 ring-blue-500' : ''} ${isFullscreen ? 'min-h-[120px] text-base' : ''}`}
                onClick={() => isCurrentMonth && openModal(date)}
              >
                <div className={`font-bold text-sm mb-1 ${isCurrentMonth ? 'text-white' : 'text-gray-500'}`}>{date.getDate()}</div>
                <div className="flex flex-col gap-1">
                  {dayEvents.slice(0, 2).map(evt => (
                    <div 
                      key={evt.id} 
                      className="relative truncate text-xs bg-blue-900/60 text-blue-200 rounded px-1 py-0.5 hover:bg-blue-800/70 transition-colors cursor-pointer group"
                      onMouseEnter={() => setHoveredEvent(evt.id)}
                      onMouseLeave={() => setHoveredEvent(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditEvent(evt);
                      }}
                    >
                      {evt.title}
                      {hoveredEvent === evt.id && (
                        <div className="absolute top-0 right-0 flex bg-gray-900 border border-gray-600 rounded shadow-lg z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(evt);
                            }}
                            className="p-1 hover:bg-gray-700 rounded-l text-blue-400"
                            title="Edit event"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvent(evt.id);
                            }}
                            className="p-1 hover:bg-gray-700 rounded-r text-red-400"
                            title="Delete event"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-blue-300">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }
}

