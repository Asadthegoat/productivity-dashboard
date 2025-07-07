"use client"

import { Music, Play } from "lucide-react"

export default function SongOfTheDay() {
  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Music className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white">Song of the Day</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
          <Play className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1">
          <h3 className="text-white font-medium mb-1">Midnight City</h3>
          <p className="text-gray-400 text-sm mb-2">M83</p>
          <div className="flex items-center gap-2">
            <div className="w-32 bg-gray-600 rounded-full h-1">
              <div className="bg-purple-500 h-1 rounded-full" style={{ width: "45%" }}></div>
            </div>
            <span className="text-xs text-gray-400">2:15 / 4:01</span>
          </div>
        </div>

        <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Play
        </button>
      </div>
    </div>
  )
}
