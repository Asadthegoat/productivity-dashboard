
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from "cors";
import pkg from 'pg';
import cron from "node-cron";
import { createServer } from 'http';
import { Server } from 'socket.io';

const { Pool } = pkg;
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.use(cors());
app.use(express.json());

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
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    const goalsResult = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    const scheduleResult = await pool.query(
      'SELECT * FROM schedule_events WHERE user_id = $1 ORDER BY event_date, time',
      [userId]
    );
    
    const workoutResult = await pool.query(
      'SELECT * FROM workout_log WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );

    const eatingGoalsResult = await pool.query(
      'SELECT * FROM eating_goals WHERE user_id = $1',
      [userId]
    );

    const newsResult = await pool.query(
      'SELECT * FROM news_articles ORDER BY fetched_at DESC LIMIT 10'
    );

    const goals = goalsResult.rows;
    const shortTermGoals = goals.filter(g => g.type === 'shortTerm');
    const longTermGoals = goals.filter(g => g.type === 'longTerm');

    return {
      goals: {
        shortTerm: shortTermGoals,
        longTerm: longTermGoals
      },
      schedule: scheduleResult.rows,
      workoutLog: workoutResult.rows,
      eatingGoals: eatingGoalsResult.rows,
      news: newsResult.rows,
      level: user?.level || 1,
      xp: user?.xp || 0,
      maxXp: user?.max_xp || 1000
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

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
    const data = await getUserData();
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
    const systemPrompt = `You are A.S.A.D (AI-powered Smart Assistant for Dashboard), a productivity assistant that helps users manage their dashboard.

CRITICAL: When users ask you to ADD, DELETE, UPDATE, or COMPLETE goals/schedules/workouts, you MUST respond with ONLY the JSON action object on the FIRST line, followed by your message.

Current dashboard state:
Short-term goals:
${dashboardData.goals.shortTerm.map(g => `- ID:${g.id} "${g.text}" (${g.progress}%) ${g.completed ? '[COMPLETED]' : ''}`).join('\n')}

Long-term goals:
${dashboardData.goals.longTerm.map(g => `- ID:${g.id} "${g.text}" (${g.progress}%) ${g.completed ? '[COMPLETED]' : ''}`).join('\n')}

Current schedule:
${dashboardData.schedule.map(e => `- ID:${e.id} | ${e.time}: ${e.event}`).join('\n') || 'No events scheduled'}

Workout log entries: ${dashboardData.workoutLog.length} workouts
User level: ${dashboardData.level} (${dashboardData.xp}/${dashboardData.maxXp} XP)

REQUIRED JSON ACTIONS (use EXACTLY this format on first line):

When user wants to add a goal:
{"action": "add_goal", "type": "shortTerm", "text": "exact goal text", "progress": 0}

When user wants to add a long term goal:
{"action": "add_goal", "type": "longTerm", "text": "exact goal text", "progress": 0}

When user wants to delete a goal (identify the exact ID from the list above):
{"action": "delete_goal", "id": specific_goal_id_number}

When user wants to complete/update a goal:
{"action": "update_goal", "id": specific_goal_id_number, "completed": true, "progress": 100}

When user wants to add to schedule:
{"action": "add_schedule", "time": "specific time", "event": "event description"}

When user wants to delete/remove/cancel a schedule event:
- First try to match by ID if one is visible in the current schedule list
- If no exact ID match, look for the most recently added event that matches the description
- Look for time matches (4am, 4:00, morning) and event matches (meeting, appointment, etc.)
{"action": "delete_schedule", "id": specific_schedule_id_number}

When user wants to log a workout:
{"action": "add_workout", "type": "workout type", "duration": minutes, "calories": number}

CRITICAL RULES:
1. Always identify the correct ID from the lists above
2. For schedule deletions, look for keywords like: delete, remove, cancel, clear
3. Match events by time, event name, or both
4. If multiple events match, ask for clarification
5. Put JSON on the very first line of your response
6. NEVER show JSON to the user in your visible response - JSON is for system processing only
7. When performing actions, respond with friendly natural language explaining what you did
8. If user asks "what can you do" or general questions, respond conversationally WITHOUT any JSON

SCHEDULE DELETION STRATEGY:
- If user just added an event and immediately wants to delete it, it's likely the most recent event
- Match by time: "4am meeting" = look for events around 4:00 AM
- Match by event type: "meeting" = look for events containing "meeting"
- Always use the actual ID from the current schedule list when possible

EXAMPLES:
User: "Delete my 3pm meeting" (when schedule shows "ID:5 | 3:00 PM: meeting")
Response: {"action": "delete_schedule", "id": 5}
I'll remove your 3pm meeting from the schedule.

User: "Cancel the dentist appointment" (when schedule shows "ID:8 | 2:00 PM: dentist appointment")  
Response: {"action": "delete_schedule", "id": 8}
Your dentist appointment has been cancelled and removed from your schedule.

User: "What can you help me with?"
Response: I can help you manage your goals, schedule, and workouts! You can ask me to add or remove items, complete goals, log workouts, and more. What would you like to do today?

User: "How are you doing?"
Response: I'm doing great and ready to help you stay productive! How can I assist you with your dashboard today?

IMPORTANT: Only use JSON for action commands (add, delete, complete, etc.). For questions, greetings, or general conversation, respond normally without any JSON.

For general conversation (not actions), respond normally and motivationally without JSON.`;

    // GROQ API integration
    const groqPayload = {
      model: "llama3-8b-8192",
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

// Use server.listen instead of app.listen for WebSocket support
server.listen(PORT, () => {
  console.log(`AI Assistant backend with WebSocket support running on port ${PORT}`);
});