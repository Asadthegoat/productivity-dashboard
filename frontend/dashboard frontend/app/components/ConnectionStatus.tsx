"use client"

import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react"
import { useDashboard } from "../context/DashboardContext"

export default function ConnectionStatus() {
  const { isConnected, error, refreshData, loading } = useDashboard()

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium
        ${isConnected 
          ? 'bg-green-800 text-green-100 border border-green-600' 
          : 'bg-yellow-800 text-yellow-100 border border-yellow-600'
        }
        ${error ? 'bg-red-800 text-red-100 border border-red-600' : ''}
      `}>
        {error ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Connection Error</span>
          </>
        ) : isConnected ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Live Updates</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Offline Mode</span>
          </>
        )}
        
        <button
          onClick={refreshData}
          disabled={loading}
          className="ml-2 p-1 rounded hover:bg-black hover:bg-opacity-20 transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {error && (
        <div className="mt-2 p-2 bg-red-900 text-red-100 text-xs rounded-lg border border-red-600 max-w-sm">
          {error}
        </div>
      )}
    </div>
  )
}