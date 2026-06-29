import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

const DB_PATH = path.join(process.cwd(), "src", "db.json");

// Helper to read database
function readDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading database file:", error);
  }
  // Fallback initial database structure
  return {
    tasks: [],
    habits: [],
    motivationState: { currentStyle: "encouraging", history: [] },
    whatsappMessages: [],
    lastVocalSyncAt: null
  };
}

// Helper to write database
function writeDatabase(data: any) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing to database file:", error);
  }
}

// Lazy initialization of Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Helper for retrying Gemini API calls with exponential backoff on transient errors (like 503, 429)
async function callGeminiWithRetry(fn: () => Promise<any>, retries = 3, delayMs = 1500): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error.status || (error.error && error.error.code);
      const errorMessage = error.message || (error.error && error.error.message) || "";
      const errStr = typeof error === "string" ? error : JSON.stringify(error);
      
      const isQuotaExceeded = status === 429 && (
        errorMessage.toLowerCase().includes("quota") ||
        errorMessage.toLowerCase().includes("exhausted") ||
        errorMessage.toLowerCase().includes("limit") ||
        errStr.toLowerCase().includes("quota") ||
        errStr.toLowerCase().includes("exhausted") ||
        errStr.toLowerCase().includes("limit")
      );

      const isTransient = !isQuotaExceeded && (
        status === 503 || status === 429 || 
        (errorMessage && (
          errorMessage.includes("503") || 
          errorMessage.includes("429") || 
          errorMessage.includes("high demand") || 
          errorMessage.includes("temporary") ||
          errorMessage.includes("UNAVAILABLE")
        ))
      );
      
      if (isTransient && i < retries - 1) {
        const backoff = delayMs * Math.pow(2, i);
        console.warn(`Gemini API transient error (attempt ${i + 1}/${retries}). Retrying in ${backoff}ms...`, errorMessage || error);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }
}

// Resilient Offline Fallbacks when Gemini remains unavailable
function getLocalChaosParseFallback(text: string) {
  const tasks = [];
  const lines = text.split(/[.\n]/);
  let idCounter = Date.now();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 10) continue;

    tasks.push({
      id: `task_fallback_${idCounter++}`,
      title: trimmed.substring(0, 50) + (trimmed.length > 50 ? "..." : ""),
      urgency: 7,
      cognitiveWeight: "Medium",
      deadline: "Tonight at 11:59 PM",
      context: trimmed,
      channel: trimmed.toLowerCase().includes("email") || trimmed.toLowerCase().includes("message") || trimmed.toLowerCase().includes("send") ? "WhatsApp" : "Call",
      whyImportant: "To stay on top of outstanding priorities",
      obstacle: "Starting friction",
      workspaceType: trimmed.toLowerCase().includes("email") || trimmed.toLowerCase().includes("message") || trimmed.toLowerCase().includes("send") ? "communication" : "study"
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      id: `task_fallback_${idCounter++}`,
      title: text.substring(0, 40) + "...",
      urgency: 8,
      cognitiveWeight: "High",
      deadline: "Within 6 hours",
      context: text,
      channel: "WhatsApp",
      whyImportant: "Extracted from chaos mind-dump",
      obstacle: "Rushing right before deadline",
      workspaceType: "study"
    });
  }

  return tasks;
}

function getLocalWorkspaceFallback(title: string, context: string, workspaceType: string) {
  if (workspaceType === "communication") {
    return {
      workspaceDraft: `Subject: Regarding ${title}\n\nDear Professor/Recipient,\n\nI hope this email finds you well. I wanted to follow up regarding the ${title}.\n\nHere are the details:\n${context || "[Details here]"}\n\nPlease let me know if you have any questions or need further details.\n\nBest regards,\n[Your Name]`
    };
  } else {
    return {
      frameworkPoints: [
        `Understand the core requirements of ${title}.`,
        `Break down the complexity and gather necessary resources.`,
        `Draft and verify each part systematically to ensure quality.`
      ],
      studyCards: [
        { front: `What is the primary objective of ${title}?`, back: `To successfully understand and complete the task using structured study frameworks.` },
        { front: `What is the key concept in this context?`, back: `${context || "Focusing on key details of " + title + " to avoid common mistakes."}` },
        { front: `What is the first action step?`, back: `Break the work into small sub-tasks and start with a 15-minute focused interval.` }
      ]
    };
  }
}

