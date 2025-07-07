"use client"

import { Calendar, TrendingUp } from "lucide-react"

export default function TopBar() {
  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Welcome Message */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Welcome to your dashboard</h1>
          <p className="text-gray-400 text-sm">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Calendar Preview */}
        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Today's Schedule</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-300">9:00 AM</span>
              <span className="text-gray-400">Team Meeting</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">2:00 PM</span>
              <span className="text-gray-400">Project Review</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">4:30 PM</span>
              <span className="text-gray-400">Workout</span>
            </div>
          </div>
        </div>

        {/* Level Tracker */}
        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">Level 8</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Progress</span>
              <span className="text-gray-300">75%</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: "75%" }}></div>
            </div>
            <p className="text-xs text-gray-400">2,250 / 3,000 XP</p>
          </div>
        </div>
      </div>
    </div>
  )
}
