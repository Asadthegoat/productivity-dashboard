/* import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from "cors";
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
app.use(cors());
console.log('Gemini API Key:', GEMINI_API_KEY);

app.use(express.json());

// Data storage (in production, use a proper database)
const DATA_FILE = path.join(process.cwd(), 'dashboard-data.json');
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  const initialData = {
    goals: {
      shortTerm: [],
      longTerm: []
    },
    schedule: [],
    workoutLog: [],
    eatingGoals: [],
    news: [],
    level: 8,
    xp: 2250,
    maxXp: 3000
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}
// Helper to fetch news from NewsAPI
const fetchNews = async (topics = ["technology", "artificial intelligence"]) => {
  try {
    console.log("Fetching news with key:", NEWS_API_KEY, "topics:", topics);
    const query = topics.join(" OR ");
    const url = `https://newsapi.org/v2/everything?language=en&q=${encodeURIComponent(query)}&apiKey=${NEWS_API_KEY}`;
    const response = await axios.get(url);
    console.log("NewsAPI response:", response.data);
    const articles = response.data.articles.slice(0, 5).map(a => ({
      title: a.title,
      source: a.source.name,
      url: a.url
    }));
    return articles;
  } catch (err) {
    console.error("Error fetching news:", err.message);
    return [];
  }
};

// Scheduled daily news update at 6am
import cron from "node-cron";
cron.schedule("0 6 * * *", async () => {
  const data = readData();
  data.news = await fetchNews();
  writeData(data);
  console.log("News updated at 6am");
});
// News API route
app.get('/api/news', async (req, res) => {
  try {
    // Always fetch fresh news for GET requests
    const news = await fetchNews();
    res.json(news);
  } catch (err) {
    console.error('Error in GET /api/news:', err);
    res.status(500).json([]);
  }
});

app.post('/api/news', async (req, res) => {
  const { topics } = req.body;
  const data = readData();
  data.news = await fetchNews(topics && Array.isArray(topics) ? topics : ["technology", "artificial intelligence"]);
  writeData(data);
  res.json(data.news);
});

// Helper functions
const readData = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return {
      goals: { shortTerm: [], longTerm: [] },
      schedule: [],
      workoutLog: [],
      eatingGoals: [],
      level: 8,
      xp: 2250,
      maxXp: 3000
    };
  }
};

const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
};

// Routes
app.get('/api/dashboard-data', (req, res) => {
  const data = readData();
  res.json(data);
});

app.post('/api/goals', (req, res) => {
  const { type, text, progress = 0 } = req.body;
  const data = readData();
  
  const newGoal = {
    id: Date.now(),
    text,
    completed: false,
    progress,
    createdAt: new Date().toISOString()
  };
  
  if (type === 'shortTerm') {
    data.goals.shortTerm.push(newGoal);
  } else if (type === 'longTerm') {
    data.goals.longTerm.push(newGoal);
  }
  
  if (writeData(data)) {
    res.json({ success: true, goal: newGoal });
  } else {
    res.status(500).json({ error: 'Failed to save goal' });
  }
});

app.put('/api/goals/:id', (req, res) => {
  const { id } = req.params;
  const { completed, progress, text } = req.body;
  const data = readData();
  
  // Find and update goal in both short and long term arrays
  let found = false;
  
  data.goals.shortTerm = data.goals.shortTerm.map(goal => {
    if (goal.id == id) {
      found = true;
      return { ...goal, completed, progress, text };
    }
    return goal;
  });
  
  if (!found) {
    data.goals.longTerm = data.goals.longTerm.map(goal => {
      if (goal.id == id) {
        found = true;
        return { ...goal, completed, progress, text };
      }
      return goal;
    });
  }
  
  if (writeData(data)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

app.delete('/api/goals/:id', (req, res) => {
  const { id } = req.params;
  const data = readData();
  
  data.goals.shortTerm = data.goals.shortTerm.filter(goal => goal.id != id);
  data.goals.longTerm = data.goals.longTerm.filter(goal => goal.id != id);
  
  if (writeData(data)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

app.post('/api/schedule', (req, res) => {
  const { time, event } = req.body;
  const data = readData();
  
  const newEvent = {
    id: Date.now(),
    time,
    event,
    createdAt: new Date().toISOString()
  };
  
  data.schedule.push(newEvent);
  
  if (writeData(data)) {
    res.json({ success: true, event: newEvent });
  } else {
    res.status(500).json({ error: 'Failed to save schedule event' });
  }
});

app.post('/api/workout', (req, res) => {
  const { type, duration, calories } = req.body;
  const data = readData();
  
  const newWorkout = {
    id: Date.now(),
    type,
    duration,
    calories,
    date: new Date().toISOString()
  };
  
  data.workoutLog.push(newWorkout);
  
  // Add XP for workout completion
  data.xp = Math.min(data.xp + 50, data.maxXp);
  if (data.xp >= data.maxXp) {
    data.level += 1;
    data.xp = 0;
    data.maxXp = Math.floor(data.maxXp * 1.2);
  }
  
  if (writeData(data)) {
    res.json({ success: true, workout: newWorkout, level: data.level, xp: data.xp });
  } else {
    res.status(500).json({ error: 'Failed to save workout' });
  }
});

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    // Get current dashboard data to provide context to AI
    const dashboardData = readData();
    
    // Create a system prompt that gives the AI context about the dashboard, including actual data
    const systemPrompt = `You are A.S.A.D (AI-powered Smart Assistant for Dashboard), a productivity assistant that helps users manage their dashboard. You can:

1. Add, update, and delete goals (both short-term and long-term)
2. Add schedule events
3. Log workouts
4. Provide motivational advice
5. Help with productivity tips

Current dashboard state:
Short-term goals:
${dashboardData.goals.shortTerm.map(g => `- ${g.text} (${g.progress}%)`).join('\n')}

Long-term goals:
${dashboardData.goals.longTerm.map(g => `- ${g.text} (${g.progress}%)`).join('\n')}

Today's schedule:
${dashboardData.schedule.map(e => `- ${e.time}: ${e.event} [${e.type || ''}]`).join('\n')}

Workout log entries: ${dashboardData.workoutLog.length} workouts
User level: ${dashboardData.level} (${dashboardData.xp}/${dashboardData.maxXp} XP)

When users ask to add goals, schedule events, or log workouts, respond with a JSON action object like:
{"action": "add_goal", "type": "shortTerm", "text": "goal text", "progress": 0}

For schedule: {"action": "add_schedule", "time": "9:00 AM", "event": "Team Meeting"}

For workout: {"action": "add_workout", "type": "Cardio", "duration": 30, "calories": 200}

For regular conversation, just respond normally. Always be helpful and motivational!`;

    // GROQ API integration
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const groqPayload = {
      model: "llama3-8b-8192", // or another Groq-supported model
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
    
    // Check if the response contains a JSON action
    try {
      const actionMatch = aiResponse.match(/\{.*\}/s);
      if (actionMatch) {
        const actionData = JSON.parse(actionMatch[0]);
        const data = readData();

        // Add Goal
        if (actionData.action === 'add_goal') {
          const newGoal = {
            id: Date.now(),
            text: actionData.text,
            completed: false,
            progress: actionData.progress || 0,
            createdAt: new Date().toISOString()
          };
          if (actionData.type === 'shortTerm') {
            data.goals.shortTerm.push(newGoal);
          } else if (actionData.type === 'longTerm') {
            data.goals.longTerm.push(newGoal);
          }
          if (writeData(data)) {
            res.json({ 
              response: `Great! I've added "${actionData.text}" to your ${actionData.type} goals. Keep up the great work!`,
              action: actionData,
              data: newGoal
            });
            return;
          }
        }

        // Add Schedule
        if (actionData.action === 'add_schedule') {
          const newEvent = {
            id: Date.now(),
            time: actionData.time,
            event: actionData.event,
            createdAt: new Date().toISOString()
          };
          data.schedule.push(newEvent);
          if (writeData(data)) {
            res.json({ 
              response: `Perfect! I've added "${actionData.event}" at ${actionData.time} to your schedule.`,
              action: actionData,
              data: newEvent
            });
            return;
          }
        }

        // Add Workout
        if (actionData.action === 'add_workout') {
          const newWorkout = {
            id: Date.now(),
            type: actionData.type,
            duration: actionData.duration,
            calories: actionData.calories,
            date: new Date().toISOString()
          };
          data.workoutLog.push(newWorkout);

          // Add XP for workout completion
          data.xp = Math.min(data.xp + 50, data.maxXp);
          if (data.xp >= data.maxXp) {
            data.level += 1;
            data.xp = 0;
            data.maxXp = Math.floor(data.maxXp * 1.2);
          }

          if (writeData(data)) {
            res.json({ 
              response: `Excellent! I've logged your ${actionData.type} workout. You're making great progress!`,
              action: actionData,
              data: newWorkout,
              level: data.level,
              xp: data.xp
            });
            return;
          }
        }

        // Refresh News (AI-triggered)
        if (actionData.action === 'refresh_news' && Array.isArray(actionData.topics)) {
          data.news = await fetchNews(actionData.topics);
          
          writeData(data);
          res.json({
            response: `News section updated for topics: ${actionData.topics.join(", ")}`,
            action: actionData,
            news: data.news
          });
          return;
        }
      }
    } catch (parseError) {
      // If JSON parsing fails, just return the normal response
      console.log('No action JSON found in response');
    }
    
    res.json({ response: aiResponse });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get response from Gemini API.' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Assistant backend running on port ${PORT}`);
});




*/
//everything above this line is backedn instructions which work to the extents they were made to. Below is the same code integrated with PostgreSQL and other improvements
// This is the main entry point for the AI Assistant backend
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from "cors";
import pkg from 'pg';
import cron from "node-cron";