function getLocalMotivationFallback(taskTitle: string, style: string) {
  const nudges: Record<string, string> = {
    encouraging: `Hey, you've got this! "${taskTitle}" is totally within your reach. Just open the document and spend 5 minutes on it. Once you start, momentum will do the rest!`,
    logical: `If you start "${taskTitle}" now, you'll feel immensely relieved later today. Rushing right before the deadline always takes twice the energy. Let's make it easy on yourself!`,
    urgency: `The clock is ticking on "${taskTitle}". Starting now means you can finish at a relaxed pace without any panic. Let's jump in!`,
    progress: `Remember, you don't have to finish "${taskTitle}" all at once. Just focus on writing the first single line or step. The first step is the hardest, but you're ready.`,
    humorous: `No more procrastination scroll loops! "${taskTitle}" is waiting for its moment of glory. Let's conquer it now so you can go back to scrolling guilt-free!`,
    challenge: `I challenge you to focus on "${taskTitle}" for just 10 minutes right now. No distractions, just you and the task. Time starts now—let's go!`,
    empathetic: `It's completely normal to feel overwhelmed or tired by "${taskTitle}". You don't need perfect energy to start. Just do a tiny, messy first draft. I'm right here with you.`,
    achievement: `Think about how incredible it will feel to have "${taskTitle}" completely done. The weight off your shoulders is worth 15 minutes of focus. Let's make it happen!`
  };
  return nudges[style] || nudges['encouraging'];
}

function getLocalVoiceSyncFallback(userResponse: string, activeHabits: any[], activeTasks: any[]) {
  const normalized = (userResponse || "").toLowerCase();
  const updates: Record<string, boolean> = {};
  const completedTaskIds: string[] = [];
  let speechText = "";

  // Simple keyword matching for active habits
  for (const habit of activeHabits) {
    const titleLower = habit.title.toLowerCase();
    const keywords = titleLower.split(" ");
    const matchesKeyword = keywords.some((kw: string) => kw.length > 3 && normalized.includes(kw));
    
    const isPositive = normalized.includes("yes") || normalized.includes("yeah") || normalized.includes("did") || normalized.includes("crushed") || normalized.includes("checked") || normalized.includes("finished") || normalized.includes("done");
    const isNegative = normalized.includes("no") || normalized.includes("didn't") || normalized.includes("couldn't") || normalized.includes("skipped") || normalized.includes("not yet");

    if (matchesKeyword || (normalized.includes("workout") && titleLower.includes("workout")) || (normalized.includes("water") && titleLower.includes("water"))) {
      if (isPositive) {
        updates[habit.id] = true;
      } else if (isNegative) {
        updates[habit.id] = false;
      }
    }
  }

  // Simple keyword matching for active tasks
  for (const task of activeTasks) {
    const titleLower = task.title.toLowerCase();
    const contextLower = (task.context || "").toLowerCase();
    const isMatched = titleLower.split(" ").some((kw: string) => kw.length > 3 && normalized.includes(kw)) ||
                      contextLower.split(" ").some((kw: string) => kw.length > 3 && normalized.includes(kw)) ||
                      (normalized.includes("physics") && titleLower.includes("physics")) ||
                      (normalized.includes("report") && titleLower.includes("report"));

    if (isMatched) {
      const isPositive = normalized.includes("yes") || normalized.includes("yeah") || normalized.includes("did") || normalized.includes("finished") || normalized.includes("done") || normalized.includes("emailed") || normalized.includes("sent");
      if (isPositive) {
        completedTaskIds.push(task.id);
      }
    }
  }

  if (Object.keys(updates).length > 0 || completedTaskIds.length > 0) {
    const itemNames: string[] = [];
    Object.keys(updates).forEach(id => {
      if (updates[id]) {
        const h = activeHabits.find(x => x.id === id);
        if (h) itemNames.push(h.title);
      }
    });
    completedTaskIds.forEach(id => {
      const t = activeTasks.find(x => x.id === id);
      if (t) itemNames.push(t.title);
    });

    speechText = `Awesome! I've checked off ${itemNames.join(", ")} for you. You're doing incredible, keep up the great momentum!`;
  } else {
    speechText = "Got it! Thanks for the update. Let's keep moving forward and take control of the day. You've got this!";
  }

  return { speechText, updates, completedTaskIds };
}

