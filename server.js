import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      process.env.FRONTEND_URL ||
        "https://ai-chat-frontend-two-omega.vercel.app",
    ],
    credentials: true,
  }),
);
app.use(express.json());

// chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Received messages:", req.body);
    const { messages } = req.body;
    console.log("Messages to send to OpenAI:", messages);

    // set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // detect client disconnects
    req.on("close", () => {
      console.log("Client disconnected.");
    });

    // stream from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      stream: true, // Enable streaming from OpenAI
      //parameters:
      temperature: 0.7, //Balanced creativity and coherence
      max_tokens: 500, //Limit response length
      presence_penalty: 0.3, //Encourage new topics
    });

    //loop through chunks of data as they arrive
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || "";

      //only send if there is actual content
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`); // Send chunk to client
      }

      // If the chunk indicates the end of the stream, close the connection
      if (chunk.choices[0]?.finish_reason === "stop") {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        break;
      }
    }
    res.end(); // End the response when streaming is done
  } catch (error) {
    console.error("Error", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
