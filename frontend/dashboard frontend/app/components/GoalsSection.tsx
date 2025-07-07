"use client"

import { useState } from "react"
import { Target, Plus, Check } from "lucide-react"

export default function GoalsSection() {
  const [shortTermGoals, setShortTermGoals] = useState([
    { id: 1, text: "Complete project proposal", completed: false, progress: 75 },
    { id: 2, text: "Gym 5 days this week", completed: false, progress: 60 },
    { id: 3, text: "Read 2 chapters of book", completed: true, progress: 100 },
  ])

  const [longTermGoals, setLongTermGoals] = useState([
    { id: 1, text: "Launch side project", completed: false, progress: 30 },
    { id: 2, text: "Learn Spanish fluently", completed: false, progress: 45 },
    { id: 3, text: "Run a marathon", completed: false, progress: 20 },
  ])

  const toggleGoal = (goalId: number, isShortTerm: boolean) => {
    if (isShortTerm) {
      setShortTermGoals((goals) =>
        goals.map((goal) =>
          goal.id === goalId
            ? { ...goal, completed: !goal.completed, progress: goal.completed ? goal.progress : 100 }
            : goal,
        ),
      )
    } else {
      setLongTermGoals((goals) =>
        goals.map((goal) =>
          goal.id === goalId
            ? { ...goal, completed: !goal.completed, progress: goal.completed ? goal.progress : 100 }
            : goal,
        ),
      )
    }
  }

  const GoalItem = ({ goal, isShortTerm }: { goal: any; isShortTerm: boolean }) => (
    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => toggleGoal(goal.id, isShortTerm)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
            goal.completed ? "bg-green-600 border-green-600" : "border-gray-500 hover:border-gray-400"
          }`}
        >
          {goal.completed && <Check className="w-3 h-3 text-white" />}
        </button>
        <span className={`flex-1 ${goal.completed ? "text-gray-400 line-through" : "text-white"}`}>{goal.text}</span>
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
    </div>
  )

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
            <button className="text-green-400 hover:text-green-300">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {shortTermGoals.map((goal) => (
              <GoalItem key={goal.id} goal={goal} isShortTerm={true} />
            ))}
          </div>
        </div>

        {/* Long-Term Goals */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Long-Term Goals</h3>
            <button className="text-green-400 hover:text-green-300">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {longTermGoals.map((goal) => (
              <GoalItem key={goal.id} goal={goal} isShortTerm={false} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