// REST API Routes

// Get complete database
app.get("/api/db", (req, res) => {
  const db = readDatabase();
  res.json(db);
});

// Update tasks array
app.post("/api/db/tasks", (req, res) => {
  const db = readDatabase();
  db.tasks = req.body.tasks;
  writeDatabase(db);
  res.json({ success: true, db });
});

// Update habits array
app.post("/api/db/habits", (req, res) => {
  const db = readDatabase();
  db.habits = req.body.habits;
  writeDatabase(db);
  res.json({ success: true, db });
});

// Add a single WhatsApp message
app.post("/api/db/whatsapp-msg", (req, res) => {
  const db = readDatabase();
  const newMsg = req.body.message;
  db.whatsappMessages = [...db.whatsappMessages, newMsg];
  writeDatabase(db);
  res.json({ success: true, db });
});

// Clear/Reset WhatsApp messages
app.post("/api/db/whatsapp-reset", (req, res) => {
  const db = readDatabase();
  db.whatsappMessages = [];
  writeDatabase(db);
  res.json({ success: true, db });
});

// Update complete database schema directly
app.post("/api/db/save", (req, res) => {
  writeDatabase(req.body);
  res.json({ success: true });
});

// Layer A: Chaos-to-Order Structural Parser Endpoint
app.post("/api/chaos-parse", async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim() === "") {
    return res.status(400).json({ error: "Mental dump text is required" });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `You are a hyper-intelligent 'Chaos-to-Order' parser for IGNITE.
Ingest the following chaotic, unfiltered mental dump:
"${text}"

Your task is to identify and split it into discrete, highly actionable task objects.
For each task, populate:
- "title": Action-oriented, short, elegant (e.g. 'Email late report to Vance', 'Schedule dental cleanup')
- "urgency": Urgency score from 1 (lowest) to 10 (highest/critical)
- "cognitiveWeight": Assigned cognitive stress ('Low', 'Medium', or 'High')
- "deadline": Estimate a logical relative or absolute deadline (e.g. 'Tonight at 11:59 PM', 'Tomorrow morning', 'In 3 days', etc.)
- "context": Brief details explaining the background/circumstances
- "channel": If it involves contacting, messaging, or sending an email/document to someone, set to 'WhatsApp'. Otherwise, if it's a personal to-do or call, set to 'Call'.
- "whyImportant": Deduce a deep motivating reason why completing this task matters (e.g., 'To maintain scholarship status', 'To prevent late fees', etc.)
- "obstacle": Deduce the biggest likely procrastination obstacle/excuse (e.g., 'Overthinking writing the apology', 'Fear of phone calls', 'Fatigue')
- "workspaceType": set to 'communication' if it requires writing an email, message, or contacting someone; set to 'cognitive' if it is a study session, planning session, review, or brainstorming task.

You must return a strictly formatted JSON array containing the identified tasks.
Response structure:
[
  {
    "title": "...",
    "urgency": 8,
    "cognitiveWeight": "High",
    "deadline": "...",
    "context": "...",
    "channel": "WhatsApp",
    "whyImportant": "...",
    "obstacle": "...",
    "workspaceType": "communication"
  }
]`;

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      })
    );

    const parsedTasks = JSON.parse(response.text?.trim() || "[]");
    res.json({ success: true, tasks: parsedTasks });
  } catch (error: any) {
    console.error("Gemini Chaos Parse Error, using local fallback:", error);
    try {
      const fallbackTasks = getLocalChaosParseFallback(text);
      res.json({ success: true, tasks: fallbackTasks, fallback: true });
    } catch (fallbackError: any) {
      res.status(500).json({ error: error.message || "Failed to parse chaos text" });
    }
  }
});

