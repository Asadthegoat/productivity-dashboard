"use client"

import type React from "react"

import { useState } from "react"
import { MessageCircle, Send } from "lucide-react"

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
    const res = await fetch("http://localhost:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    console.log("Fetch response status:", res.status); // Debug: response status
    const data = await res.json();
    console.log("Response from backend:", data); // Debug: backend response
    setChatHistory((prev) => [
      ...prev,
      {
        type: "bot",
        message: data.response || "Sorry, I couldn't get a response from the AI.",
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
