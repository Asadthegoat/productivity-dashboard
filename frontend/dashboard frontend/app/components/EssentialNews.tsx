"use client"

import { Newspaper, ExternalLink } from "lucide-react"

export default function EssentialNews() {
  const newsItems = [
    {
      title: "Tech Industry Sees Major Breakthrough in AI",
      source: "TechCrunch",
      url: "#",
    },
    {
      title: "Global Markets Show Positive Growth",
      source: "Financial Times",
      url: "#",
    },
    {
      title: "Climate Summit Reaches New Agreement",
      source: "Reuters",
      url: "#",
    },
  ]

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Newspaper className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-white">Essential News</h2>
      </div>

      <div className="space-y-3">
        {newsItems.map((item, index) => (
          <a
            key={index}
            href={item.url}
            className="block p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-white text-sm font-medium mb-1 leading-tight">{item.title}</h3>
                <p className="text-gray-400 text-xs">{item.source}</p>
              </div>
              <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0 mt-1" />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
