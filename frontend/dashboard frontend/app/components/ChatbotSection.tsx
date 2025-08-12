"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { MessageCircle, Send, Wifi, WifiOff } from "lucide-react"
import { useDashboard } from "../context/DashboardContext"

export default function ChatbotSection() {
  const [message, setMessage] = useState("")
  const { 
    chatMessages, 
    isConnected, 
    sendChatMessage, 
    loading 
  } = useDashboard()
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isSending, setIsSending] = useState(false)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted!")

    if (!message.trim() || isSending) {
      console.log("No message to send or already sending.")
      return
    }

    setIsSending(true)
    
    try {
      await sendChatMessage(message)
      setMessage("")
    } catch (err) {
      console.error("Error sending message:", err)
    } finally {
      setIsSending(false)
    }
  }

  const formatMessageTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Ask A.S.A.D</h2>
        </div>
        
        {/* Connection Status Indicator */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-400">Local</span>
            </>
          )}
        </div>
      </div>

      {/* Chat History */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4 h-48 overflow-y-auto border border-gray-600">
        <div className="space-y-3">
          {chatMessages.map((chat, index) => (
            <div key={index} className={`flex ${chat.type === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-xs">
                <div
                  className={`px-3 py-2 rounded-lg text-sm ${
                    chat.type === "user" 
                      ? "bg-cyan-600 text-white" 
                      : "bg-gray-600 text-gray-100"
                  }`}
                >
                  {chat.message}
                </div>
                <div className={`text-xs text-gray-400 mt-1 ${
                  chat.type === "user" ? "text-right" : "text-left"
                }`}>
                  {formatMessageTime(chat.timestamp)}
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {isSending && (
            <div className="flex justify-start">
              <div className="max-w-xs">
                <div className="bg-gray-600 text-gray-100 px-3 py-2 rounded-lg text-sm">
                  <div className="flex space-x-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  A.S.A.D is typing...
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask me anything..."
          disabled={isSending || loading}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!message.trim() || isSending || loading}
          className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
        >
          {isSending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
      
      {/* Help text */}
      <div className="mt-2 text-xs text-gray-500">
        {isConnected ? (
          <span className="text-green-400">✓ Real-time updates active</span>
        ) : (
          <span className="text-yellow-400">⚠ Working in offline mode</span>
        )}
        <span className="mx-2">•</span>
        Try: "Add a goal to learn Python" or "Schedule meeting at 2 PM"
      </div>
    </div>
  )
}