// Layer B: Workspace content builder ("50% Done" Automated Workspace Engine)
app.post("/api/generate-workspace", async (req, res) => {
  const { title, context, workspaceType } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Task title is required" });
  }

  try {
    const ai = getGeminiClient();
    let prompt = "";

    if (workspaceType === "communication") {
      prompt = `You are IGNITE, a premium AI executive assistant. Generate a perfectly written, professional email or text message template draft based on the following details:
Task: "${title}"
Background Details: "${context || "No context provided"}"

Make sure it's highly polished, leaves placeholders like [Your Name] if needed, and is ready for the user to copy-paste or hit 'Send'.
Return the response as a JSON object containing a single key "workspaceDraft".`;
    } else {
      prompt = `You are IGNITE, a premium AI executive assistant. Generate study notes, a 3-bullet core blueprint framework, and 3 study flashcards (Q&A style) for the following cognitive task:
Task: "${title}"
Background Details: "${context || "No context provided"}"

Provide the output as a JSON object containing:
- "frameworkPoints": an array of exactly 3 robust, highly informative summary points.
- "studyCards": an array of 3 objects, each with "front" (question/concept) and "back" (detailed answer/definition).

Structure:
{
  "frameworkPoints": ["...", "...", "..."],
  "studyCards": [
    { "front": "...", "back": "..." },
    { "front": "...", "back": "..." },
    { "front": "...", "back": "..." }
  ]
}`;
    }

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      })
    );

    const generated = JSON.parse(response.text?.trim() || "{}");
    res.json({ success: true, ...generated });
  } catch (error: any) {
    console.error("Gemini Workspace Generation Error, using local fallback:", error);
    try {
      const fallbackWorkspace = getLocalWorkspaceFallback(title, context || "", workspaceType);
      res.json({ success: true, ...fallbackWorkspace, fallback: true });
    } catch (fallbackError: any) {
      res.status(500).json({ error: error.message || "Failed to generate workspace components" });
    }
  }
});

// Anti-Procrastination Coach Endpoint (Generates Custom Nudges)
app.post("/api/motivation-coach", async (req, res) => {
  const { taskTitle, whyImportant, obstacle, remainingHours, style } = req.body;
  if (!taskTitle) {
    return res.status(400).json({ error: "Task title is required" });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `You are an elite, supportive personal productivity coach and supportive executive assistant for IGNITE.
Generate a short, hyper-customized motivational nudge to help the user start the following task immediately:
- Task: "${taskTitle}"
- Deep motivation: "${whyImportant || "Not specified"}"
- Biggest procrastination obstacle: "${obstacle || "Not specified"}"
- Remaining time until deadline: "${remainingHours ? remainingHours + " hours" : "running out"}"
- Target coaching tone/style: "${style || "encouraging"}"

Styles guide:
- 'encouraging': Warm, positive, believing in the user's potential.
- 'logical': Clear rational argument on why starting now saves time/effort.
- 'urgency': Emphasize the ticking clock and prevent rushing panic.
- 'progress': Highlight the power of taking just one step, breaking momentum lock.
- 'humorous': Friendly ribbing, lighthearted banter about distractions.
- 'challenge': A bold challenge to focus for 15 minutes, high-energy.
- 'empathetic': Validate their fatigue or anxiety first, then guide them in gently.
- 'achievement': Appeal to their dream self and the immense relief once completed.

Generate exactly ONE spoken reminder (maximum 30 words). Speak directly to the user. Do not use generic quotes.
Return the response as a JSON object containing a single key "nudge".
Example of a humorous/logical nudge:
"You mentioned Instagram usually distracts you. Give me just 20 focused minutes on this Physics lab report first—the scrolls can wait, but your scholarship can't!"`;

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      })
    );

    const generated = JSON.parse(response.text?.trim() || "{}");
    res.json({ success: true, nudge: generated.nudge });
  } catch (error: any) {
    console.error("Gemini Motivation Coach Error, using local fallback:", error);
    try {
      const fallbackNudge = getLocalMotivationFallback(taskTitle, style || "encouraging");
      res.json({ success: true, nudge: fallbackNudge, fallback: true });
    } catch (fallbackError: any) {
      res.status(500).json({ error: error.message || "Failed to generate coach nudge" });
    }
  }
});

