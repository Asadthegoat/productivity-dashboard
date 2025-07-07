"use client"

import { Quote } from "lucide-react"

export default function MotivationalQuote() {
  return (
    <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Quote className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">Daily Motivation</h2>
      </div>

      <blockquote className="text-white text-lg font-medium mb-3 leading-relaxed">
        "The way to get started is to quit talking and begin doing."
      </blockquote>

      <cite className="text-indigo-300 text-sm font-medium">— Walt Disney</cite>
    </div>
  )
}
