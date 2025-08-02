"use client"

import { useState } from "react"
import { Clock, Pencil, Trash2, Plus } from "lucide-react"
import { useDashboard } from "../context/DashboardContext"

export default function ScheduleSection() {
  const { data, addScheduleEvent, refreshData, updateScheduleEvent, deleteScheduleEvent } = useDashboard();
  const [form, setForm] = useState({ time: "", event: "", type: "work" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ time: "", event: "", type: "work" });

  const scheduleItems = data?.schedule || [];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "work":
        return "bg-blue-600"
      case "exercise":
        return "bg-green-600"
      case "personal":
        return "bg-purple-600"
      default:
        return "bg-gray-600"
    }
  }

  // Add new event
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.time.trim() || !form.event.trim()) return;
    await addScheduleEvent(form.time, form.event, form.type);
    setForm({ time: "", event: "", type: "work" });
    refreshData();
  };

  // Edit event
  const handleEdit = async (id: number) => {
    setEditId(id);
    const item = scheduleItems.find((i: any) => i.id === id);
    if (item) setEditForm({ time: item.time, event: item.event, type: (item as any).type || "work" });
  };

  // Save edit
  const handleSaveEdit = async (id: number) => {
    if (editForm.time.trim() && editForm.event.trim()) {
      if (typeof updateScheduleEvent === "function") {
        await updateScheduleEvent(id, editForm.time, editForm.event, editForm.type);
        refreshData();
      }
      setEditId(null);
    }
  };

  // Delete event
  const handleDelete = async (id: number) => {
    if (typeof deleteScheduleEvent === "function") {
      await deleteScheduleEvent(id);
      refreshData();
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-5 h-5 text-orange-400" />
        <h2 className="text-lg font-semibold text-white">Today's Schedule</h2>
      </div>

      {/* Add Event Form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          type="text"
          value={form.time}
          onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
          placeholder="Time (e.g. 9:00 AM)"
          className="w-24 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
        />
        <input
          type="text"
          value={form.event}
          onChange={e => setForm(f => ({ ...f, event: e.target.value }))}
          placeholder="Event description"
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
        />
        <select
          value={form.type}
          onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white"
        >
          <option value="work">Work</option>
          <option value="exercise">Exercise</option>
          <option value="personal">Personal</option>
        </select>
        <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white px-2 py-1 rounded-lg flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {scheduleItems.map((item: any, index: number) => (
          <div key={item.id || index} className="flex items-center gap-4 p-3 bg-gray-700 rounded-lg border border-gray-600">
            <div className="text-sm font-mono text-gray-300 w-16">{editId === item.id ? (
              <input
                type="text"
                value={editForm.time}
                onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                className="w-16 bg-gray-800 border border-gray-600 rounded px-1 text-white"
              />
            ) : item.time}</div>

            <div className={`w-3 h-3 rounded-full ${getTypeColor(item.type)}`}></div>

            <div className="flex-1">
              {editId === item.id ? (
                <input
                  type="text"
                  value={editForm.event}
                  onChange={e => setEditForm(f => ({ ...f, event: e.target.value }))}
                  className="bg-gray-800 border border-gray-600 rounded px-1 text-white w-full"
                />
              ) : (
                <span className="text-white text-sm">{item.event || item.task}</span>
              )}
            </div>

            <div className="text-xs text-gray-400 capitalize">
              {editId === item.id ? (
                <select
                  value={editForm.type}
                  onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                  className="bg-gray-800 border border-gray-600 rounded px-1 text-white"
                >
                  <option value="work">Work</option>
                  <option value="exercise">Exercise</option>
                  <option value="personal">Personal</option>
                </select>
              ) : item.type}
            </div>

            <div className="flex gap-2">
              {editId === item.id ? (
                <button onClick={() => handleSaveEdit(item.id)} className="text-green-400 hover:text-green-600"><Pencil className="w-4 h-4" /></button>
              ) : (
                <button onClick={() => handleEdit(item.id)} className="text-blue-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
              )}
              <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