const { Pool } = pkg;
dotenv.config();

const app = express();
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
    
    res.json({ success: true, goal: result.rows[0] });
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Failed to save goal' });
  }
});

app.put('/api/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { completed, progress, text } = req.body;
    
    const result = await pool.query(
      'UPDATE goals SET completed = $1, progress = $2, text = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [completed, progress, text, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    res.json({ success: true, goal: result.rows[0] });
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

app.delete('/api/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM goals WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
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
    
    res.json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error('Error creating schedule event:', error);
    res.status(500).json({ error: 'Failed to save schedule event' });
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

// Chat endpoint (modified to work with database)
app.post('/chat', async (req, res) => {
  const { message, userId = 1 } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    // Get current dashboard data to provide context to AI
    const dashboardData = await getUserData(userId);
    
    // Create a system prompt that gives the AI context about the dashboard, including actual data
    const systemPrompt = `You are A.S.A.D (AI-powered Smart Assistant for Dashboard), a productivity assistant that helps users manage their dashboard. You can:

1. Add, update, and delete goals (both short-term and long-term)
2. Add schedule events
3. Log workouts
4. Provide motivational advice
5. Help with productivity tips

Current dashboard state:
Short-term goals:
${dashboardData.goals.shortTerm.map(g => `- ID:${g.id} "${g.text}" (${g.progress}%) ${g.completed ? '[COMPLETED]' : ''}`).join('\n')}

Long-term goals:
${dashboardData.goals.longTerm.map(g => `- ID:${g.id} "${g.text}" (${g.progress}%) ${g.completed ? '[COMPLETED]' : ''}`).join('\n')}

Today's schedule:
${dashboardData.schedule.map(e => `- ${e.time}: ${e.event}`).join('\n')}

Workout log entries: ${dashboardData.workoutLog.length} workouts
User level: ${dashboardData.level} (${dashboardData.xp}/${dashboardData.maxXp} XP)

Available actions (respond with JSON when users request these):

ADD GOAL: {"action": "add_goal", "type": "shortTerm", "text": "goal text", "progress": 0}
DELETE GOAL: {"action": "delete_goal", "id": goal_id_number}
UPDATE GOAL: {"action": "update_goal", "id": goal_id_number, "completed": true, "progress": 100}
ADD SCHEDULE: {"action": "add_schedule", "time": "9:00 AM", "event": "Team Meeting"}
ADD WORKOUT: {"action": "add_workout", "type": "Cardio", "duration": 30, "calories": 200}

When users want to delete or complete goals, use the goal ID numbers shown above. For regular conversation, just respond normally. Always be helpful and motivational!`;

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
    
    // Check if the response contains a JSON action
    try {
      const actionMatch = aiResponse.match(/\{.*\}/s);
      if (actionMatch) {
        const actionData = JSON.parse(actionMatch[0]);

        // Add Goal
        if (actionData.action === 'add_goal') {
          const result = await pool.query(
            'INSERT INTO goals (user_id, text, type, progress) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, actionData.text, actionData.type, actionData.progress || 0]
          );
          
          res.json({ 
            response: `Great! I've added "${actionData.text}" to your ${actionData.type} goals. Keep up the great work!`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // Add Schedule
        if (actionData.action === 'add_schedule') {
          const result = await pool.query(
            'INSERT INTO schedule_events (user_id, time, event) VALUES ($1, $2, $3) RETURNING *',
            [userId, actionData.time, actionData.event]
          );
          
          res.json({ 
            response: `Perfect! I've added "${actionData.event}" at ${actionData.time} to your schedule.`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // Add Workout
        if (actionData.action === 'add_workout') {
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
          
          res.json({ 
            response: `I've successfully deleted the goal "${result.rows[0].text}". Keep focusing on your other goals!`,
            action: actionData,
            data: result.rows[0]
          });
          return;
        }

        // Complete/Update Goal
        if (actionData.action === 'update_goal') {
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
      console.log('No action JSON found in response');
    }
    
    res.json({ response: aiResponse });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get response from AI.' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Assistant backend running on port ${PORT}`);
});