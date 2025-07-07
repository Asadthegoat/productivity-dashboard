"use client"

import { Apple, ExternalLink } from "lucide-react"

export default function EatingGoals() {
  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Apple className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-semibold text-white">Eating Goals</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Calories Today</p>
              <p className="text-white font-semibold">1,850 / 2,200</p>
            </div>
            <div>
              <p className="text-gray-400">Water Intake</p>
              <p className="text-white font-semibold">6 / 8 glasses</p>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Daily Progress</span>
              <span className="text-gray-300">84%</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: "84%" }}></div>
            </div>
          </div>
        </div>

        <a
          href="https://fake-nutrition-app.com"
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Open Eating Goals App
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}
