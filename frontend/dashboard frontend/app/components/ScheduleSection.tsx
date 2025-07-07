"use client"

import { Clock } from "lucide-react"

export default function ScheduleSection() {
  const scheduleItems = [
    { time: "6:00 AM", task: "Morning Workout", type: "exercise" },
    { time: "7:30 AM", task: "Breakfast & Coffee", type: "personal" },
    { time: "9:00 AM", task: "Team Standup", type: "work" },
    { time: "10:00 AM", task: "Deep Work Block", type: "work" },
    { time: "12:00 PM", task: "Lunch Break", type: "personal" },
    { time: "1:00 PM", task: "Project Development", type: "work" },
    { time: "3:00 PM", task: "Client Call", type: "work" },
    { time: "4:30 PM", task: "Email & Admin", type: "work" },
    { time: "6:00 PM", task: "Evening Walk", type: "personal" },
    { time: "8:00 PM", task: "Reading Time", type: "personal" },
  ]

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

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-5 h-5 text-orange-400" />
        <h2 className="text-lg font-semibold text-white">Today's Schedule</h2>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {scheduleItems.map((item, index) => (
          <div key={index} className="flex items-center gap-4 p-3 bg-gray-700 rounded-lg border border-gray-600">
            <div className="text-sm font-mono text-gray-300 w-16">{item.time}</div>

            <div className={`w-3 h-3 rounded-full ${getTypeColor(item.type)}`}></div>

            <div className="flex-1">
              <span className="text-white text-sm">{item.task}</span>
            </div>

            <div className="text-xs text-gray-400 capitalize">{item.type}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
