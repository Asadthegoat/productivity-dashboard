"use client"
import TopBar from "./components/TopBar"
import SongOfTheDay from "./components/SongOfTheDay"
import EssentialNews from "./components/EssentialNews"
import MotivationalQuote from "./components/MotivationalQuote"
import GoalsSection from "./components/GoalsSection"
import ScheduleSection from "./components/ScheduleSection"
import WorkoutTracker from "./components/WorkoutTracker"
import ChatbotSection from "./components/ChatbotSection"
import EatingGoals from "./components/EatingGoals"

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Top Bar - Full Width */}
        <TopBar />

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Left Column - Primary Content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Song of the Day */}
            <SongOfTheDay />

            {/* Goals Section - Takes more vertical space */}
            <GoalsSection />

            {/* Schedule Section */}
            <ScheduleSection />
          </div>

          {/* Right Column - Secondary Content */}
          <div className="lg:col-span-4 space-y-6">
            {/* Essential News */}
            <EssentialNews />

            {/* Motivational Quote */}
            <MotivationalQuote />

            {/* Workout Tracker */}
            <WorkoutTracker />

            {/* Chatbot Section */}
            <ChatbotSection />

            {/* Eating Goals */}
            <EatingGoals />
          </div>
        </div>
      </div>
    </div>
  )
}
