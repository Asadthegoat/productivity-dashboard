"use client"

import { Dumbbell, ExternalLink } from "lucide-react"

export default function WorkoutTracker() {
  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Dumbbell className="w-5 h-5 text-red-400" />
        <h2 className="text-lg font-semibold text-white">Workout Tracker</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-green-900/30 rounded-lg border border-green-700">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">✓</span>
          </div>
          <div>
            <p className="text-white font-medium">Workout Complete!</p>
            <p className="text-green-400 text-sm">Upper Body - 45 minutes</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
            <p className="text-gray-400">This Week</p>
            <p className="text-white font-semibold">4/5 days</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
            <p className="text-gray-400">Streak</p>
            <p className="text-white font-semibold">12 days</p>
          </div>
        </div>

        <a
          href="https://fake-workout-app.com"
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Open Workout App
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}
