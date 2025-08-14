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

  // Fetch events on mount and when month changes
  useEffect(() => {
    fetch(`${BASE_URL}/api/calendar?userId=${defaultUserId}`)
      .then(res => res.json())
      .then((evts: CalendarEvent[]) => {
        setEvents(evts);
        setData && setData((prev: any) => ({ ...prev, calendar: evts }));
      });
  }, [setData, currentMonth]);

  // Listen for WebSocket updates (if available)
  useEffect(() => {
    if (window.socket) {
      window.socket.on('dashboard-update', (d: any) => {
        if (d.calendar) setEvents(d.calendar);
      });
    }
    return () => {
      if (window.socket) window.socket.off('dashboard-update');
    };
  }, []);

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
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  (events || []).forEach(evt => {
    if (evt && typeof evt === 'object' && typeof evt.start_time === 'string') {
      const key = evt.start_time.slice(0, 10);
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push(evt);
    }
  });

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
      const res = await fetch(`${BASE_URL}/api/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to add event');
      closeModal();
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-lg font-semibold text-white">Calendar</h2>
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
      <div className="grid grid-cols-7 gap-2 text-xs mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-gray-400 text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {monthDays.map((date, idx) => {
          const key = date.toISOString().slice(0, 10);
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isToday = key === new Date().toISOString().slice(0, 10);
          const dayEvents = eventsByDate[key] || [];
          return (
            <div
              key={key + idx}
              className={`rounded-lg p-2 min-h-[70px] cursor-pointer border transition-colors flex flex-col bg-gray-700/80 ${isCurrentMonth ? 'border-gray-600' : 'border-gray-800 opacity-60'} ${isToday ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => isCurrentMonth && openModal(date)}
            >
              <div className={`font-bold text-sm mb-1 ${isCurrentMonth ? 'text-white' : 'text-gray-500'}`}>{date.getDate()}</div>
              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, 2).map(evt => (
                  <div key={evt.id} className="truncate text-xs bg-blue-900/60 text-blue-200 rounded px-1 py-0.5">
                    {evt.title}
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
            <h3 className="text-lg font-semibold text-white mb-4">Add Event for {selectedDate.toLocaleDateString()}</h3>
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
                  Add Event
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
  );
}

