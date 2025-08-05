import express from 'express';
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
    const url = `https://newsapi.org/v2/top-headlines?language=en&q=${encodeURIComponent(query)}&apiKey=${NEWS_API_KEY}`;
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
app.get('/api/news', (req, res) => {
  const data = readData();
  res.json(data.news || []);
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