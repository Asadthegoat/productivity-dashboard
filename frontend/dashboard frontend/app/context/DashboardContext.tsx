"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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
  type?: string;
  createdAt: string;
}

interface WorkoutLog {
  id: number;
  type: string;
  duration: number;
  calories: number;
  date: string;
}

interface FoodLogItem {
  id: number;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  logged_at: string;
}

interface FoodSearchResult {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingQty: number;
  servingUnit: string;
  photo?: string | null;
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
  topics?: string[];
}

interface ChatMessage {
  type: 'user' | 'ai' | 'bot';
  message: string;
  timestamp: Date;
  userId?: number;
}

interface DashboardData {
  goals: {
    shortTerm: Goal[];
    longTerm: Goal[];
  };
  schedule: ScheduleEvent[];
  workoutLog: WorkoutLog[];
  eatingGoals: any[];
  calorieLog: FoodLogItem[];
  dailyCalorieGoal: number;
  news: NewsItem[];
  level: number;
  xp: number;
  maxXp: number;
}

export interface DashboardContextType {
  data: DashboardData;
  setData: React.Dispatch<React.SetStateAction<DashboardData>>;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  chatMessages: ChatMessage[];
  // Data modification functions
  refreshData: () => Promise<void>;
  addGoal: (type: 'shortTerm' | 'longTerm', text: string, progress?: number) => Promise<void>;
  updateGoal: (id: number, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  addScheduleEvent: (time: string, event: string, type?: string) => Promise<void>;
  updateScheduleEvent?: (id: number, time: string, event: string, type?: string) => Promise<void>;
  deleteScheduleEvent?: (id: number) => Promise<void>;
  addWorkout: (type: string, duration: number, calories: number) => Promise<void>;
  logFood: (food: {
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    timestamp?: string;
  }) => Promise<{ goalMet: boolean; xp?: number; level?: number }>;
  removeFood: (id: number) => Promise<void>;
  setCalorieGoal: (dailyCalorieGoal: number) => Promise<void>;
  searchFood: (query: string) => Promise<FoodSearchResult[]>;
  // Chat functions
  sendChatMessage: (message: string) => Promise<void>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: ReactNode;
  serverUrl?: string;
  userId?: number;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ 
  children,
  serverUrl = "https://productivity-dashboard-218x.onrender.com",
  userId = 1
}) => {
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
    calorieLog: [],
    dailyCalorieGoal: 2200,
    news: [],
    level: 8,
    xp: 2250,
    maxXp: 3000
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { 
      type: "bot", 
      message: "Hello! I'm A.S.A.D, your productivity assistant. How can I help you today?", 
      timestamp: new Date()
    },
    { 
      type: "user", 
      message: "What should I focus on today?", 
      timestamp: new Date()
    },
    {
      type: "bot",
      message: "Based on your goals, I recommend focusing on your project proposal first, then your workout. You're making great progress!",
      timestamp: new Date()
    },
  ]);

  const socketRef = useRef<Socket | null>(null);
  const isInitialMount = useRef(true);

  // Initialize WebSocket connection
  useEffect(() => {
    const initSocket = () => {
      console.log('Initializing WebSocket connection to:', serverUrl);
      
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      });

      socketRef.current = socket;

      // Connection events
      socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        setIsConnected(true);
        setError(null);
        
        // Join user-specific room
        socket.emit('join-user', userId);
        
        // Request initial dashboard data
        socket.emit('request-dashboard-data', userId);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setError('Connection failed. Using local data only.');
        setIsConnected(false);
      });

      // Dashboard data updates
      socket.on('dashboard-update', (newData: Partial<DashboardData>) => {
        console.log('Dashboard data updated:', newData);
        setData(prev => ({ ...prev, ...newData }));
      });

      // Chat messages
      socket.on('chat-message', (message: ChatMessage) => {
        console.log('Chat message received:', message);
        setChatMessages(prev => {
          // Avoid duplicate messages
          const isDuplicate = prev.some(msg => 
            msg.message === message.message && 
            Math.abs(new Date(msg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000
          );
          
          if (isDuplicate) return prev;
          return [...prev, { ...message, timestamp: new Date(message.timestamp) }];
        });
      });

      // News updates
      socket.on('news-update', (news: NewsItem[]) => {
        console.log('News updated:', news);
        setData(prev => ({ ...prev, news }));
      });

      // Error handling
      socket.on('error', (error: any) => {
        console.error('WebSocket error:', error);
        setError(error.message || 'An error occurred');
      });
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        console.log('Cleaning up WebSocket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [serverUrl, userId]);

  // Load initial dashboard data from API
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!isInitialMount.current) return;
      isInitialMount.current = false;

      setLoading(true);
      try {
        const response = await fetch(`${serverUrl}/api/dashboard-data`);
        if (response.ok) {
          const dashboardData = await response.json();
          console.log('Loaded dashboard data:', dashboardData);
          setData(dashboardData);
        } else {
          console.warn('Failed to load dashboard data, using default data');
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Failed to load dashboard data. Using local data.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [serverUrl]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/dashboard-data`);
      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      }
      // Also request via WebSocket if connected
      if (socketRef.current && isConnected) {
        socketRef.current.emit('request-dashboard-data', userId);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  const addGoal = async (type: 'shortTerm' | 'longTerm', text: string, progress: number = 0) => {
    try {
      const response = await fetch(`${serverUrl}/api/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, text, progress, userId })
      });

      if (!response.ok) throw new Error('Failed to add goal');
      
      const result = await response.json();
      console.log('Goal added:', result);
      
      // Data will be updated via WebSocket
      if (!isConnected) {
        // Fallback for when WebSocket is not connected
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add goal');
      throw err;
    }
  };

  const updateGoal = async (id: number, updates: Partial<Goal>) => {
    try {
      const response = await fetch(`${serverUrl}/api/goals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, userId })
      });

      if (!response.ok) throw new Error('Failed to update goal');
      
      const result = await response.json();
      console.log('Goal updated:', result);
      
      // Data will be updated via WebSocket
      if (!isConnected) {
        // Fallback for when WebSocket is not connected
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update goal');
      throw err;
    }
  };

  const deleteGoal = async (id: number) => {
    try {
      const response = await fetch(`${serverUrl}/api/goals/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) throw new Error('Failed to delete goal');
      
      // Data will be updated via WebSocket
      if (!isConnected) {
        // Fallback for when WebSocket is not connected
        setData(prev => ({
          ...prev,
          goals: {
            shortTerm: prev.goals.shortTerm.filter(goal => goal.id !== id),
            longTerm: prev.goals.longTerm.filter(goal => goal.id !== id)
          }
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
      throw err;
    }
  };

  const addScheduleEvent = async (time: string, event: string, type: string = "work") => {
    try {
      const response = await fetch(`${serverUrl}/api/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time, event, type, userId })
      });

      if (!response.ok) throw new Error('Failed to add schedule event');
      
      // Data will be updated via WebSocket
      if (!isConnected) {
        // Fallback for when WebSocket is not connected
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add schedule event');
      throw err;
    }
  };

  const updateScheduleEvent = async (id: number, time: string, event: string, type: string = "work") => {
    try {
      // Note: You'll need to add this endpoint to your backend
      const response = await fetch(`${serverUrl}/api/schedule/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time, event, type, userId })
      });

      if (!response.ok) {
        // Fallback to local update if endpoint doesn't exist
        setData(prev => ({
          ...prev,
          schedule: prev.schedule.map(ev =>
            ev.id === id ? { ...ev, time, event, type } : ev
          )
        }));
        return;
      }
      
      // Data will be updated via WebSocket
    } catch (err) {
      // Fallback to local update
      setData(prev => ({
        ...prev,
        schedule: prev.schedule.map(ev =>
          ev.id === id ? { ...ev, time, event, type } : ev
        )
      }));
    }
  };

  const deleteScheduleEvent = async (id: number) => {
    try {
      // Note: You'll need to add this endpoint to your backend
      const response = await fetch(`${serverUrl}/api/schedule/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        // Fallback to local deletion if endpoint doesn't exist
        setData(prev => ({
          ...prev,
          schedule: prev.schedule.filter(ev => ev.id !== id)
        }));
        return;
      }
      
      // Data will be updated via WebSocket
    } catch (err) {
      // Fallback to local deletion
      setData(prev => ({
        ...prev,
        schedule: prev.schedule.filter(ev => ev.id !== id)
      }));
    }
  };

  const addWorkout = async (type: string, duration: number, calories: number) => {
    try {
      const response = await fetch(`${serverUrl}/api/workout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, duration, calories, userId })
      });

      if (!response.ok) throw new Error('Failed to add workout');
      
      const result = await response.json();
      console.log('Workout added:', result);
      
      // Data will be updated via WebSocket
      if (!isConnected) {
        // Fallback for when WebSocket is not connected
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add workout');
      throw err;
    }
  };

  const searchFood = async (query: string) => {
    try {
      const response = await fetch(`${serverUrl}/api/calories/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error('Failed to search food');
      }

      const result = await response.json();
      return result.results || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search food');
      return [];
    }
  };

  const logFood = async (food: {
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    timestamp?: string;
  }) => {
    try {
      const response = await fetch(`${serverUrl}/api/calories/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...food, userId })
      });

      if (!response.ok) {
        throw new Error('Failed to log food');
      }

      const result = await response.json();

      if (!isConnected) {
        setData(prev => ({
          ...prev,
          calorieLog: [
            {
              id: Date.now(),
              food_name: food.name,
              calories: food.calories,
              protein: food.protein ?? 0,
              carbs: food.carbs ?? 0,
              fat: food.fat ?? 0,
              logged_at: food.timestamp || new Date().toISOString()
            },
            ...prev.calorieLog
          ],
          xp: result?.xp != null ? result.xp : prev.xp,
          level: result?.level != null ? result.level : prev.level,
          maxXp: result?.maxXp != null ? result.maxXp : prev.maxXp
        }));
      }

      return {
        goalMet: result.goalMet || false,
        xp: result.xp,
        level: result.level
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log food');
      throw err;
    }
  };

  const removeFood = async (id: number) => {
    try {
      const response = await fetch(`${serverUrl}/api/calories/log/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) throw new Error('Failed to remove food log');

      if (!isConnected) {
        setData(prev => ({
          ...prev,
          calorieLog: prev.calorieLog.filter(item => item.id !== id)
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove food log');
      throw err;
    }
  };

  const setCalorieGoal = async (dailyCalorieGoal: number) => {
    try {
      const response = await fetch(`${serverUrl}/api/calories/goal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyCalorieGoal, userId })
      });

      if (!response.ok) throw new Error('Failed to update calorie goal');

      const result = await response.json();

      if (!isConnected) {
        setData(prev => ({
          ...prev,
          dailyCalorieGoal
        }));
      }

      return result.goal;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update calorie goal');
      throw err;
    }
  };

  const sendChatMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      type: 'user',
      message,
      timestamp: new Date(),
      userId
    };

    // Add user message immediately
    setChatMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`${serverUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, userId })
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const result = await response.json();
      
      // Add AI response if not received via WebSocket
      if (!isConnected && result.response) {
        const aiMessage: ChatMessage = {
          type: 'ai',
          message: result.response,
          timestamp: new Date(),
          userId
        };
        setChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        type: 'ai',
        message: 'Sorry, I could not process your request at the moment.',
        timestamp: new Date(),
        userId
      };
      setChatMessages(prev => [...prev, errorMessage]);
      throw err;
    }
  };

  const value: DashboardContextType = {
    data,
    setData,
    loading,
    error,
    isConnected,
    chatMessages,
    setChatMessages,
    refreshData,
    addGoal,
    updateGoal,
    deleteGoal,
    addScheduleEvent,
    updateScheduleEvent,
    deleteScheduleEvent,
    addWorkout,
    searchFood,
    logFood,
    removeFood,
    setCalorieGoal,
    sendChatMessage
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};