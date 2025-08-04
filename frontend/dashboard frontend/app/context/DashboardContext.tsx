"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Goal {
  id: number;
  text: string;
  completed: boolean;
  progress: number;
  createdAt: string;
}

interface ScheduleEvent {
  id: number;
  time: string;
  event: string;
  createdAt: string;
}

interface WorkoutLog {
  id: number;
  type: string;
  duration: number;
  calories: number;
  date: string;
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
}

interface DashboardData {
  goals: {
    shortTerm: Goal[];
    longTerm: Goal[];
  };
  schedule: ScheduleEvent[];
  workoutLog: WorkoutLog[];
  eatingGoals: any[];
  news: NewsItem[];
  level: number;
  xp: number;
  maxXp: number;
}

interface DashboardContextType {
  data: DashboardData;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  addGoal: (type: 'shortTerm' | 'longTerm', text: string, progress?: number) => Promise<void>;
  updateGoal: (id: number, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  addScheduleEvent: (time: string, event: string, type?: string) => Promise<void>;
  updateScheduleEvent?: (id: number, time: string, event: string, type?: string) => Promise<void>;
  deleteScheduleEvent?: (id: number) => Promise<void>;
  addWorkout: (type: string, duration: number, calories: number) => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const [data, setData] = useState<DashboardData>({
    goals: { 
      shortTerm: [
        { id: 1, text: "Complete project proposal", completed: false, progress: 75, createdAt: new Date().toISOString() },
        { id: 2, text: "Gym 5 days this week", completed: false, progress: 60, createdAt: new Date().toISOString() },
        { id: 3, text: "Read 2 chapters of book", completed: true, progress: 100, createdAt: new Date().toISOString() },
      ], 
      longTerm: [
        { id: 4, text: "Launch side project", completed: false, progress: 30, createdAt: new Date().toISOString() },
        { id: 5, text: "Learn Spanish fluently", completed: false, progress: 45, createdAt: new Date().toISOString() },
        { id: 6, text: "Run a marathon", completed: false, progress: 20, createdAt: new Date().toISOString() },
      ] 
    },
    schedule: [
      { id: 1, time: "9:00 AM", event: "Team Meeting", createdAt: new Date().toISOString() },
      { id: 2, time: "2:00 PM", event: "Project Review", createdAt: new Date().toISOString() },
      { id: 3, time: "4:30 PM", event: "Workout", createdAt: new Date().toISOString() },
    ],
    workoutLog: [
      { id: 1, type: "Cardio", duration: 30, calories: 200, date: new Date().toISOString() },
      { id: 2, type: "Strength", duration: 45, calories: 150, date: new Date().toISOString() },
    ],
    eatingGoals: [],
    news: [],
    level: 8,
    xp: 2250,
    maxXp: 3000
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async () => {
    // For now, just refresh the local state
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const addGoal = async (type: 'shortTerm' | 'longTerm', text: string, progress: number = 0) => {
    try {
      const newGoal = {
        id: Date.now(),
        text,
        completed: false,
        progress,
        createdAt: new Date().toISOString()
      };
      
      setData(prev => ({
        ...prev,
        goals: {
          ...prev.goals,
          [type]: [...prev.goals[type], newGoal]
        }
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add goal');
      throw err;
    }
  };

  const updateGoal = async (id: number, updates: Partial<Goal>) => {
    try {
      setData(prev => ({
        ...prev,
        goals: {
          shortTerm: prev.goals.shortTerm.map(goal => 
            goal.id === id ? { ...goal, ...updates } : goal
          ),
          longTerm: prev.goals.longTerm.map(goal => 
            goal.id === id ? { ...goal, ...updates } : goal
          )
        }
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update goal');
      throw err;
    }
  };

  const deleteGoal = async (id: number) => {
    try {
      setData(prev => ({
        ...prev,
        goals: {
          shortTerm: prev.goals.shortTerm.filter(goal => goal.id !== id),
          longTerm: prev.goals.longTerm.filter(goal => goal.id !== id)
        }
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
      throw err;
    }
  };

  const addScheduleEvent = async (time: string, event: string, type: string = "work") => {
    try {
      const newEvent = {
        id: Date.now(),
        time,
        event,
        type,
        createdAt: new Date().toISOString()
      };
      setData(prev => ({
        ...prev,
        schedule: [...prev.schedule, newEvent]
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add schedule event');
      throw err;
    }
  };

  const updateScheduleEvent = async (id: number, time: string, event: string, type: string = "work") => {
    try {
      setData(prev => ({
        ...prev,
        schedule: prev.schedule.map(ev =>
          ev.id === id ? { ...ev, time, event, type } : ev
        )
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule event');
      throw err;
    }
  };

  const deleteScheduleEvent = async (id: number) => {
    try {
      setData(prev => ({
        ...prev,
        schedule: prev.schedule.filter(ev => ev.id !== id)
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule event');
      throw err;
    }
  };

  const addWorkout = async (type: string, duration: number, calories: number) => {
    try {
      const newWorkout = {
        id: Date.now(),
        type,
        duration,
        calories,
        date: new Date().toISOString()
      };
      
      setData(prev => {
        const newXp = Math.min(prev.xp + 50, prev.maxXp);
        const newLevel = newXp >= prev.maxXp ? prev.level + 1 : prev.level;
        const newMaxXp = newXp >= prev.maxXp ? Math.floor(prev.maxXp * 1.2) : prev.maxXp;
        
        return {
          ...prev,
          workoutLog: [...prev.workoutLog, newWorkout],
          xp: newXp >= prev.maxXp ? 0 : newXp,
          level: newLevel,
          maxXp: newMaxXp
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add workout');
      throw err;
    }
  };

  const value: DashboardContextType = {
    data,
    loading,
    error,
    refreshData,
    addGoal,
    updateGoal,
    deleteGoal,
    addScheduleEvent,
    updateScheduleEvent,
    deleteScheduleEvent,
    addWorkout
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}; 