import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  getJournalInsight, 
  getMoodInsight, 
  getChatResponse, 
  getHealthAdviceContent, 
  getMentalPeaceTechnique, 
  getDailyTip 
} from "./fallback-content";

// Initialize Google Gemini client
let genAI: GoogleGenerativeAI | null = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const hasGemini = Boolean(process.env.GEMINI_API_KEY);

if (!hasGemini) {
  console.warn("WARNING: No Gemini API key configured. Using fallback content only.");
} else {
  console.log("Using Google Gemini AI");
}

// AI service calling function
async function callAIService(prompt: string, systemMessage: string, useJSON = false): Promise<string> {
  if (hasGemini && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const fullPrompt = `${systemMessage}\n\nUser: ${prompt}`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text() || '';
    } catch (error: any) {
      console.log("Gemini failed:", error.message);
    }
  }
  throw new Error("Gemini AI unavailable");
}

export async function registerRoutes(app: Express): Promise<Server> {
// Journal analysis endpoint
app.post("/api/ai/analyze-journal", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Journal content is required" });
    }

    const systemMessage = `
You are an empathetic wellness assistant analyzing a journal entry.
Extract emotional themes, identify potential mood states, and provide brief, supportive insights that might help the user.
Respond ONLY with valid JSON, do not add any extra text.
Use the format:

{
  "insights": "<brief insight about the journal entry>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}
`;

   
    const aiResponse = await callAIService(content, systemMessage, true);
    console.log("RAW AI RESPONSE:", aiResponse);


    let result;
    
    try {
      // Extract first JSON object from AI response to handle any extra text
      const match = aiResponse.match(/\{.*\}/s);
      result = match ? JSON.parse(match[0]) : {
        insights: aiResponse || "Your journal entry shows thoughtful reflection on your experiences.",
        tags: ["reflection", "mindfulness", "self-awareness"]
      };
    } catch {
      result = {
        insights: aiResponse || "Your journal entry shows thoughtful reflection on your experiences.",
        tags: ["reflection", "mindfulness", "self-awareness"]
      };
    }

    return res.json({
      insights: result.insights || '',
      tags: result.tags || ["reflection", "mindfulness", "self-awareness"]
    });
  } catch (error: any) {
    console.error("Error analyzing journal:", error);
    return res.json({
      insights: getJournalInsight(),
      tags: ["reflection", "mindfulness", "self-awareness"]
    });
  }
});


  // Mood insights endpoint
  app.post("/api/ai/mood-insights", async (req, res) => {
    try {
      const { entries } = req.body;
      if (!entries || !Array.isArray(entries)) {
        return res.status(400).json({ error: "Mood entries are required" });
      }

      const systemMessage = "You are an empathetic wellness assistant analyzing mood entries. Based on the provided mood data, identify patterns and provide supportive, helpful insights. Keep your response concise (max 2-3 sentences). Respond in JSON format with an 'insights' field containing your analysis.";
      
      const aiResponse = await callAIService(JSON.stringify(entries), systemMessage, true);
      
      let result;
      try {
        result = JSON.parse(aiResponse);
      } catch {
        result = { insights: aiResponse || "Your mood patterns show important insights about your well-being journey." };
      }

      return res.json({
        insights: result.insights || ''
      });
    } catch (error: any) {
      console.error("Error generating mood insights:", error);
      return res.json({
        insights: getMoodInsight()
      });
    }
  });

  // Chat endpoint
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, tone, responseLength } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Chat messages are required" });
      }

      let lengthInstruction = "Keep your responses balanced in length.";
      if (responseLength === 1) lengthInstruction = "Keep your responses brief and concise.";
      else if (responseLength === 3) lengthInstruction = "Provide detailed, thorough responses.";

      let toneInstruction = "Use a friendly, conversational tone.";
      switch (tone) {
        case 'clinical':
          toneInstruction = "Use a clinical, objective tone with medical accuracy. Focus on evidence-based practices and healthcare information.";
          break;
        case 'spiritual':
          toneInstruction = "Use a mindful, spiritual tone that emphasizes inner peace, meditation, and harmony with nature.";
          break;
      }

      const systemMessage = `You are Dr. Mind AI, a mental wellness assistant. ${toneInstruction} ${lengthInstruction} Always prioritize user well-being and safety. For serious mental health concerns, suggest seeking professional help.`;

      const lastMessage = messages[messages.length - 1];
      const conversationContext = messages.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n');
      const prompt = conversationContext ? `${conversationContext}\n\nuser: ${lastMessage.content}` : lastMessage.content;

      const aiResponse = await callAIService(prompt, systemMessage);

      return res.json({
        response: aiResponse || 'I apologize, but I could not generate a response at this time.'
      });
    } catch (error: any) {
      console.error("Error generating chat response:", error);
      return res.json({
        response: getChatResponse(req.body.tone || 'friendly')
      });
    }
  });

  // Health advice endpoint
  app.post("/api/ai/health-advice", async (req, res) => {
    try {
      const { category, tone } = req.body;
      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }

      let toneInstruction = "Use a friendly, conversational tone.";
      switch (tone) {
        case 'clinical':
          toneInstruction = "Use a clinical, objective tone with medical accuracy.";
          break;
        case 'spiritual':
          toneInstruction = "Use a mindful, spiritual tone that emphasizes inner peace.";
          break;
      }

      let categoryPrompt = "";
      switch (category) {
        case 'general': categoryPrompt = "general wellness"; break;
        case 'diet': categoryPrompt = "nutrition and healthy eating"; break;
        case 'sleep': categoryPrompt = "sleep hygiene"; break;
        case 'hydration': categoryPrompt = "proper hydration"; break;
        case 'posture': categoryPrompt = "ergonomics and posture"; break;
        default: categoryPrompt = "general wellness";
      }

      const systemMessage = `You are Dr. Mind AI. ${toneInstruction} Provide practical, evidence-based advice about ${categoryPrompt}. Give 3-5 actionable tips with short explanations.`;
      const prompt = `I would like some advice about ${categoryPrompt}.`;

      const aiResponse = await callAIService(prompt, systemMessage);

      return res.json({
        advice: aiResponse || 'I could not generate health advice at this time.'
      });
    } catch (error: any) {
      console.error("Error generating health advice:", error);
      return res.json({
        advice: getHealthAdviceContent(req.body.category || 'general')
      });
    }
  });

  // Mental peace techniques endpoint
  app.post("/api/ai/mental-peace", async (req, res) => {
    try {
      const { category, tone } = req.body;
      if (!category) {
        return res.status(400).json({ error: "Category is required" });
      }

      let toneInstruction = "Use a friendly, conversational tone.";
      if (tone === 'clinical') toneInstruction = "Use a clinical, objective tone.";
      else if (tone === 'spiritual') toneInstruction = "Use a mindful, spiritual tone.";

      let categoryPrompt = "";
      switch (category) {
        case 'mindfulness': categoryPrompt = "mindfulness practices"; break;
        case 'stress': categoryPrompt = "stress reduction"; break;
        case 'breathing': categoryPrompt = "breathing exercises"; break;
        case 'affirmations': categoryPrompt = "positive affirmations"; break;
        case 'meditation': categoryPrompt = "meditation practices"; break;
        default: categoryPrompt = "mindfulness and mental well-being";
      }

      const systemMessage = `You are Dr.Mind AI. ${toneInstruction} Provide a practical technique for ${categoryPrompt} with step-by-step instructions and benefits.`;
      const prompt = `I would like to learn a technique for ${categoryPrompt}.`;

      const aiResponse = await callAIService(prompt, systemMessage);

      return res.json({
        technique: aiResponse || 'I could not generate a mental peace technique at this time.'
      });
    } catch (error: any) {
      console.error("Error generating mental peace technique:", error);
      return res.json({
        technique: getMentalPeaceTechnique(req.body.category || 'mindfulness')
      });
    }
  });

  // Daily tip endpoint
  app.post("/api/ai/daily-tip", async (req, res) => {
    try {
      const { tone } = req.body;

      let toneInstruction = "Use a friendly, conversational tone.";
      if (tone === 'clinical') toneInstruction = "Use a clinical, objective tone.";
      else if (tone === 'spiritual') toneInstruction = "Use a mindful, spiritual tone.";

      const systemMessage = `You are Dr.Mind AI. ${toneInstruction} Generate a one-sentence daily wellness tip in JSON format with a 'tip' field.`;

      const aiResponse = await callAIService("Generate today's wellness tip.", systemMessage, true);

      let result;
      try {
        result = JSON.parse(aiResponse);
      } catch {
        result = { tip: aiResponse || 'Take a moment to breathe deeply and center yourself.' };
      }

      return res.json({
        tip: result.tip || 'Take a moment to breathe deeply and center yourself.'
      });
    } catch (error: any) {
      console.error("Error generating daily tip:", error);
      return res.json({
        tip: getDailyTip()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
