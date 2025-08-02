"use client"

import type React from "react"

import { useState } from "react"
import { MessageCircle, Send } from "lucide-react"
import { useDashboard } from "../context/DashboardContext"

export default function ChatbotSection() {
  const [message, setMessage] = useState("")
  const [chatHistory, setChatHistory] = useState([
    { type: "bot", message: "Hello! I'm A.S.A.D, your productivity assistant. How can I help you today?" },
    { type: "user", message: "What should I focus on today?" },
    {
      type: "bot",
      message:
        "Based on your goals, I recommend focusing on your project proposal first, then your workout. You're making great progress!",
    },
  ])
  const { data, addGoal, addScheduleEvent, addWorkout, refreshData } = useDashboard()

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  console.log("Form submitted!"); // Debug: form submit triggered

  if (!message.trim()) {
    console.log("No message to send."); // Debug: empty message
    return;
  }

  setChatHistory((prev) => [...prev, { type: "user", message }]);
  setMessage("");
  console.log("Sending message to backend:", message); // Debug: message being sent

  try {
    const res = await fetch("https://productivity-dashboard-218x.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    console.log("Fetch response status:", res.status); // Debug: response status
    const data = await res.json();
    console.log("Response from backend:", data); // Debug: backend response
    
    // Check if the AI response contains action keywords and trigger dashboard actions
    const aiResponse = data.response || "";
    const lowerResponse = aiResponse.toLowerCase();

    let dashboardActionPerformed = false;

    // Check for goal-related actions
    if (lowerResponse.includes("add") && (lowerResponse.includes("goal") || lowerResponse.includes("task"))) {
      if (lowerResponse.includes("short") || lowerResponse.includes("daily") || lowerResponse.includes("weekly")) {
        const goalText = extractGoalText(message, aiResponse);
        if (goalText) {
          await addGoal('shortTerm', goalText);
          dashboardActionPerformed = true;
          setChatHistory((prev) => [
            ...prev,
            {
              type: "bot",
              message: `Great! I've added "${goalText}" to your short-term goals. Keep up the great work!`,
            },
          ]);
        }
      } else if (lowerResponse.includes("long") || lowerResponse.includes("monthly") || lowerResponse.includes("yearly")) {
        const goalText = extractGoalText(message, aiResponse);
        if (goalText) {
          await addGoal('longTerm', goalText);
          dashboardActionPerformed = true;
          setChatHistory((prev) => [
            ...prev,
            {
              type: "bot",
              message: `Excellent! I've added "${goalText}" to your long-term goals. You're building a great future!`,
            },
          ]);
        }
      }
    }

    // Check for schedule-related actions
    if (!dashboardActionPerformed && (lowerResponse.includes("schedule") || lowerResponse.includes("meeting") || lowerResponse.includes("appointment"))) {
      const { time, event } = extractScheduleInfo(message, aiResponse);
      if (time && event) {
        await addScheduleEvent(time, event);
        dashboardActionPerformed = true;
        setChatHistory((prev) => [
          ...prev,
          {
            type: "bot",
            message: `Perfect! I've scheduled "${event}" at ${time}. Your calendar is updated!`,
          },
        ]);
      }
    }

    // Check for workout-related actions
    if (!dashboardActionPerformed && (lowerResponse.includes("workout") || lowerResponse.includes("exercise") || lowerResponse.includes("gym"))) {
      const { type, duration } = extractWorkoutInfo(message, aiResponse);
      if (type && duration) {
        const calories = Math.round(duration * 8); // Rough estimate
        await addWorkout(type, duration, calories);
        dashboardActionPerformed = true;
        setChatHistory((prev) => [
          ...prev,
          {
            type: "bot",
            message: `Awesome! I've logged your ${duration}-minute ${type} workout. You're staying fit and earning XP!`,
          },
        ]);
      }
    }

    // Refresh dashboard data if any action was performed
    if (dashboardActionPerformed) {
      refreshData();
      return;
    }

    // Default response
    setChatHistory((prev) => [
      ...prev,
      {
        type: "bot",
        message: aiResponse || "Sorry, I couldn't get a response from the AI.",
      },
    ]);
  } catch (err) {
    console.error("Fetch error:", err); // Debug: fetch error
    setChatHistory((prev) => [
      ...prev,
      {
        type: "bot",
        message: "Error: Could not reach the AI assistant.",
      },
    ]);
  }
};

// Helper functions to extract information from user messages and AI responses
const extractGoalText = (userMessage: string, aiResponse: string): string | null => {
  // Look for goal text in the user message
  const goalKeywords = ["goal", "task", "objective", "target"];
  const words = userMessage.toLowerCase().split(" ");
  
  for (let i = 0; i < words.length; i++) {
    if (goalKeywords.includes(words[i])) {
      // Extract text after the goal keyword
      const goalText = userMessage.substring(userMessage.toLowerCase().indexOf(words[i]) + words[i].length).trim();
      if (goalText) {
        return goalText;
      }
    }
  }
  
  // If no goal keyword found, try to extract from the full message
  if (userMessage.length > 10) {
    return userMessage;
  }
  
  return null;
};

const extractScheduleInfo = (userMessage: string, aiResponse: string): { time: string | null, event: string | null } => {
  const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/;
  const timeMatch = userMessage.match(timePattern);
  const time = timeMatch ? timeMatch[1] : null;
  
  // Extract event name (everything after time or common scheduling words)
  const schedulingWords = ["schedule", "meeting", "appointment", "call", "at"];
  let event = null;
  
  for (const word of schedulingWords) {
    const index = userMessage.toLowerCase().indexOf(word);
    if (index !== -1) {
      event = userMessage.substring(index + word.length).trim();
      break;
    }
  }
  
  return { time, event };
};

const extractWorkoutInfo = (userMessage: string, aiResponse: string): { type: string | null, duration: number | null } => {
  const workoutTypes = ["cardio", "strength", "yoga", "running", "cycling", "swimming", "weightlifting"];
  const durationPattern = /(\d+)\s*(?:min|minutes?|mins?)/;
  
  const durationMatch = userMessage.match(durationPattern);
  const duration = durationMatch ? parseInt(durationMatch[1]) : 30; // Default 30 minutes
  
  let type = null;
  for (const workoutType of workoutTypes) {
    if (userMessage.toLowerCase().includes(workoutType)) {
      type = workoutType;
      break;
    }
  }
  
  if (!type) {
    type = "workout"; // Default type
  }
  
  return { type, duration };
};

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <MessageCircle className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg font-semibold text-white">Ask A.S.A.D</h2>
      </div>

      {/* Chat History */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4 h-48 overflow-y-auto border border-gray-600">
        <div className="space-y-3">
          {chatHistory.map((chat, index) => (
            <div key={index} className={`flex ${chat.type === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  chat.type === "user" ? "bg-cyan-600 text-white" : "bg-gray-600 text-gray-100"
                }`}
              >
                {chat.message}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask me anything..."
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
