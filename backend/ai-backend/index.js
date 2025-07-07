import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  app.use(cors());
console.log('Gemini API Key:', GEMINI_API_KEY);

app.use(express.json());

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        contents: [
          { parts: [{ text: message }] }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          key: GEMINI_API_KEY
        }
      }
    );
    const aiMessage = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    res.json({ response: aiMessage });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get response from Gemini API.' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Assistant backend running on port ${PORT}`);
}); 