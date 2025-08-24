﻿
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from "cors";
import pkg from 'pg';
import cron from "node-cron";
import { createServer } from 'http';
import { Server } from 'socket.io';
import spotifyService from './spotifyService.js';

const { Pool } = pkg;
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // This will reflect the request origin back
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.use(cors({
  origin: true, // This will reflect the request origin back
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));
app.use(express.json());

// Middleware to ensure CORS headers are always set
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // List of allowed origins
  const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://productivity-dashboard-218x.onrender.com"
  ];
  
  // Check regex patterns
  const allowedPatterns = [
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/v0-.*\.vercel\.app$/,
    /^https:\/\/preview-.*\.frcontent\.net$/,
    /^https:\/\/.*\.frcontent\.net$/,
    /^https:\/\/.*\.vusercontent\.net$/  // Add this for v0.dev domains
  ];
  
  // Check if origin is allowed
  let isAllowed = false;
  if (!origin) {
    isAllowed = true; // Allow requests with no origin
  } else if (allowedOrigins.includes(origin)) {
    isAllowed = true;
  } else {
    isAllowed = allowedPatterns.some(pattern => {
      const match = pattern.test(origin);
      if (match) {
        console.log(`Origin ${origin} matched pattern ${pattern}`);
      }
      return match;
    });
  }
  
  console.log(`CORS Check - Origin: ${origin}, Allowed: ${isAllowed}`);
  
  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    console.log(`CORS BLOCKED - Origin ${origin} not in allowed list or patterns`);
  }
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${origin || 'unknown origin'} - CORS: ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`);
  next();
});

// Handle preflight requests
app.options('*', (req, res) => {
  console.log(`OPTIONS preflight request from origin: ${req.headers.origin}`);
  res.sendStatus(200);
});

// Debug logging to see what's actually being used
console.log('=== DATABASE CONNECTION DEBUG ===');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL (masked):', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@') : 'NOT SET');

// Parse DATABASE_URL manually to ensure it's used correctly
const parseConnectionString = (url) => {
  const parsed = new URL(url);
  return {
    user: parsed.username,
    password: parsed.password,
    host: parsed.hostname,
    port: parsed.port || 5432,
    database: parsed.pathname.slice(1), // Remove leading slash
    ssl: { rejectUnauthorized: false }
  };
};

// PostgreSQL connection - parse DATABASE_URL explicitly
const pool = new Pool(
  process.env.DATABASE_URL 
    ? parseConnectionString(process.env.DATABASE_URL)
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
        ssl: { rejectUnauthorized: false }
      }
);

console.log('Connecting to host:', process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : process.env.DB_HOST);

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL database:', err);
  } else {
    console.log('Successfully connected to PostgreSQL database');
    release();
  }
});

// Helper functions for database operations
const getUserData = async (userId = 1) => {
    // Query all required data for the dashboard
    console.log('getUserData called with userId:', userId);
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0] || {};
    const goalsResult = await pool.query('SELECT * FROM goals WHERE user_id = $1', [userId]);
    const scheduleResult = await pool.query('SELECT * FROM schedule_events WHERE user_id = $1', [userId]);
    const workoutResult = await pool.query('SELECT * FROM workout_log WHERE user_id = $1', [userId]);
    const eatingGoalsResult = await pool.query('SELECT * FROM eating_goals WHERE user_id = $1', [userId]);
    const calendarResult = await pool.query('SELECT * FROM calendar_events WHERE user_id = $1', [userId]);
    
    // Get user preferences and daily schedules for scheduling assistant
    const userPreferencesResult = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    const todayScheduleResult = await pool.query('SELECT * FROM daily_schedules WHERE user_id = $1 AND date = CURRENT_DATE', [userId]);
    const tomorrowScheduleResult = await pool.query('SELECT * FROM daily_schedules WHERE user_id = $1 AND date = CURRENT_DATE + INTERVAL \'1 day\'', [userId]);
    
    console.log('Raw calendarResult.rows:', calendarResult.rows);
    // Debug: print type and value of start_time for each event
    if (calendarResult.rows && calendarResult.rows.length > 0) {
      calendarResult.rows.forEach((e, i) => {
        console.log(`calendarEvent[${i}]: id=${e.id}, start_time=`, e.start_time, 'type:', typeof e.start_time);
      });
    }
    const newsResult = await pool.query('SELECT * FROM news_articles ORDER BY fetched_at DESC LIMIT 10');

    const goals = goalsResult.rows;
    const shortTermGoals = goals.filter(g => g.type === 'shortTerm');
    const longTermGoals = goals.filter(g => g.type === 'longTerm');

    // Convert start_time and end_time to ISO strings, then filter and sort
    const calendarEvents = (calendarResult.rows || [])
      .map(e => ({
        ...e,
        start_time: e.start_time instanceof Date ? e.start_time.toISOString() : e.start_time,
        end_time: e.end_time instanceof Date && e.end_time !== null ? e.end_time.toISOString() : e.end_time
      }))
      .filter(e => e && typeof e.start_time === 'string' && !isNaN(Date.parse(e.start_time)))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    return {
      goals: {
        shortTerm: shortTermGoals,
        longTerm: longTermGoals
      },
      schedule: scheduleResult.rows,
      workoutLog: workoutResult.rows,
      eatingGoals: eatingGoalsResult.rows,
      news: newsResult.rows,
      calendar: calendarEvents,
      userPreferences: userPreferencesResult.rows[0] || null,
      todaySchedule: todayScheduleResult.rows[0] || null,
      tomorrowSchedule: tomorrowScheduleResult.rows[0] || null,
      level: user?.level || 1,
      xp: user?.xp || 0,
      maxXp: user?.max_xp || 1000
    };
}

// AI-powered schedule generation function
const generateAISchedule = async (userId, date) => {
  try {
    // Get user preferences, goals, existing calendar events
    const userPrefs = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    const activeGoals = await pool.query('SELECT * FROM goals WHERE user_id = $1 AND completed = false', [userId]);
    const calendarEvents = await pool.query('SELECT * FROM calendar_events WHERE user_id = $1 AND start_time::date = $2', [userId, date]);
    const recentSchedules = await pool.query('SELECT * FROM daily_schedules WHERE user_id = $1 ORDER BY date DESC LIMIT 7', [userId]);
    
    const userPreferences = userPrefs.rows[0];
    const goals = activeGoals.rows;
    const existingEvents = calendarEvents.rows;
    const scheduleHistory = recentSchedules.rows;

    // If no preferences set yet, return basic template
    if (!userPreferences) {
      return {
        message: "Please set up your daily routine preferences first by telling me about your typical day (wake time, work hours, preferred workout time, etc.)",
        needsSetup: true,
        schedule: []
      };
    }

    // Create time slots (30-minute intervals)
    const schedule = [];
    const startHour = parseInt(userPreferences.wake_time?.split(':')[0] || '7');
    const endHour = parseInt(userPreferences.sleep_time?.split(':')[0] || '23');

    // Generate base routine schedule
    let currentTime = startHour * 60; // Convert to minutes
    const endTime = endHour * 60;

    // Morning routine
    schedule.push({
      time: formatMinutesToTime(currentTime),
      activity: "Morning routine & breakfast",
      type: "routine",
      duration: 60,
      energy_level: "medium"
    });
    currentTime += 60;

    // Work blocks
    const workStart = userPreferences.work_start ? timeToMinutes(userPreferences.work_start) : 9 * 60;
    const workEnd = userPreferences.work_end ? timeToMinutes(userPreferences.work_end) : 17 * 60;

    // Schedule goal-related activities before work
    for (const goal of goals.slice(0, 2)) { // Limit to 2 goals per day
      if (currentTime < workStart - 30) {
        schedule.push({
          time: formatMinutesToTime(currentTime),
          activity: `Work on: ${goal.text}`,
          type: "goal",
          duration: 30,
          energy_level: "high",
          goal_id: goal.id
        });
        currentTime += 30;
      }
    }

    // Work time
    if (currentTime < workStart) currentTime = workStart;
    schedule.push({
      time: formatMinutesToTime(currentTime),
      activity: "Work/Focus time",
      type: "work",
      duration: workEnd - workStart,
      energy_level: "high"
    });
    currentTime = workEnd;

    // Lunch break
    schedule.push({
      time: formatMinutesToTime(currentTime),
      activity: "Lunch break",
      type: "break",
      duration: 60,
      energy_level: "low"
    });
    currentTime += 60;

    // Workout (if preferred time is after work)
    const workoutPref = userPreferences.preferred_workout_time;
    if (workoutPref === 'evening' && currentTime < endTime - 120) {
      schedule.push({
        time: formatMinutesToTime(currentTime),
        activity: "Workout/Exercise",
        type: "fitness",
        duration: 60,
        energy_level: "high"
      });
      currentTime += 60;
    }

    // Personal time / remaining goals
    for (const goal of goals.slice(2, 4)) {
      if (currentTime < endTime - 90) {
        schedule.push({
          time: formatMinutesToTime(currentTime),
          activity: `Personal: ${goal.text}`,
          type: "personal",
          duration: 45,
          energy_level: "medium",
          goal_id: goal.id
        });
        currentTime += 45;
      }
    }

    // Evening routine
    if (currentTime < endTime - 60) {
      schedule.push({
        time: formatMinutesToTime(currentTime),
        activity: "Dinner & evening routine",
        type: "routine",
        duration: 90,
        energy_level: "low"
      });
      currentTime += 90;
    }

    // Wind down time
    schedule.push({
      time: formatMinutesToTime(Math.max(currentTime, endTime - 60)),
      activity: "Wind down & prepare for sleep",
      type: "routine",
      duration: 60,
      energy_level: "low"
    });

    return {
      message: "Generated personalized schedule based on your preferences and goals",
      needsSetup: false,
      schedule: schedule,
      generatedAt: new Date().toISOString(),
      preferences_used: {
        wake_time: userPreferences.wake_time,
        work_hours: `${userPreferences.work_start}-${userPreferences.work_end}`,
        workout_preference: userPreferences.preferred_workout_time
      }
    };

  } catch (error) {
    console.error('Error generating AI schedule:', error);
    return {
      message: "Error generating schedule. Please try again.",
      needsSetup: false,
      schedule: [],
      error: error.message
    };
  }
};

// Helper functions for time conversion
const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};
// Calendar API endpoints
app.post('/api/calendar', async (req, res) => {
  try {
    let { title, description = '', start_time, end_time = null, all_day = false, userId = 1 } = req.body;
    if (!title || !start_time) {
      return res.status(400).json({ error: 'Title and start_time are required.' });
    }
    // Normalize start_time: always use ISO string, set to 00:00:00 for all-day events
    let normalizedStart = start_time;
    if (all_day && typeof start_time === 'string' && start_time.length === 10) {
      // If only date provided, append T00:00:00
      normalizedStart = `${start_time}T00:00:00`;
    } else if (typeof start_time === 'string' && start_time.length === 10) {
      // If not all_day but only date provided, still append T00:00:00
      normalizedStart = `${start_time}T00:00:00`;
    }
    // If already a full ISO string, leave as is
    const result = await pool.query(
      'INSERT INTO calendar_events (user_id, title, description, start_time, end_time, all_day) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, title, description, normalizedStart, end_time, all_day]
    );
    await broadcastDashboardUpdate(userId);
    res.json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

app.put('/api/calendar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, start_time, end_time, all_day = false, userId = 1 } = req.body;
    const result = await pool.query(
      `UPDATE calendar_events SET title=$1, description=$2, start_time=$3, end_time=$4, all_day=$5
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [title, description, start_time, end_time, all_day, id, userId]
    );
    await broadcastDashboardUpdate(userId);
    res.json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

