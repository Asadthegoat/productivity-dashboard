"use client"

import { useState } from "react"
import { Target, Plus, Check, Edit, Trash2, X } from "lucide-react"
import { useDashboard } from "../context/DashboardContext"

export default function GoalsSection() {
  const { data, addGoal, updateGoal, deleteGoal, loading } = useDashboard()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<{ id: number; type: 'shortTerm' | 'longTerm'; text: string } | null>(null)
  const [newGoalText, setNewGoalText] = useState("")
  const [newGoalType, setNewGoalType] = useState<'shortTerm' | 'longTerm'>('shortTerm')

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGoalText.trim()) return

    try {
      await addGoal(newGoalType, newGoalText.trim())
      setNewGoalText("")
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to add goal:', error)
    }
  }

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGoal || !editingGoal.text.trim()) return

    try {
      await updateGoal(editingGoal.id, { text: editingGoal.text.trim() })
      setEditingGoal(null)
    } catch (error) {
      console.error('Failed to update goal:', error)
    }
  }

  const handleDeleteGoal = async (id: number) => {
    try {
      await deleteGoal(id)
    } catch (error) {
      console.error('Failed to delete goal:', error)
    }
  }

  const toggleGoal = async (goalId: number, isShortTerm: boolean) => {
    const goal = isShortTerm 
      ? data.goals.shortTerm.find(g => g.id === goalId)
      : data.goals.longTerm.find(g => g.id === goalId)
    
    if (goal) {
      try {
        await updateGoal(goalId, { 
          completed: !goal.completed, 
          progress: goal.completed ? goal.progress : 100 
        })
      } catch (error) {
        console.error('Failed to toggle goal:', error)
      }
    }
  }

  const GoalItem = ({ goal, isShortTerm }: { goal: any; isShortTerm: boolean }) => {
    const isEditing = editingGoal?.id === goal.id

    return (
      <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
        {isEditing ? (
          <form onSubmit={handleUpdateGoal} className="space-y-3">
            <input
              type="text"
              value={editingGoal?.text || ''}
              onChange={(e) => setEditingGoal(prev => prev ? { ...prev, text: e.target.value } : null)}
              className="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Enter goal text..."
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => toggleGoal(goal.id, isShortTerm)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  goal.completed ? "bg-green-600 border-green-600" : "border-gray-500 hover:border-gray-400"
                }`}
              >
                {goal.completed && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className={`flex-1 ${goal.completed ? "text-gray-400 line-through" : "text-white"}`}>
                {goal.text}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditingGoal({ id: goal.id, type: isShortTerm ? 'shortTerm' : 'longTerm', text: goal.text })}
                  className="text-gray-400 hover:text-blue-400 p-1"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteGoal(goal.id)}
                  className="text-gray-400 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="ml-8">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Progress</span>
                <span className="text-gray-300">{goal.progress}%</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${goal.completed ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${goal.progress}%` }}
                ></div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">Goals</h2>
        </div>
        <div className="text-gray-400">Loading goals...</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <Target className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-semibold text-white">Goals</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Short-Term Goals */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Short-Term Goals</h3>
            <button 
              onClick={() => setShowAddForm(true)}
              className="text-green-400 hover:text-green-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.goals.shortTerm.map((goal) => (
              <GoalItem key={goal.id} goal={goal} isShortTerm={true} />
            ))}
            {data.goals.shortTerm.length === 0 && (
              <div className="text-gray-400 text-sm text-center py-4">
                No short-term goals yet. Add one to get started!
              </div>
            )}
          </div>
        </div>

        {/* Long-Term Goals */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Long-Term Goals</h3>
            <button 
              onClick={() => setShowAddForm(true)}
              className="text-green-400 hover:text-green-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.goals.longTerm.map((goal) => (
              <GoalItem key={goal.id} goal={goal} isShortTerm={false} />
            ))}
            {data.goals.longTerm.length === 0 && (
              <div className="text-gray-400 text-sm text-center py-4">
                No long-term goals yet. Add one to get started!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Goal Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add New Goal</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Goal Type
                </label>
                <select
                  value={newGoalType}
                  onChange={(e) => setNewGoalType(e.target.value as 'shortTerm' | 'longTerm')}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="shortTerm">Short-Term Goal</option>
                  <option value="longTerm">Long-Term Goal</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Goal Description
                </label>
                <textarea
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  placeholder="Enter your goal..."
                  rows={3}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Add Goal
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