// 9:00 PM Voice-Sync Simulator Endpoint
app.post("/api/voice-sync", async (req, res) => {
  const { userResponse, activeHabits, activeTasks, chatLog = [] } = req.body;

  try {
    const habitsToAsk = activeHabits.filter((h: any) => !h.completedToday);
    const tasksToAsk = activeTasks.filter((t: any) => t.status !== "Completed");

    const itemsToAsk = [
      ...habitsToAsk.map((h: any) => ({ id: h.id, type: "habit", title: h.title })),
      ...tasksToAsk.map((t: any) => ({ id: t.id, type: "task", title: t.title }))
    ];

    // Helper to check keywords for habit/task matching
    const matchesKeywords = (text: string, itemId: string, itemTitle: string) => {
      const textLower = text.toLowerCase();
      if (itemId === "habit_1" && (textLower.includes("water") || textLower.includes("liter") || textLower.includes("hydrate") || textLower.includes("drink"))) return true;
      if (itemId === "habit_2" && (textLower.includes("workout") || textLower.includes("exercise") || textLower.includes("gym") || textLower.includes("morning workout"))) return true;
      if (itemId === "habit_3" && (textLower.includes("screen") || textLower.includes("bedtime") || textLower.includes("10 pm") || textLower.includes("phone"))) return true;
      if (itemId === "task_1" && (textLower.includes("physics") || textLower.includes("vance") || textLower.includes("report") || textLower.includes("lab report"))) return true;
      if (itemId === "task_2" && (textLower.includes("mesopotamia") || textLower.includes("midterm") || textLower.includes("history") || textLower.includes("civilization") || textLower.includes("nile"))) return true;
      if (itemId === "task_3" && (textLower.includes("fridge") || textLower.includes("grocery") || textLower.includes("groceries") || textLower.includes("restock"))) return true;

      const titleParts = itemTitle.toLowerCase().split(" ");
      return titleParts.some(part => part.length > 3 && textLower.includes(part));
    };

    // 1. Initial Call START flow
    if (userResponse === "__START__") {
      if (itemsToAsk.length === 0) {
        const speechText = "Hey there! It's IGNITE, your executive partner. I checked your dashboard and you've already completed all your habits and tasks for today! Keep up the brilliant momentum!";
        return res.json({ success: true, speechText, updates: {}, completedTaskIds: [] });
      }

      const firstItem = itemsToAsk[0];
      const questionMap: Record<string, string> = {
        "habit_1": "Did you manage to drink your three liters of water today?",
        "habit_2": "Did you do your thirty minute morning workout today?",
        "habit_3": "Are you on track to limit your screen time after ten P M tonight?",
        "task_1": "Have you emailed that Physics Lab Report to Professor Vance yet?",
        "task_2": "Did you spend some time reviewing Ancient Mesopotamia and Nile Civilization for your midterm?",
        "task_3": "Did you manage to restock the empty fridge with healthy groceries today?"
      };
      const question = questionMap[firstItem.id] || `Did you get a chance to work on: ${firstItem.title}?`;
      const greeting = `Hey there! It's IGNITE, your executive partner. Let's do a rapid progress sync. First, ${question.charAt(0).toLowerCase() + question.slice(1)}`;
      
      return res.json({ success: true, speechText: greeting, updates: {}, completedTaskIds: [] });
    }

    // 2. Identify the last asked item
    const pilotMessages = chatLog.filter((log: any) => log.sender === "pilot");
    let lastAskedItem = null;
    if (pilotMessages.length > 0) {
      const lastPilotMsgText = pilotMessages[pilotMessages.length - 1].text;
      lastAskedItem = itemsToAsk.find(item => matchesKeywords(lastPilotMsgText, item.id, item.title)) || null;
    }

    // 3. Resolve user's answer to the last asked item
    const norm = (userResponse || "").toLowerCase().trim();
    
    const isNegative = norm.includes("no") || 
                       norm.includes("not yet") || 
                       norm.includes("nah") || 
                       norm.includes("couldn't") || 
                       norm.includes("didn't") || 
                       norm.includes("skipped") || 
                       norm.includes("not today") || 
                       norm.includes("wasn't able") || 
                       norm.includes("haven't") ||
                       norm.includes("not today");

    const positiveWords = [
      "yes", "yeah", "yep", "yup", "sure", "absolutely", "of course", "definitely", "indeed", "i did", "i have", "already",
      "done", "completed", "finished", "crushed", "sent", "emailed", "submitted", "did it", "got it", "took care",
      "drank", "hydrated", "workout", "worked", "exercised", "gym", "screen", "limited", "review", "reviewed", "restock", "restocked", "bought", "purchased"
    ];

    const isPositive = !isNegative && (
      positiveWords.some(word => norm.includes(word)) ||
      norm.includes("ok") ||
      norm.includes("fine") ||
      norm.includes("good") ||
      norm.includes("great")
    );

    const updates: Record<string, boolean> = {};
    const completedTaskIds: string[] = [];

    if (lastAskedItem) {
      if (isPositive) {
        if (lastAskedItem.type === "habit") {
          updates[lastAskedItem.id] = true;
        } else if (lastAskedItem.type === "task") {
          completedTaskIds.push(lastAskedItem.id);
        }
      }
      // If the user says no, we explicitly do NOT mark it, and we do not ask about it again.
    }

    // 4. Identify all asked items so far to find the NEXT item
    const askedItemIds = new Set<string>();
    pilotMessages.forEach((msg: any) => {
      itemsToAsk.forEach(item => {
        if (matchesKeywords(msg.text, item.id, item.title)) {
          askedItemIds.add(item.id);
        }
      });
    });

    const nextItem = itemsToAsk.find(item => !askedItemIds.has(item.id) && (lastAskedItem ? item.id !== lastAskedItem.id : true));

    // Try calling Gemini first
    try {
      const ai = getGeminiClient();
      
      const remainingTasksList = activeTasks.filter((t: any) => t.status !== "Completed" && !completedTaskIds.includes(t.id));
      const remainingHabitsList = activeHabits.filter((h: any) => !h.completedToday && !(updates[h.id] === true));
      
      const prompt = `You are IGNITE conducting the Daily Progress Sync. You act as a supportive executive partner who helps the user stay accountable to their aspirations.

Here is the conversation history so far:
${JSON.stringify(chatLog, null, 2)}

The user just replied: "${userResponse}"
Last asked item: ${lastAskedItem ? JSON.stringify(lastAskedItem) : "None (Starting the call)"}
Next item to ask: ${nextItem ? JSON.stringify(nextItem) : "None (Concluding the call)"}

Active pending tasks left on their dashboard:
${JSON.stringify(activeTasks, null, 2)}

Active pending habits left:
${JSON.stringify(activeHabits, null, 2)}

Your objective:
1. Voice Consistency: Speak as a natural, warm, emotionally intelligent, and human-like voice assistant (IGNITE). You must use a single, highly consistent supportive partner voice. Never change your accent, tone style, or vocabulary style under any circumstances. You must remain in the exact same empathetic executive partner persona throughout the entire conversation. Do not use any regional dialects or change your conversational pattern. Keep the accent perfectly standard English.
2. Negative Responses: If the user says "no" or indicates they didn't complete the last item:
   - Acknowledge it supportively without judgment (e.g. "No worries, I completely understand," "That's totally fine," "No pressure at all.").
   - Do NOT mark that task or habit as completed (leave "updates" and "completedTaskIds" empty for this item).
   - Do NOT push them or ask about it again in this turn or subsequent ones during this call.
3. Next Item: If a "Next item to ask" is provided, smoothly transition and ask about that next item (e.g. "Did you manage to do your morning workout?"). Do NOT include any pending task summaries or lists yet.
4. Concluding the Call & Pending Tasks: Only mention pending/remaining tasks/habits at the very end of the call when 'Next item to ask' is 'None (Concluding the call)'. You must go through every single task and habit on today's list before you present a friendly wrap-up. If there are any outstanding pending tasks (${JSON.stringify(remainingTasksList.map((t: any) => t.title))}) or pending habits (${JSON.stringify(remainingHabitsList.map((h: any) => h.title))}) that are not completed (including those that were skipped or not done today), you must present a gentle, supportive reminder listing them specifically. Under NO circumstances should you say 'Everything is completed' or 'All your tasks are done' if any habit or task remains pending.
5. Guidelines for natural human conversation:
   - Use natural contractions (I'm, you've, that's, let's, don't, etc.).
   - Keep the tone relaxed, warm, and supportive, like a trusted friend.
   - Do NOT ask more than one question per turn. Only ask about the specified "Next item to ask".

Output your response strictly as a JSON object with three fields:
- "speechText": What IGNITE should say vocally. Make it incredibly conversational, warm, relaxed, and brief.
- "updates": Resolved habit updates. Based on the user's latest response, if they confirmed completing the last asked habit, set its ID to true: { "${lastAskedItem && lastAskedItem.type === 'habit' ? lastAskedItem.id : ''}": true }. If they said "no", do NOT set it to true. If the last asked item was a task, leave "updates" empty {}.
- "completedTaskIds": An array containing the task ID if they confirmed completing the last asked task (e.g. ["${lastAskedItem && lastAskedItem.type === 'task' ? lastAskedItem.id : ''}"]). If they said "no", leave it empty [].

Output format:
{
  "speechText": "Your spoken text here...",
  "updates": {},
  "completedTaskIds": []
}`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        })
      );

      const output = JSON.parse(response.text?.trim() || "{}");
      
      // Safety guard: Double check that we respect the 'yes/no' rules even if Gemini returned something else
      if (lastAskedItem) {
        if (isPositive) {
          if (lastAskedItem.type === "habit") {
            if (!output.updates) output.updates = {};
            output.updates[lastAskedItem.id] = true;
          } else if (lastAskedItem.type === "task") {
            if (!output.completedTaskIds) output.completedTaskIds = [];
            if (!output.completedTaskIds.includes(lastAskedItem.id)) {
              output.completedTaskIds.push(lastAskedItem.id);
            }
          }
        } else if (isNegative) {
          if (lastAskedItem.type === "habit") {
            if (output.updates) {
              delete output.updates[lastAskedItem.id];
            }
          } else if (lastAskedItem.type === "task") {
            output.completedTaskIds = (output.completedTaskIds || []).filter((id: string) => id !== lastAskedItem.id);
          }
        }
      }

      return res.json({ success: true, ...output });
    } catch (geminiError: any) {
      console.warn("Gemini Voice Sync error, using deterministic local fallback:", geminiError);
      
      // Local fallback generator (guaranteed consistency, exact flow)
      let transition = "Got you, thanks for the update.";
      if (lastAskedItem) {
        if (isPositive) {
          const yesGreetings = [
            "Perfect! Checked that off.",
            "Awesome! Glad to hear that.",
            "Fantastic, you absolutely crushed that!",
            "Great job, that is checked off."
          ];
          transition = yesGreetings[Math.floor(Math.random() * yesGreetings.length)];
        } else if (isNegative) {
          const noGreetings = [
            "No worries, I completely understand.",
            "Got it. We'll leave that one unchecked.",
            "Understandable, let's keep it on the radar.",
            "That's fine, no pressure at all."
          ];
          transition = noGreetings[Math.floor(Math.random() * noGreetings.length)];
        }
      }

      let speechText = "";
      if (nextItem) {
        const questionMap: Record<string, string> = {
          "habit_1": "Did you manage to drink your three liters of water today?",
          "habit_2": "Did you get your thirty minute morning workout in?",
          "habit_3": "Are you on track to limit your screen time after ten P M tonight?",
          "task_1": "Have you emailed that Physics Lab Report to Professor Vance?",
          "task_2": "Did you spend some time reviewing Ancient Mesopotamia and Nile Civilization for your midterm?",
          "task_3": "Did you manage to restock the empty fridge with healthy groceries?"
        };
        const nextQuestion = questionMap[nextItem.id] || `Did you get a chance to work on: ${nextItem.title}?`;
        speechText = `${transition} Now, tell me, ${nextQuestion}`;
      } else {
        const finishTransition = isPositive 
          ? "Awesome job! I've logged that. " 
          : (isNegative ? "Got it, no problem. " : "Got you. ");

        const remainingTasks = activeTasks.filter((t: any) => t.status !== "Completed" && !completedTaskIds.includes(t.id));
        const remainingHabits = activeHabits.filter((h: any) => !h.completedToday && !(updates[h.id] === true));
        
        let pendingSummary = "";
        if (remainingTasks.length > 0 || remainingHabits.length > 0) {
          const itemsList = [
            ...remainingHabits.map((h: any) => h.title),
            ...remainingTasks.map((t: any) => t.title)
          ];
          pendingSummary = `Just a gentle reminder that you still have some pending items left to conquer: ${itemsList.join(", ")}.`;
        } else {
          pendingSummary = "Amazing work today, all your habits and core tasks are fully completed!";
        }

        speechText = `${finishTransition}Well, we've gone through everything on today's list. ${pendingSummary} Keep up the great momentum, and call me anytime you need a quick sync!`;
      }

      return res.json({
        success: true,
        speechText,
        updates,
        completedTaskIds,
        fallback: true
      });
    }

  } catch (error: any) {
    console.error("Critical error in /api/voice-sync:", error);
    res.status(500).json({ error: error.message || "Voice sync failed" });
  }
});

// Vite Middleware & Routing for Single Page Apps
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