app.delete('/api/calendar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 1 } = req.body;
    const result = await pool.query(
      'DELETE FROM calendar_events WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    await broadcastDashboardUpdate(userId);
    res.json({ success: true, deletedEvent: result.rows[0] });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Join user-specific room (optional, for multi-user support)
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Send initial dashboard data
  socket.on('request-dashboard-data', async (userId = 1) => {
    try {
      const data = await getUserData(userId);
      socket.emit('dashboard-update', data);
    } catch (error) {
      socket.emit('error', { message: 'Failed to fetch dashboard data' });
    }
  });

  // Handle real-time chat
  socket.on('chat-message', (data) => {
    // Broadcast chat message to all clients (or specific room)
    socket.broadcast.emit('chat-message', {
      message: data.message,
      timestamp: new Date(),
      type: 'user'
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to broadcast data updates to all connected clients
const broadcastUpdate = async (eventType, data, userId = null) => {
  if (userId) {
    // Send to specific user's room
    io.to(`user-${userId}`).emit(eventType, data);
  } else {
    // Broadcast to all clients
    io.emit(eventType, data);
  }
};

// Helper function to broadcast dashboard updates
const broadcastDashboardUpdate = async (userId = 1) => {
  try {
    const data = await getUserData(userId);
    broadcastUpdate('dashboard-update', data, userId);
  } catch (error) {
    console.error('Error broadcasting dashboard update:', error);
  }
};

// Helper to fetch news from NewsAPI
const fetchNews = async (topics = ["technology", "artificial intelligence"]) => {
  try {
    console.log("Fetching news with key:", NEWS_API_KEY, "topics:", topics);
    const query = topics.join(" OR ");
    const url = `https://newsapi.org/v2/everything?language=en&q=${encodeURIComponent(query)}&apiKey=${NEWS_API_KEY}`;
    const response = await axios.get(url);
    
    const articles = response.data.articles.slice(0, 5).map(a => ({
      title: a.title,
      source: a.source.name,
      url: a.url,
      topics: topics
    }));

    // Store news in database
    for (const article of articles) {
      await pool.query(
        'INSERT INTO news_articles (title, source, url, topics) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [article.title, article.source, article.url, article.topics]
      );
    }

    // Broadcast news update to all clients
    broadcastUpdate('news-update', articles);

    return articles;
  } catch (err) {
    console.error("Error fetching news:", err.message);
    return [];
  }
};

// Scheduled daily news update at 6am
cron.schedule("0 6 * * *", async () => {
  await fetchNews();
  console.log("News updated at 6am");
});

// Routes
app.get('/api/dashboard-data', async (req, res) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : 1;
    const data = await getUserData(userId);
    res.json(data);
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// News API routes
app.get('/api/news', async (req, res) => {
  try {
    const news = await fetchNews();
    res.json(news);
  } catch (err) {
    console.error('Error in GET /api/news:', err);
    res.status(500).json([]);
  }
});

app.post('/api/news', async (req, res) => {
  try {
    const { topics } = req.body;
    const news = await fetchNews(topics && Array.isArray(topics) ? topics : ["technology", "artificial intelligence"]);
    res.json(news);
  } catch (err) {
    console.error('Error in POST /api/news:', err);
    res.status(500).json([]);
  }
});

// Goals routes
app.post('/api/goals', async (req, res) => {
  try {
    const { type, text, progress = 0, userId = 1 } = req.body;
    
    const result = await pool.query(
      'INSERT INTO goals (user_id, text, type, progress) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, text, type, progress]
    );
    
    // Broadcast dashboard update to all clients
    await broadcastDashboardUpdate(userId);
    
    res.json({ success: true, goal: result.rows[0] });
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Failed to save goal' });
  }
});

app.put('/api/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { completed, progress, text, userId = 1 } = req.body;
    
    const result = await pool.query(
      'UPDATE goals SET completed = $1, progress = $2, text = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [completed, progress, text, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    // Broadcast dashboard update to all clients
    await broadcastDashboardUpdate(userId);
    
    res.json({ success: true, goal: result.rows[0] });
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

app.delete('/api/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 1 } = req.body;
    
    const result = await pool.query('DELETE FROM goals WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    // Broadcast dashboard update to all clients
    await broadcastDashboardUpdate(userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// Schedule routes
app.post('/api/schedule', async (req, res) => {
  try {
    const { time, event, userId = 1 } = req.body;
    
    const result = await pool.query(
      'INSERT INTO schedule_events (user_id, time, event) VALUES ($1, $2, $3) RETURNING *',
      [userId, time, event]
    );
    
    // Broadcast dashboard update to all clients
    await broadcastDashboardUpdate(userId);
    
    res.json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error('Error creating schedule event:', error);
    res.status(500).json({ error: 'Failed to save schedule event' });
  }
});
// Delete schedule route
app.delete('/api/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 1 } = req.body;
    
    const result = await pool.query('DELETE FROM schedule_events WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule event not found' });
    }
    
    // Broadcast dashboard update to all clients
    await broadcastDashboardUpdate(userId);
    
    res.json({ success: true, deletedEvent: result.rows[0] });
  } catch (error) {
    console.error('Error deleting schedule event:', error);
    res.status(500).json({ error: 'Failed to delete schedule event' });
  }
});
// Workout routes
app.post('/api/workout', async (req, res) => {
  try {
    const { type, duration, calories, userId = 1 } = req.body;
    
    // Insert workout
    const workoutResult = await pool.query(
      'INSERT INTO workout_log (user_id, type, duration, calories) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, type, duration, calories]
    );
    
    // Update user XP and level
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    
    let newXp = Math.min(user.xp + 50, user.max_xp);
    let newLevel = user.level;
    let newMaxXp = user.max_xp;
    
    if (newXp >= user.max_xp) {
      newLevel += 1;
      newXp = 0;
      newMaxXp = Math.floor(user.max_xp * 1.2);
    }
    
    await pool.query(
      'UPDATE users SET xp = $1, level = $2, max_xp = $3 WHERE id = $4',
      [newXp, newLevel, newMaxXp, userId]
    );
    
    // Broadcast dashboard update to all clients
    await broadcastDashboardUpdate(userId);
    
    res.json({ 
      success: true, 
      workout: workoutResult.rows[0], 
      level: newLevel, 
      xp: newXp 
    });
  } catch (error) {
    console.error('Error saving workout:', error);
    res.status(500).json({ error: 'Failed to save workout' });
  }
});

// Enhanced Chat endpoint with WebSocket broadcasting
app.post('/chat', async (req, res) => {
  const { message, userId = 1 } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    // Broadcast user message to all connected clients
    broadcastUpdate('chat-message', {
      message,
      timestamp: new Date(),
      type: 'user',
      userId
    });

    // Get current dashboard data to provide context to AI
    const dashboardData = await getUserData(userId);
    
    // Create a system prompt that gives the AI context about the dashboard, including actual data
    const systemPrompt = `You are A.S.A.D (AI-powered Smart Assistant for Dashboard), a productivity assistant that helps users manage their dashboard and personal scheduling.

CRITICAL: When users ask you to ADD, DELETE, UPDATE, or COMPLETE goals/schedules/workouts/calendar events, you MUST respond with ONLY the JSON action object on the FIRST line, followed by your message.

Current dashboard state:
Short-term goals:
${dashboardData.goals.shortTerm.map(g => `- ID:${g.id} "${g.text}" (${g.progress}%) ${g.completed ? '[COMPLETED]' : ''}`).join('\n')}

Long-term goals:
${dashboardData.goals.longTerm.map(g => `- ID:${g.id} "${g.text}" (${g.progress}%) ${g.completed ? '[COMPLETED]' : ''}`).join('\n')}

Current schedule:
${dashboardData.schedule.map(e => `- ID:${e.id} | ${e.time}: ${e.event}`).join('\n') || 'No events scheduled'}

Calendar events:
${(dashboardData.calendar || []).filter(e => e && typeof e.start_time === 'string').map(e => `- ID:${e.id} | ${e.start_time.slice(0,10)}: ${e.title}`).join('\n') || 'No calendar events'}

SCHEDULING ASSISTANT STATUS:
User Preferences: ${dashboardData.userPreferences ? 
  `✓ Configured - Wake: ${dashboardData.userPreferences.wake_time}, Work: ${dashboardData.userPreferences.work_start}-${dashboardData.userPreferences.work_end}, Workout: ${dashboardData.userPreferences.preferred_workout_time}` : 
  '⚠ Not configured - User needs to set up daily routine preferences'}

Today's AI Schedule: ${dashboardData.todaySchedule ? 
  `✓ Generated (${dashboardData.todaySchedule.generated_schedule ? JSON.parse(dashboardData.todaySchedule.generated_schedule).schedule?.length || 0 : 0} activities)` : 
  '⚠ No schedule generated for today'}

Tomorrow's AI Schedule: ${dashboardData.tomorrowSchedule ? 
  `✓ Generated (${dashboardData.tomorrowSchedule.generated_schedule ? JSON.parse(dashboardData.tomorrowSchedule.generated_schedule).schedule?.length || 0 : 0} activities)` : 
  '⚠ No schedule generated for tomorrow'}

Workout log entries: ${dashboardData.workoutLog.length} workouts
User level: ${dashboardData.level} (${dashboardData.xp}/${dashboardData.maxXp} XP)

REQUIRED JSON ACTIONS (use EXACTLY this format on first line):

CALENDAR ACTIONS:
When user wants to add a calendar event:
{"action": "add_calendar_event", "title": "event title", "date": "YYYY-MM-DD", "description": "optional description", "all_day": true/false}

When user wants to delete a calendar event:
{"action": "delete_calendar_event", "id": specific_event_id_number}

GOAL ACTIONS:
When user wants to add a goal:
{"action": "add_goal", "type": "shortTerm", "text": "exact goal text", "progress": 0}

When user wants to delete a goal:
{"action": "delete_goal", "id": specific_goal_id_number}

When user wants to complete/update a goal:
{"action": "update_goal", "id": specific_goal_id_number, "completed": true, "progress": 100}

SCHEDULE ACTIONS:
When user wants to add to schedule:
{"action": "add_schedule", "time": "specific time", "event": "event description"}

When user wants to delete a schedule event:
{"action": "delete_schedule", "id": specific_schedule_id_number}

SCHEDULING ASSISTANT ACTIONS:
When user wants to set up their daily routine (first time or updating preferences):
{"action": "setup_routine", "wake_time": "07:00", "sleep_time": "23:00", "work_start": "09:00", "work_end": "17:00", "workout_preference": "morning/evening", "meal_times": ["08:00", "12:00", "19:00"]}

When user asks to generate tomorrow's schedule or wants a new daily schedule:
{"action": "generate_schedule", "date": "YYYY-MM-DD", "consider_goals": true}

When user wants to review/modify an existing generated schedule:
{"action": "modify_schedule", "date": "YYYY-MM-DD", "changes": "description of requested changes"}

When user provides feedback on how their day went (for AI learning):
{"action": "schedule_feedback", "date": "YYYY-MM-DD", "completed_activities": ["activity1", "activity2"], "missed_activities": ["activity3"], "satisfaction": 8, "feedback": "user comments about the day"}

WORKOUT ACTIONS:
When user wants to log a workout:
{"action": "add_workout", "type": "workout type", "duration": minutes, "calories": number}

SCHEDULING ASSISTANT BEHAVIOR:
1. If user hasn't set up preferences, guide them through setup first
2. Generate intelligent schedules based on goals, preferences, and past patterns  
3. Always include buffer time between activities (15-30 minutes)
4. Respect user's energy patterns (high-energy tasks when they're most alert)
5. Automatically schedule time for uncompleted goals
6. Learn from user feedback to improve future schedules
7. During daily check-ins, review today's completion and generate tomorrow's schedule

CRITICAL RULES:
1. Always identify correct IDs from the lists above
2. Put JSON on the very first line of your response
3. NEVER show JSON to the user in your visible response
4. When performing actions, respond with friendly natural language
5. For general conversation, respond normally WITHOUT any JSON
6. Be proactive about suggesting schedule improvements and optimizations

EXAMPLES:

User: "I want to set up my daily routine"
Response: {"action": "setup_routine", "wake_time": "07:00", "sleep_time": "23:00", "work_start": "09:00", "work_end": "17:00", "workout_preference": "morning", "meal_times": ["08:00", "12:00", "19:00"]}
Great! I'd love to help you set up your daily routine. What time do you typically wake up and go to sleep? When do you work? And do you prefer working out in the morning or evening?

User: "Generate my schedule for tomorrow"
Response: {"action": "generate_schedule", "date": "2025-08-24", "consider_goals": true}
I'll create a personalized schedule for tomorrow based on your routine, goals, and preferences!

User: "How did my schedule work today? I completed my workout and the marketing goal but missed the reading time"
Response: {"action": "schedule_feedback", "date": "2025-08-23", "completed_activities": ["workout", "marketing goal"], "missed_activities": ["reading time"], "satisfaction": 7, "feedback": "completed workout and marketing goal but missed reading time"}
Thanks for the feedback! I can see you completed your workout and marketing goal - great job! I'll adjust future schedules to make reading time more realistic for you.

For general conversation, questions, or greetings, respond normally and motivationally without JSON.`;

    // GROQ API integration with upgraded model
    const groqPayload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ]
    };

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      groqPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        }
      }
    );

    const aiResponse = response.data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
    
    // Broadcast AI response to all connected clients
    broadcastUpdate('chat-message', {
      message: aiResponse,
      timestamp: new Date(),
      type: 'ai',
      userId
    });
    
    // Check if the response contains a JSON action
    let actionFound = false;
    try {
      // Look for JSON at the start of the response (more reliable)
      const firstLineMatch = aiResponse.match(/^\s*\{.*?\}/);
      // Fallback to finding JSON anywhere in the response
      const anywhereMatch = aiResponse.match(/\{[^{}]*"action"[^{}]*\}/);
      
      const actionMatch = firstLineMatch || anywhereMatch;
      
      if (actionMatch) {
        const actionData = JSON.parse(actionMatch[0]);
        console.log('Parsed action:', actionData); // Debug log

        // Add Calendar Event
        if (actionData.action === 'add_calendar_event') {
          actionFound = true;
          // Compose start_time as YYYY-MM-DDT00:00:00
          const start_time = actionData.date ? `${actionData.date}T00:00:00` : null;
          const result = await pool.query(
            'INSERT INTO calendar_events (user_id, title, description, start_time, all_day) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, actionData.title, actionData.description || '', start_time, actionData.all_day ?? true]
          );
          await broadcastDashboardUpdate(userId);
          res.json({
            response: `I've added "${actionData.title}" to your calendar for ${actionData.date}.`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // Delete Calendar Event
        if (actionData.action === 'delete_calendar_event') {
          actionFound = true;
          // Try to delete by ID
          const result = await pool.query(
            'DELETE FROM calendar_events WHERE id = $1 AND user_id = $2 RETURNING *',
            [actionData.id, userId]
          );
          if (result.rows.length === 0) {
            res.json({ response: `Could not find a calendar event with that ID.`, action: actionData });
            return;
          }
          await broadcastDashboardUpdate(userId);
          res.json({
            response: `Your event "${result.rows[0].title}" on ${result.rows[0].start_time.slice(0,10)} has been removed from your calendar.`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // List Calendar Events for a Date
        if (actionData.action === 'list_calendar_events') {
          actionFound = true;
          const date = actionData.date;
          const result = await pool.query(
            'SELECT * FROM calendar_events WHERE user_id = $1 AND start_time >= $2 AND start_time < $3 ORDER BY start_time ASC',
            [userId, `${date}T00:00:00`, `${date}T23:59:59`]
          );
          if (result.rows.length === 0) {
            res.json({ response: `You have no events on ${date}.`, action: actionData, events: [] });
            return;
          }
          const eventList = result.rows.map(e => `- ${e.title}${e.description ? ': ' + e.description : ''}`).join('\n');
          res.json({
            response: `Here are your events for ${date}:\n${eventList}`,
            action: actionData,
            events: result.rows
          });
          return;
        }

        // Add Goal
        if (actionData.action === 'add_goal') {
          actionFound = true;
          const result = await pool.query(
            'INSERT INTO goals (user_id, text, type, progress) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, actionData.text, actionData.type, actionData.progress || 0]
          );
          
          await broadcastDashboardUpdate(userId);
          
          res.json({ 
            response: `Great! I've added "${actionData.text}" to your ${actionData.type} goals. Keep up the great work!`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // Add Schedule
        if (actionData.action === 'add_schedule') {
          actionFound = true;
          const result = await pool.query(
            'INSERT INTO schedule_events (user_id, time, event) VALUES ($1, $2, $3) RETURNING *',
            [userId, actionData.time, actionData.event]
          );
          
          await broadcastDashboardUpdate(userId);
          
          res.json({ 
            response: `Perfect! I've added "${actionData.event}" at ${actionData.time} to your schedule.`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // Delete Schedule - Enhanced with better error handling and fuzzy matching
        if (actionData.action === 'delete_schedule') {
          actionFound = true;
          console.log('Attempting to delete schedule with ID:', actionData.id);
          
          // First try exact ID match
          let checkResult = await pool.query(
            'SELECT * FROM schedule_events WHERE id = $1 AND user_id = $2',
            [actionData.id, userId]
          );
          
          // If exact ID doesn't work, try fuzzy matching
          if (checkResult.rows.length === 0) {
            console.log('Exact ID not found, trying fuzzy matching...');
            
            // Get recent schedule events to find a match
            const recentEvents = await pool.query(
              'SELECT * FROM schedule_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
              [userId]
            );
            
            // Look for recently added events that match the pattern (more flexible matching)
            const possibleMatches = recentEvents.rows.filter(event => {
              const eventLower = event.event.toLowerCase();
              const timeLower = event.time.toLowerCase();
              
              // Match common time patterns
              const timePatterns = ['4:00', '4am', '04:', 'morning', 'afternoon', 'evening'];
              const timeMatch = timePatterns.some(pattern => timeLower.includes(pattern));
              
              // Match common event types
              const eventPatterns = ['meeting', 'appointment', 'call', 'lunch', 'dinner'];
              const eventMatch = eventPatterns.some(pattern => eventLower.includes(pattern));
              
              return timeMatch || eventMatch;
            });
            
            if (possibleMatches.length > 0) {
              checkResult = { rows: [possibleMatches[0]] };
              console.log('Found fuzzy match:', possibleMatches[0]);
            }
          }
          
          if (checkResult.rows.length === 0) {
            // Show current schedule when event not found
            const currentSchedule = await pool.query(
              'SELECT * FROM schedule_events WHERE user_id = $1 ORDER BY created_at DESC',
              [userId]
            );
            
            const scheduleList = currentSchedule.rows.map(e => `ID:${e.id} | ${e.time}: ${e.event}`).join('\n') || 'No events scheduled';
            
            res.json({ 
              response: `I couldn't find that schedule event. Here's your current schedule:\n\n${scheduleList}\n\nPlease specify which event to remove.`,
              action: actionData,
              error: "Event not found",
              currentSchedule: currentSchedule.rows
            });
            return;
          }
          
          // Use the correct ID from the found event
          const eventToDelete = checkResult.rows[0];
          const result = await pool.query(
            'DELETE FROM schedule_events WHERE id = $1 AND user_id = $2 RETURNING *',
            [eventToDelete.id, userId]
          );
          
          await broadcastDashboardUpdate(userId);
          
          res.json({ 
            response: `Successfully removed "${result.rows[0].event}" at ${result.rows[0].time}.`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // Add Workout
        if (actionData.action === 'add_workout') {
          actionFound = true;
          const workoutResult = await pool.query(
            'INSERT INTO workout_log (user_id, type, duration, calories) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, actionData.type, actionData.duration, actionData.calories]
          );

          // Update user XP and level
          const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
          const user = userResult.rows[0];
          
          let newXp = Math.min(user.xp + 50, user.max_xp);
          let newLevel = user.level;
          let newMaxXp = user.max_xp;
          
          if (newXp >= user.max_xp) {
            newLevel += 1;
            newXp = 0;
            newMaxXp = Math.floor(user.max_xp * 1.2);
          }
          
          await pool.query(
            'UPDATE users SET xp = $1, level = $2, max_xp = $3 WHERE id = $4',
            [newXp, newLevel, newMaxXp, userId]
          );

          await broadcastDashboardUpdate(userId);

          res.json({ 
            response: `Excellent! I've logged your ${actionData.type} workout. You're making great progress!`,
            action: actionData,
            data: workoutResult.rows[0],
            level: newLevel,
            xp: newXp
          });
          return;
        }

        // Delete Goal
        if (actionData.action === 'delete_goal') {
          actionFound = true;
          const result = await pool.query(
            'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING *',
            [actionData.id, userId]
          );
          
          if (result.rows.length === 0) {
            res.json({ 
              response: "I couldn't find that goal to delete. It might have already been removed.",
              action: actionData
            });
            return;
          }
          
          await broadcastDashboardUpdate(userId);
          
          res.json({ 
            response: `I've successfully deleted the goal "${result.rows[0].text}". Keep focusing on your other goals!`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // Complete/Update Goal
        if (actionData.action === 'update_goal') {
          actionFound = true;
          const result = await pool.query(
            'UPDATE goals SET completed = $1, progress = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
            [actionData.completed, actionData.progress, actionData.id, userId]
          );
          
          if (result.rows.length === 0) {
            res.json({ 
              response: "I couldn't find that goal to update.",
              action: actionData
            });
            return;
          }
          
          await broadcastDashboardUpdate(userId);
          
          const status = actionData.completed ? 'completed' : `updated to ${actionData.progress}% progress`;
          res.json({ 
            response: `Great! I've ${status} your goal "${result.rows[0].text}".`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // Refresh News
        if (actionData.action === 'refresh_news' && Array.isArray(actionData.topics)) {
          actionFound = true;
          const news = await fetchNews(actionData.topics);
          
          res.json({
            response: `News section updated for topics: ${actionData.topics.join(", ")}`,
            action: actionData,
            news: news
          });
          return;
        }

        // Setup Routine
        if (actionData.action === 'setup_routine') {
          actionFound = true;
          const { preferences } = actionData;
          
          try {
            // Update or insert user preferences
            const existingPrefs = await pool.query(
              'SELECT * FROM user_preferences WHERE user_id = $1',
              [userId]
            );
            
            if (existingPrefs.rows.length > 0) {
              await pool.query(`
                UPDATE user_preferences SET 
                wake_time = $2, sleep_time = $3, work_start = $4, work_end = $5,
                break_duration = $6, focus_time = $7, high_energy_time = $8, low_energy_time = $9,
                exercise_preference = $10, meal_times = $11, priorities = $12, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1
              `, [
                userId, preferences.wake_time, preferences.sleep_time, 
                preferences.work_start, preferences.work_end, preferences.break_duration,
                preferences.focus_time, preferences.high_energy_time, preferences.low_energy_time,
                preferences.exercise_preference, JSON.stringify(preferences.meal_times),
                JSON.stringify(preferences.priorities)
              ]);
            } else {
              await pool.query(`
                INSERT INTO user_preferences 
                (user_id, wake_time, sleep_time, work_start, work_end, break_duration, 
                 focus_time, high_energy_time, low_energy_time, exercise_preference, 
                 meal_times, priorities) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              `, [
                userId, preferences.wake_time, preferences.sleep_time,
                preferences.work_start, preferences.work_end, preferences.break_duration,
                preferences.focus_time, preferences.high_energy_time, preferences.low_energy_time,
                preferences.exercise_preference, JSON.stringify(preferences.meal_times),
                JSON.stringify(preferences.priorities)
              ]);
            }
            
            await broadcastDashboardUpdate(userId);
            
            res.json({
              response: "Perfect! I've saved your routine preferences. I can now generate personalized schedules that work with your lifestyle and energy patterns.",
              action: actionData,
              success: true
            });
            return;
          } catch (error) {
            console.error('Setup routine error:', error);
            res.json({
              response: "I had trouble saving your preferences. Please try again.",
              action: actionData,
              error: error.message
            });
            return;
          }
        }

        // Generate Schedule
        if (actionData.action === 'generate_schedule') {
          actionFound = true;
          const { date, preferences } = actionData;
          
          try {
            // Generate AI schedule
            const schedule = await generateAISchedule(userId, date, preferences);
            
            if (schedule && schedule.length > 0) {
              // Save schedule to database
              await pool.query('DELETE FROM daily_schedules WHERE user_id = $1 AND date = $2', [userId, date]);
              
              for (const activity of schedule) {
                await pool.query(`
                  INSERT INTO daily_schedules (user_id, date, time_slot, activity, priority, energy_level, category)
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [userId, date, activity.time, activity.activity, activity.priority, activity.energy_level, activity.category]);
              }
              
              await broadcastDashboardUpdate(userId);
              
              const scheduleText = schedule.map(s => `${s.time}: ${s.activity}`).join('\n');
              res.json({
                response: `I've generated an optimized schedule for ${date}:\n\n${scheduleText}\n\nThis schedule considers your energy patterns, goals, and preferences. How does this look?`,
                action: actionData,
                schedule: schedule,
                success: true
              });
            } else {
              res.json({
                response: "I had trouble generating your schedule. Please make sure you have preferences set up and goals defined.",
                action: actionData,
                success: false
              });
            }
            return;
          } catch (error) {
            console.error('Generate schedule error:', error);
            res.json({
              response: "I encountered an issue while creating your schedule. Please try again.",
              action: actionData,
              error: error.message
            });
            return;
          }
        }

        // Modify Schedule
        if (actionData.action === 'modify_schedule') {
          actionFound = true;
          const { date, time_slot, new_activity, reason } = actionData;
          
          try {
            const result = await pool.query(`
              UPDATE daily_schedules 
              SET activity = $3, updated_at = CURRENT_TIMESTAMP 
              WHERE user_id = $1 AND date = $2 AND time_slot = $4 
              RETURNING *
            `, [userId, date, new_activity, time_slot]);
            
            if (result.rows.length === 0) {
              res.json({
                response: `I couldn't find a schedule item at ${time_slot} on ${date} to modify.`,
                action: actionData,
                success: false
              });
              return;
            }
            
            await broadcastDashboardUpdate(userId);
            
            res.json({
              response: `I've updated your ${time_slot} activity to "${new_activity}" for ${date}. ${reason ? `Reason: ${reason}` : ''}`,
              action: actionData,
              data: result.rows[0],
              success: true
            });
            return;
          } catch (error) {
            console.error('Modify schedule error:', error);
            res.json({
              response: "I had trouble modifying your schedule. Please try again.",
              action: actionData,
              error: error.message
            });
            return;
          }
        }

        // Schedule Feedback
        if (actionData.action === 'schedule_feedback') {
          actionFound = true;
          const { date, rating, feedback, completed_activities, missed_activities } = actionData;
          
          try {
            await pool.query(`
              INSERT INTO schedule_feedback 
              (user_id, date, rating, feedback, completed_activities, missed_activities)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (user_id, date) DO UPDATE SET
              rating = $3, feedback = $4, completed_activities = $5, 
              missed_activities = $6, updated_at = CURRENT_TIMESTAMP
            `, [
              userId, date, rating, feedback, 
              JSON.stringify(completed_activities), 
              JSON.stringify(missed_activities)
            ]);
            
            await broadcastDashboardUpdate(userId);
            
            let response = `Thank you for the feedback on your ${date} schedule! `;
            if (rating >= 4) {
              response += "I'm glad the schedule worked well for you. I'll use this to make even better schedules.";
            } else if (rating >= 2) {
              response += "I'll adjust future schedules based on your feedback to better match your needs.";
            } else {
              response += "I understand the schedule didn't work well. Let me learn from this to create much better schedules for you.";
            }
            
            res.json({
              response: response,
              action: actionData,
              success: true
            });
            return;
          } catch (error) {
            console.error('Schedule feedback error:', error);
            res.json({
              response: "I had trouble saving your feedback. Please try again.",
              action: actionData,
              error: error.message
            });
            return;
          }
        }
      }
    } catch (parseError) {
      console.log('JSON parsing error:', parseError.message);
      console.log('AI Response that failed to parse:', aiResponse);
    }
    
    // If no action was found or processed, return the normal AI response
    if (!actionFound) {
      res.json({ response: aiResponse });
    }
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get response from AI.' });
  }
});

// ===== SPOTIFY INTEGRATION ROUTES =====

// Start Spotify authentication
app.get('/api/spotify/auth/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { force_reauth } = req.query;
    const authUrl = spotifyService.getAuthUrl(userId, force_reauth === 'true');
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating Spotify auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// Handle Spotify OAuth callback
app.get('/api/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state parameter' });
  }

  try {
    const result = await spotifyService.handleCallback(code, state);
    
    if (result.success) {
      // Support multiple frontend origins for development flexibility
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}?spotify_auth=success`);
    } else {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}?spotify_auth=error`);
    }
  } catch (error) {
    console.error('Error in Spotify callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}?spotify_auth=error`);
  }
});

// Get Song of the Day
app.get('/api/spotify/song-of-the-day/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const songOfTheDay = await spotifyService.getSongOfTheDay(userId);
    
    if (songOfTheDay) {
      // Get additional track info including preview
      const trackInfo = await spotifyService.getTrackPlaybackInfo(userId, songOfTheDay.id);
      
      res.json({
        success: true,
        song: {
          ...songOfTheDay,
          ...trackInfo
        }
      });
    } else {
      res.json({ 
        success: false, 
        error: 'No music data available',
        message: 'This account needs more Spotify listening history. Try listening to music on Spotify first, or switch to a different account.',
        needsMoreMusic: true
      });
    }
  } catch (error) {
    console.error('Error getting song of the day:', error);
    
    if (error.message.includes('not authenticated')) {
      res.status(401).json({ 
        error: 'User not authenticated with Spotify',
        needsAuth: true
      });
    } else {
      res.status(500).json({ error: 'Failed to get song of the day' });
    }
  }
});

// Get user's Spotify statistics
app.get('/api/spotify/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = 'medium_term' } = req.query;
    
    const [topTracks, topArtists, recentlyPlayed] = await Promise.all([
      spotifyService.getTopTracks(userId, timeRange, 10),
      spotifyService.getTopArtists(userId, timeRange, 10),
      spotifyService.getRecentlyPlayed(userId, 10)
    ]);

    res.json({
      success: true,
      stats: {
        topTracks: topTracks.map(track => ({
          id: track.id,
          name: track.name,
          artists: track.artists.map(artist => artist.name),
          album: track.album.name,
          preview_url: track.preview_url,
          external_urls: track.external_urls,
          images: track.album.images
        })),
        topArtists: topArtists.map(artist => ({
          id: artist.id,
          name: artist.name,
          genres: artist.genres,
          popularity: artist.popularity,
          images: artist.images,
          external_urls: artist.external_urls
        })),
        recentlyPlayed: recentlyPlayed.map(item => ({
          track: {
            id: item.track.id,
            name: item.track.name,
            artists: item.track.artists.map(artist => artist.name),
            album: item.track.album.name,
            preview_url: item.track.preview_url,
            external_urls: item.track.external_urls,
            images: item.track.album.images
          },
          played_at: item.played_at
        }))
      }
    });
  } catch (error) {
    console.error('Error getting Spotify stats:', error);
    
    if (error.message.includes('not authenticated')) {
      res.status(401).json({ 
        error: 'User not authenticated with Spotify',
        needsAuth: true
      });
    } else {
      res.status(500).json({ error: 'Failed to get Spotify statistics' });
    }
  }
});

// Get user's Spotify access token for Web Playback SDK
app.get('/api/spotify/token/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Getting access token for user ${userId}`);
    
    // Ensure we have a valid token
    await spotifyService.ensureValidToken(userId);
    
    // Get the current access token
    const tokenData = spotifyService.getUserToken(userId);
    
    if (!tokenData || !tokenData.accessToken) {
      console.log(`No token found for user ${userId}`);
      return res.status(401).json({ 
        success: false,
        error: 'User not authenticated with Spotify',
        needsAuth: true
      });
    }
    
    console.log(`Returning access token for user ${userId}`);
    res.json({
      success: true,
      access_token: tokenData.accessToken,
      expires_at: tokenData.expiresAt
    });
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    
    if (error.message.includes('not authenticated')) {
      res.status(401).json({ 
        success: false,
        error: 'User not authenticated with Spotify',
        needsAuth: true
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to get access token' 
      });
    }
  }
});

// Transfer playback to Web Playback SDK
app.post('/api/spotify/transfer-playback/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { device_id } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    const result = await spotifyService.transferPlayback(userId, device_id);
    
    res.json({
      success: true,
      message: 'Playback transferred to web player'
    });
  } catch (error) {
    console.error('Error transferring playback:', error);
    res.status(500).json({ error: 'Failed to transfer playback' });
  }
});

// Play a specific track
app.post('/api/spotify/play/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { track_uri, device_id } = req.body;
    
    if (!track_uri) {
      return res.status(400).json({ error: 'Track URI is required' });
    }
    
    const result = await spotifyService.playTrack(userId, track_uri, device_id);
    
    res.json({
      success: true,
      message: 'Track started playing'
    });
  } catch (error) {
    console.error('Error playing track:', error);
    res.status(500).json({ error: 'Failed to play track' });
  }
});

// Pause playback
app.post('/api/spotify/pause/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { device_id } = req.body;
    
    await spotifyService.pausePlayback(userId, device_id);
    
    res.json({
      success: true,
      message: 'Playback paused'
    });
  } catch (error) {
    console.error('Error pausing playback:', error);
    res.status(500).json({ error: 'Failed to pause playback' });
  }
});

// Resume playback
app.post('/api/spotify/resume/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { device_id } = req.body;
    
    await spotifyService.resumePlayback(userId, device_id);
    
    res.json({
      success: true,
      message: 'Playback resumed'
    });
  } catch (error) {
    console.error('Error resuming playback:', error);
    res.status(500).json({ error: 'Failed to resume playback' });
  }
});

// Check user's authentication status
app.get('/api/spotify/auth-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const hasPremium = await spotifyService.checkUserPremium(userId);
    
    res.json({
      authenticated: true,
      premium: hasPremium
    });
  } catch (error) {
    res.json({
      authenticated: false,
      premium: false
    });
  }
});

// Manually refresh song of the day
app.post('/api/spotify/refresh-song/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const songOfTheDay = await spotifyService.getSongOfTheDay(userId);
    
    if (songOfTheDay) {
      const trackInfo = await spotifyService.getTrackPlaybackInfo(userId, songOfTheDay.id);
      
      // Broadcast update to all connected clients
      broadcastUpdate('song-update', {
        song: {
          ...songOfTheDay,
          ...trackInfo
        }
      });
      
      res.json({
        success: true,
        song: {
          ...songOfTheDay,
          ...trackInfo
        }
      });
    } else {
      res.json({ 
        success: false, 
        error: 'No song could be selected' 
      });
    }
  } catch (error) {
    console.error('Error refreshing song of the day:', error);
    res.status(500).json({ error: 'Failed to refresh song of the day' });
  }
});

// Disconnect/logout from Spotify
app.post('/api/spotify/disconnect/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Remove user tokens from memory/database
    const result = spotifyService.disconnectUser(userId);
    
    res.json({
      success: true,
      message: 'Successfully disconnected from Spotify'
    });
  } catch (error) {
    console.error('Error disconnecting from Spotify:', error);
    res.status(500).json({ error: 'Failed to disconnect from Spotify' });
  }
});

// Use server.listen instead of app.listen for WebSocket support
server.listen(PORT, () => {
  console.log(`AI Assistant backend with WebSocket support running on port ${PORT}`);
});