import React, { useContext, useEffect, useState } from 'react';
import { DashboardContext, DashboardContextType } from '../context/DashboardContext';


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
  const [form, setForm] = useState<{
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    all_day: boolean;
    id: number | null;
    editing: boolean;
  }>({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    all_day: false,
    id: null,
    editing: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch events on mount
  useEffect(() => {
    fetch(`${BASE_URL}/api/calendar?userId=${defaultUserId}`)
      .then(res => res.json())
      .then((evts: CalendarEvent[]) => {
        setEvents(evts);
        setData && setData((prev: any) => ({ ...prev, calendar: evts }));
      });
  }, [setData]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const resetForm = () => setForm({ title: '', description: '', start_time: '', end_time: '', all_day: false, id: null, editing: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const method = form.editing ? 'PUT' : 'POST';
      const url = form.editing
        ? `${BASE_URL}/api/calendar/${form.id}`
        : `${BASE_URL}/api/calendar`;
      const body = {
        title: form.title,
        description: form.description,
        start_time: form.start_time,
        end_time: form.end_time,
        all_day: form.all_day,
        userId: defaultUserId
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Failed to save event');
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (evt: CalendarEvent) => {
    setForm({
      title: evt.title,
      description: evt.description,
      start_time: formatDateTimeLocal(evt.start_time),
      end_time: formatDateTimeLocal(evt.end_time),
      all_day: evt.all_day,
      id: evt.id,
      editing: true
    });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this event?')) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/calendar/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: defaultUserId })
      });
      if (!res.ok) throw new Error('Failed to delete event');
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">Calendar</h2>
      <form onSubmit={handleSubmit} className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          className="border rounded p-2"
          name="title"
          placeholder="Event Title"
          value={form.title}
          onChange={handleChange}
          required
        />
        <input
          className="border rounded p-2"
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
        />
        <input
          className="border rounded p-2"
          name="start_time"
          type="datetime-local"
          value={form.start_time}
          onChange={handleChange}
          required
        />
        <input
          className="border rounded p-2"
          name="end_time"
          type="datetime-local"
          value={form.end_time}
          onChange={handleChange}
        />
        <label className="flex items-center col-span-2">
          <input
            type="checkbox"
            name="all_day"
            checked={form.all_day}
            onChange={handleChange}
            className="mr-2"
          />
          All Day
        </label>
        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {form.editing ? 'Update' : 'Add'} Event
          </button>
          {form.editing && (
            <button type="button" onClick={resetForm} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
          )}
        </div>
        {error && <div className="col-span-2 text-red-600">{error}</div>}
      </form>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Description</th>
              <th className="text-left p-2">Start</th>
              <th className="text-left p-2">End</th>
              <th className="text-left p-2">All Day</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr><td colSpan={6} className="p-2 text-gray-500">No events yet.</td></tr>
            )}
            {events.map((evt: CalendarEvent) => (
              <tr key={evt.id} className="border-t">
                <td className="p-2 font-semibold">{evt.title}</td>
                <td className="p-2">{evt.description}</td>
                <td className="p-2">{evt.start_time ? new Date(evt.start_time).toLocaleString() : ''}</td>
                <td className="p-2">{evt.end_time ? new Date(evt.end_time).toLocaleString() : ''}</td>
                <td className="p-2">{evt.all_day ? 'Yes' : 'No'}</td>
                <td className="p-2 flex gap-2">
                  <button onClick={() => handleEdit(evt)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(evt.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
