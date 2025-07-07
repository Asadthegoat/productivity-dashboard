# AI Assistant Backend

This is a simple Node.js Express backend that connects to the Gemini API to provide AI chat responses for your dashboard.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in this directory with your Gemini API key:
   ```env
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

3. Start the server:
   ```bash
   npm run dev
   # or
   npm start
   ```

The server will run on port 5000 by default.

## API

### POST /chat
Send a JSON body:
```json
{
  "message": "Your message here"
}
```

Response:
```json
{
  "response": "AI's reply here"
}
```
