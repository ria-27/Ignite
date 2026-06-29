import React, { useState, useEffect } from "react";
import { Task, Habit, ChatMessage, MotivationStyle, CognitiveWeight, TargetChannel } from "./types";
import CalendarView from "./components/CalendarView";
import WhatsAppSimulator from "./components/WhatsAppSimulator";
import VocalSyncSimulator from "./components/VocalSyncSimulator";
import {
  Sparkles,
  Plus,
  Send,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  X,
  Volume2,
  Lock,
  MessageCircle,
  Maximize2,
  Smartphone,
  Flame,
  Zap,
  BookOpen,
  Coffee,
  HelpCircle,
  Lightbulb,
  RefreshCw,
  Mic,
  Trash2
} from "lucide-react";

// Helper to format deadline strings in a clean, timezone-independent manner
const formatDeadline = (deadline: string): string => {
  if (!deadline || deadline === "No deadline") return "No deadline";
  
  if (deadline.includes("T")) {
    const parts = deadline.split("T");
    const dateStr = parts[0]; // YYYY-MM-DD
    const timeStr = parts[1]; // HH:MM:SS or HH:MM
    
    const dateParts = dateStr.split("-");
    if (dateParts.length === 3) {
      const year = dateParts[0];
      const monthIndex = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const monthName = monthNames[monthIndex] || dateParts[1];
      
      const timeParts = timeStr.split(":");
      if (timeParts.length >= 2) {
        let hour = parseInt(timeParts[0], 10);
        const minute = timeParts[1].slice(0, 2);
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12;
        if (hour === 0) hour = 12;
        
        return `${monthName} ${day}, ${year}, ${hour}:${minute} ${ampm}`;
      }
      
      return `${monthName} ${day}, ${year}`;
    }
  } else {
    const dateParts = deadline.split("-");
    if (dateParts.length === 3) {
      const year = dateParts[0];
      const monthIndex = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const monthName = monthNames[monthIndex] || dateParts[1];
      return `${monthName} ${day}, ${year} (All Day)`;
    }
  }
  
  return deadline;
};

export default function App() {
  // DB State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showDumpTooltip, setShowDumpTooltip] = useState(true);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [whatsappMessages, setWhatsappMessages] = useState<ChatMessage[]>([]);
  const [coachingStyle, setCoachingStyle] = useState<MotivationStyle>("encouraging");

  // Selected entities & loaders
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isParsingChaos, setIsParsingChaos] = useState(false);
  const [isCoaching, setIsCoaching] = useState(false);
  const [isGeneratingWorkspace, setIsGeneratingWorkspace] = useState(false);
  const [isStreamingWhatsApp, setIsStreamingWhatsApp] = useState(false);

  // Modals & UI Toggles
  const [chaosModalOpen, setChaosModalOpen] = useState(false);
  const [chaosText, setChaosText] = useState("");
  const [customTaskOpen, setCustomTaskOpen] = useState(false);

  // Full task edit modal states
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContext, setEditContext] = useState("");
  const [editWhyImportant, setEditWhyImportant] = useState("");
  const [editObstacle, setEditObstacle] = useState("");
  const [editUrgency, setEditUrgency] = useState(5);
  const [editCognitiveWeight, setEditCognitiveWeight] = useState<CognitiveWeight>("Medium");
  const [editChannel, setEditChannel] = useState<TargetChannel>("WhatsApp");
  const [editModalHasDeadline, setEditModalHasDeadline] = useState(false);
  const [editModalDeadlineDate, setEditModalDeadlineDate] = useState("2026-06-28");
  const [editModalHasTime, setEditModalHasTime] = useState(true);
  const [editModalDeadlineTime, setEditModalDeadlineTime] = useState("18:00");

  // Delete task modal state
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3000);
  };

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newUrgency, setNewUrgency] = useState(5);
  const [newCognitiveWeight, setNewCognitiveWeight] = useState<"Low" | "Medium" | "High">("Medium");
  const [newDeadline, setNewDeadline] = useState("No deadline");
  const [newChannel, setNewChannel] = useState<"Call" | "WhatsApp">("WhatsApp");
  const [newWhyImportant, setNewWhyImportant] = useState("");
  const [newObstacle, setNewObstacle] = useState("");

  // New task form deadline helper states
  const [newHasDeadline, setNewHasDeadline] = useState(false);
  const [newDeadlineDate, setNewDeadlineDate] = useState("2026-06-28");
  const [newHasTime, setNewHasTime] = useState(true);
  const [newDeadlineTime, setNewDeadlineTime] = useState("18:00");

  // Inline selected task editing states
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [editHasDeadline, setEditHasDeadline] = useState(false);
  const [editDeadlineDate, setEditDeadlineDate] = useState("2026-06-28");
  const [editHasTime, setEditHasTime] = useState(true);
  const [editDeadlineTime, setEditDeadlineTime] = useState("18:00");

  // Speech to text states
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<"ready" | "listening" | "processing" | "complete">("ready");

  // Study card index tracker
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  // Voice sync call status state
  const [isSyncing, setIsSyncing] = useState(false);

  // Visual webhook notification log (The "Escalation Alert")
  const [webhookAlert, setWebhookAlert] = useState<string | null>(null);

  // Load database on boot
  const loadDatabase = async () => {
    try {
      const response = await fetch("/api/db");
      const data = await response.json();
      setTasks(data.tasks || []);
      setHabits(data.habits || []);
      setWhatsappMessages(data.whatsappMessages || []);
      if (data.motivationState?.currentStyle) {
        setCoachingStyle(data.motivationState.currentStyle);
      }
      
      // Select first task by default if none selected
      if (data.tasks && data.tasks.length > 0 && !selectedTask) {
        setSelectedTask(data.tasks[0]);
      }
    } catch (error) {
      console.error("Error loading database:", error);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  // Save full state to server helper
  const saveStateToServer = async (updatedTasks: Task[], updatedHabits: Habit[], updatedMessages: ChatMessage[]) => {
    try {
      await fetch("/api/db/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: updatedTasks,
          habits: updatedHabits,
          motivationState: { currentStyle: coachingStyle, history: [] },
          whatsappMessages: updatedMessages,
          lastVocalSyncAt: new Date().toISOString()
        }),
      });
    } catch (error) {
      console.error("Error saving state to server:", error);
    }
  };

  // Pre-deadline escalation warning background loop (simulated every 15s)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      // Look for tasks due soon (< 2 hours) which are not completed
      const now = new Date("2026-06-27T18:00:00Z"); // Frozen simulator timestamp
      const escalatable = tasks.find((t) => {
        if (t.status === "Completed") return false;
        if (!t.deadline || t.deadline === "No deadline") return false;
        const diffMs = new Date(t.deadline).getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours > 0 && diffHours <= 2;
      });

      if (escalatable) {
        // Trigger visual webhook log alert representing TWILIO/WHATSAPP ESCALATION
        setWebhookAlert(`Webhook Triggered: Escalating uncompleted task "${escalatable.title}" directly to WhatsApp!`);
        
        // Push a message to WhatsApp simulator if not already there
        const alreadyEscalated = whatsappMessages.some(m => m.payload?.taskId === escalatable.id && m.text.includes("Escalation"));
        if (!alreadyEscalated) {
          const newMsg: ChatMessage = {
            id: `wa_esc_${Date.now()}`,
            sender: "pilot",
            text: `⚠️ *AUTOMATED ESCALATION ALERT* ⚠️\n\nYour task *"${escalatable.title}"* is due in less than 2 hours! You mentioned: "${escalatable.whyImportant || "This is critical"}" but also noted: "${escalatable.obstacle || "You might procrastinate"}".\n\nStarting now avoids rushing. Let's execute!`,
            timestamp: new Date().toISOString(),
            quickActions: ["Mark Completed", "Review AI Workspace Draft", "Delay 1 Hour"],
            payload: { taskId: escalatable.id }
          };
          
          const nextMsgs = [...whatsappMessages, newMsg];
          setWhatsappMessages(nextMsgs);
          saveStateToServer(tasks, habits, nextMsgs);
        }

        setTimeout(() => setWebhookAlert(null), 6000);
      }
    }, 15000);

    return () => clearInterval(checkInterval);
  }, [tasks, whatsappMessages, habits, coachingStyle]);

  // Task selection & lazy workspace loading
  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setCurrentCardIndex(0);
    setCardFlipped(false);
  };

  // Parser: Unstructured thoughts "Chaos Mind-Dump Box"
  const handleProcessChaos = async () => {
    if (!chaosText.trim()) return;
    setIsParsingChaos(true);
    try {
      const response = await fetch("/api/chaos-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chaosText }),
      });
      const data = await response.json();
      setIsParsingChaos(false);

      if (data.success && data.tasks) {
        // Append parsed tasks to existing tasks
        const newTasks: Task[] = data.tasks.map((parsed: any, idx: number) => {
          let deadlineStr = "No deadline";
          if (parsed.deadline) {
            const parsedTimestamp = Date.parse(parsed.deadline);
            if (!isNaN(parsedTimestamp)) {
              deadlineStr = new Date(parsedTimestamp).toISOString();
            } else {
              deadlineStr = parsed.deadline;
            }
          }
          return {
            id: `task_chaos_${Date.now()}_${idx}`,
            title: parsed.title,
            urgency: parsed.urgency || 5,
            cognitiveWeight: parsed.cognitiveWeight || "Medium",
            deadline: deadlineStr,
            context: parsed.context || "",
            channel: parsed.channel || "WhatsApp",
            whyImportant: parsed.whyImportant || "Deducted by VibePilot",
            obstacle: parsed.obstacle || "Deducted by VibePilot",
            status: "Pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            workspaceType: parsed.workspaceType || "cognitive",
            postponeCount: 0
          };
        });

        const mergedTasks = [...tasks, ...newTasks];
        setTasks(mergedTasks);
        setChaosText("");
        setChaosModalOpen(false);
        saveStateToServer(mergedTasks, habits, whatsappMessages);

        // Auto-select first of the newly added tasks
        if (newTasks.length > 0) {
          setSelectedTask(newTasks[0]);
        }
      }
    } catch (error) {
      setIsParsingChaos(false);
      console.error("Chaos processing error:", error);
    }
  };

  // Re-generate workspace items
  const handleGenerateWorkspace = async (task: Task) => {
    setIsGeneratingWorkspace(true);
    try {
      const response = await fetch("/api/generate-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          context: task.context,
          workspaceType: task.workspaceType || "cognitive",
        }),
      });
      const data = await response.json();
      setIsGeneratingWorkspace(false);

      if (data.success) {
        const updated = tasks.map((t) => {
          if (t.id === task.id) {
            return {
              ...t,
              workspaceDraft: data.workspaceDraft,
              frameworkPoints: data.frameworkPoints,
              studyCards: data.studyCards,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        });

        setTasks(updated);
        const match = updated.find((u) => u.id === task.id);
        if (match) setSelectedTask(match);
        saveStateToServer(updated, habits, whatsappMessages);
      }
    } catch (error) {
      setIsGeneratingWorkspace(false);
      console.error("Workspace builder error:", error);
    }
  };

  // Create customized task manually
  const handleCreateCustomTask = () => {
    if (!newTitle.trim()) return;

    let computedDeadline = "No deadline";
    if (newHasDeadline) {
      if (newHasTime) {
        // combine date and time directly without timezone conversion shift
        computedDeadline = `${newDeadlineDate}T${newDeadlineTime}:00.000Z`;
      } else {
        computedDeadline = newDeadlineDate; // YYYY-MM-DD
      }
    }

    const custom: Task = {
      id: `task_manual_${Date.now()}`,
      title: newTitle,
      urgency: newUrgency,
      cognitiveWeight: newCognitiveWeight,
      deadline: computedDeadline,
      context: newContext,
      channel: newChannel,
      whyImportant: newWhyImportant || "Personal achievement",
      obstacle: newObstacle || "Overthinking",
      status: "Pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workspaceType: newCognitiveWeight === "High" ? "cognitive" : "communication",
      postponeCount: 0
    };

    const nextTasks = [...tasks, custom];
    setTasks(nextTasks);
    setSelectedTask(custom);
    setNewTitle("");
    setNewContext("");
    setNewWhyImportant("");
    setNewObstacle("");
    setNewHasDeadline(false);
    setNewDeadlineDate("2026-06-28");
    setNewDeadlineTime("18:00");
    setCustomTaskOpen(false);
    saveStateToServer(nextTasks, habits, whatsappMessages);
  };

  // Save edited deadline
  const handleSaveDeadlineEdit = () => {
    if (!selectedTask) return;
    
    let computedDeadline = "No deadline";
    if (editHasDeadline) {
      if (editHasTime) {
        // combine date and time directly without timezone conversion shift
        computedDeadline = `${editDeadlineDate}T${editDeadlineTime}:00.000Z`;
      } else {
        computedDeadline = editDeadlineDate; // YYYY-MM-DD
      }
    }

    const updatedTasks = tasks.map((t) => {
      if (t.id === selectedTask.id) {
        return {
          ...t,
          deadline: computedDeadline,
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });

    setTasks(updatedTasks);
    const match = updatedTasks.find((t) => t.id === selectedTask.id);
    if (match) setSelectedTask(match);
    setIsEditingDeadline(false);
    saveStateToServer(updatedTasks, habits, whatsappMessages);
  };

  // Start Edit Task modal populated with current task details
  const handleStartEditTask = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditContext(task.context || "");
    setEditWhyImportant(task.whyImportant || "");
    setEditObstacle(task.obstacle || "");
    setEditUrgency(task.urgency);
    setEditCognitiveWeight(task.cognitiveWeight);
    setEditChannel(task.channel);
    
    if (task.deadline && task.deadline !== "No deadline") {
      setEditModalHasDeadline(true);
      if (task.deadline.includes("T")) {
        const parts = task.deadline.split("T");
        setEditModalDeadlineDate(parts[0]);
        setEditModalDeadlineTime(parts[1].slice(0, 5));
        setEditModalHasTime(true);
      } else {
        setEditModalDeadlineDate(task.deadline);
        setEditModalDeadlineTime("18:00");
        setEditModalHasTime(false);
      }
    } else {
      setEditModalHasDeadline(false);
      setEditModalDeadlineDate("2026-06-28");
      setEditModalDeadlineTime("18:00");
      setEditModalHasTime(true);
    }
    setIsEditingTask(true);
  };

  // Save changes from Edit Task Modal immediately
  const handleSaveEditedTask = () => {
    if (!editingTask) return;

    let computedDeadline = "No deadline";
    if (editModalHasDeadline) {
      if (editModalHasTime) {
        computedDeadline = `${editModalDeadlineDate}T${editModalDeadlineTime}:00.000Z`;
      } else {
        computedDeadline = editModalDeadlineDate;
      }
    }

    const updatedTasks = tasks.map((t) => {
      if (t.id === editingTask.id) {
        return {
          ...t,
          title: editTitle,
          context: editContext,
          whyImportant: editWhyImportant,
          obstacle: editObstacle,
          urgency: editUrgency,
          cognitiveWeight: editCognitiveWeight,
          channel: editChannel,
          deadline: computedDeadline,
          updatedAt: new Date().toISOString(),
          workspaceType: editCognitiveWeight === "High" ? ("cognitive" as const) : ("communication" as const),
        };
      }
      return t;
    });

    setTasks(updatedTasks);
    if (selectedTask && selectedTask.id === editingTask.id) {
      const match = updatedTasks.find((t) => t.id === editingTask.id);
      if (match) setSelectedTask(match);
    }
    
    setIsEditingTask(false);
    setEditingTask(null);
    saveStateToServer(updatedTasks, habits, whatsappMessages);
    showToast("Task updated successfully");
  };

  // Duplicate selected task and save immediately
  const handleDuplicateTask = (task: Task) => {
    const duplicated: Task = {
      ...task,
      id: `task_manual_${Date.now()}`,
      title: `${task.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "Pending",
      postponeCount: 0,
    };
    
    const updatedTasks = [...tasks, duplicated];
    setTasks(updatedTasks);
    setSelectedTask(duplicated);
    saveStateToServer(updatedTasks, habits, whatsappMessages);
    showToast("Task duplicated successfully");
  };

  // Open delete task confirmation dialog
  const handleStartDeleteTask = (task: Task) => {
    setTaskToDelete(task);
    setIsDeletingTask(true);
  };

  // Remove task from state, cancel reminders, clear workspace if active, save to server
  const handleConfirmDeleteTask = () => {
    if (!taskToDelete) return;
    
    const updatedTasks = tasks.filter((t) => t.id !== taskToDelete.id);
    setTasks(updatedTasks);
    
    if (selectedTask && selectedTask.id === taskToDelete.id) {
      setSelectedTask(updatedTasks[0] || null);
    }

    setIsDeletingTask(false);
    setTaskToDelete(null);
    saveStateToServer(updatedTasks, habits, whatsappMessages);
    showToast("Task deleted successfully");
  };

  // Speech to Text Web Speech API implementation
  const startVoiceRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Your browser does not support speech recognition. Please type your thoughts instead, or use the force-simulator.");
      return;
    }

    try {
      setVoiceError(null);
      setRecordingState("listening");
      setIsRecording(true);

      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = "en-US";

      recog.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setChaosText((prev) => prev + (prev.endsWith(" ") || prev === "" ? "" : " ") + finalTranscript);
        }
      };

      recog.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setVoiceError("Microphone permission was denied. Please grant microphone access in browser preferences or use the simulation button below.");
        } else {
          setVoiceError(`Voice input error: ${event.error}. Please try again.`);
        }
        setIsRecording(false);
        setRecordingState("ready");
      };

      recog.onend = () => {
        setIsRecording(false);
        setRecordingState("complete");
      };

      recog.start();
      setRecognition(recog);
    } catch (err: any) {
      console.error(err);
      setVoiceError("Could not access microphone. Please type instead or use the simulation button below.");
      setIsRecording(false);
      setRecordingState("ready");
    }
  };

  const stopVoiceRecording = () => {
    if (recognition) {
      setRecordingState("processing");
      recognition.stop();
      setTimeout(() => {
        setRecordingState("complete");
      }, 800);
    } else {
      setIsRecording(false);
      setRecordingState("complete");
    }
  };

  const simulateVoiceRecording = () => {
    setVoiceError(null);
    setRecordingState("listening");
    setIsRecording(true);
    let phrases = [
      " I missed my computer science lab session yesterday.",
      " Prof Vance told me I can submit it for partial credit by tonight.",
      " And oh, also need to restock organic fruits on Sunday!"
    ];
    let phraseIndex = 0;
    
    const interval = setInterval(() => {
      if (phraseIndex < phrases.length) {
        setChaosText((prev) => prev + phrases[phraseIndex]);
        phraseIndex++;
      } else {
        clearInterval(interval);
        setRecordingState("processing");
        setTimeout(() => {
          setRecordingState("complete");
          setIsRecording(false);
        }, 1000);
      }
    }, 1200);
  };

  // Toggle habit check-off on dashboard
  const handleToggleHabit = (habitId: string) => {
    const nextHabits = habits.map((h) => {
      if (h.id === habitId) {
        const completed = !h.completedToday;
        return {
          ...h,
          completedToday: completed,
          streak: completed ? h.streak + 1 : Math.max(0, h.streak - 1),
          history: {
            ...h.history,
            "2026-06-27": completed, // Today
          },
        };
      }
      return h;
    });

    setHabits(nextHabits);
    saveStateToServer(tasks, nextHabits, whatsappMessages);
  };

  // Adaptive Coach: Custom Motivation Generator
  const handleTriggerCoach = async (task: Task, style: MotivationStyle) => {
    setIsCoaching(true);
    setCoachingStyle(style);
    try {
      let remainingHours = "flexible / no strict deadline";
      if (task.deadline && task.deadline !== "No deadline") {
        const now = new Date("2026-06-27T18:00:00Z"); // Simulator current time
        const diffMs = new Date(task.deadline).getTime() - now.getTime();
        const hrs = Math.round(diffMs / (1000 * 60 * 60));
        remainingHours = hrs > 0 ? `${hrs} hours` : "running out";
      }

      const response = await fetch("/api/motivation-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: task.title,
          whyImportant: task.whyImportant,
          obstacle: task.obstacle,
          style: style,
          remainingHours: remainingHours,
        }),
      });
      const data = await response.json();
      setIsCoaching(false);

      if (data.success) {
        const updated = tasks.map((t) => {
          if (t.id === task.id) {
            return {
              ...t,
              motivationNudge: data.nudge,
            };
          }
          return t;
        });

        setTasks(updated);
        const match = updated.find((u) => u.id === task.id);
        if (match) setSelectedTask(match);
        saveStateToServer(updated, habits, whatsappMessages);
      }
    } catch (error) {
      setIsCoaching(false);
      console.error("Coaching engine error:", error);
    }
  };

  // WhatsApp reply simulator input
  const handleSendWhatsAppMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `wa_user_${Date.now()}`,
      sender: "user",
      text: text,
      timestamp: new Date().toISOString(),
    };

    const updatedMsgs = [...whatsappMessages, userMsg];
    setWhatsappMessages(updatedMsgs);
    setIsStreamingWhatsApp(true);

    try {
      // Simulate reply from Alfred using Gemini parsing
      const aiResponse = await fetch("/api/voice-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userResponse: text,
          activeHabits: habits,
          activeTasks: tasks.filter(t => t.status !== "Completed")
        }),
      });
      const data = await aiResponse.json();
      setIsStreamingWhatsApp(false);

      if (data.success) {
        const replyMsg: ChatMessage = {
          id: `wa_pilot_${Date.now()}`,
          sender: "pilot",
          text: data.speechText,
          timestamp: new Date().toISOString(),
        };

        const finalMsgs = [...updatedMsgs, replyMsg];
        setWhatsappMessages(finalMsgs);

        if (data.updates && Object.keys(data.updates).length > 0) {
          handleVocalSyncComplete(data.updates, data.completedTaskIds || []);
        } else {
          saveStateToServer(tasks, habits, finalMsgs);
        }
      }
    } catch (error) {
      setIsStreamingWhatsApp(false);
      console.error("WhatsApp reply simulator error:", error);
    }
  };

  // WhatsApp Interactive Button Action handler (Mark completed, Review AI Workspace draft, Delay 1 Hour)
  const handleExecuteWhatsAppAction = async (taskId: string, action: string) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    if (action === "complete") {
      const updatedTasks = tasks.map((t) => {
        if (t.id === taskId) {
          return { ...t, status: "Completed" as const, updatedAt: new Date().toISOString() };
        }
        return t;
      });
      setTasks(updatedTasks);
      
      const confirmMsg: ChatMessage = {
        id: `wa_system_${Date.now()}`,
        sender: "pilot",
        text: `✅ Verified task *"${targetTask.title}"* as COMPLETED in chronological database. Outstanding lock-screen widget cleared autonomously!`,
        timestamp: new Date().toISOString(),
      };
      
      const nextMsgs = [...whatsappMessages, confirmMsg];
      setWhatsappMessages(nextMsgs);
      saveStateToServer(updatedTasks, habits, nextMsgs);

      // Refresh current selected task if applicable
      const match = updatedTasks.find(t => t.id === selectedTask?.id);
      if (match) setSelectedTask(match);
    } 
    else if (action === "review") {
      setIsStreamingWhatsApp(true);
      // Retrieve the template or outline and push directly into WhatsApp chat
      setTimeout(() => {
        const draftContent = targetTask.workspaceDraft || "Let me build a draft model template for you...";
        const bulletFramework = targetTask.frameworkPoints 
          ? `*AI Framework Outline*:\n${targetTask.frameworkPoints.map(p => `• ${p}`).join("\n")}`
          : "";

        const payloadText = targetTask.workspaceType === "communication"
          ? `📝 *Auto-Workspace Email Draft Template*:\n\n\`\`\`\n${draftContent}\n\`\`\`\n\n_Ready to deploy._`
          : `📚 *Auto-Workspace Study Blueprint*:\n\n${bulletFramework}\n\n_Interactive flashcards synced inside dashboard._`;

        const replyMsg: ChatMessage = {
          id: `wa_pilot_draft_${Date.now()}`,
          sender: "pilot",
          text: payloadText,
          timestamp: new Date().toISOString(),
        };

        const finalMsgs = [...whatsappMessages, replyMsg];
        setWhatsappMessages(finalMsgs);
        setIsStreamingWhatsApp(false);
        saveStateToServer(tasks, habits, finalMsgs);
      }, 1000);
    } 
    else if (action === "delay") {
      const updatedTasks = tasks.map((t) => {
        if (t.id === taskId) {
          const isParsed = t.deadline && t.deadline !== "No deadline" && !isNaN(Date.parse(t.deadline));
          const baseTime = isParsed ? new Date(t.deadline) : new Date();
          const postponeTime = new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString();
          return {
            ...t,
            deadline: postponeTime,
            status: "Delayed" as const,
            postponeCount: t.postponeCount + 1,
            lastPostponedAt: new Date().toISOString()
          };
        }
        return t;
      });
      setTasks(updatedTasks);

      const postponeMsg: ChatMessage = {
        id: `wa_system_${Date.now()}`,
        sender: "pilot",
        text: `⏳ Chronological timeline updated. Task *"${targetTask.title}"* deadline delayed by exactly 1 hour.`,
        timestamp: new Date().toISOString(),
      };

      const nextMsgs = [...whatsappMessages, postponeMsg];
      setWhatsappMessages(nextMsgs);
      saveStateToServer(updatedTasks, habits, nextMsgs);

      // Refresh current selected task if applicable
      const match = updatedTasks.find(t => t.id === selectedTask?.id);
      if (match) setSelectedTask(match);
    }
  };

  // 9:00 PM Vocal Sync Callback to mutate state autonomously
  const handleVocalSyncComplete = (updatedHabits: Record<string, boolean>, completedTaskIds: string[]) => {
    // 1. Mutate habits
    const nextHabits = habits.map((h) => {
      if (updatedHabits[h.id] !== undefined) {
        const completed = updatedHabits[h.id];
        return {
          ...h,
          completedToday: completed,
          streak: completed ? h.streak + 1 : Math.max(0, h.streak - 1),
          history: {
            ...h.history,
            "2026-06-27": completed,
          }
        };
      }
      return h;
    });

    // 2. Mutate tasks
    const nextTasks = tasks.map((t) => {
      if (completedTaskIds.includes(t.id)) {
        return {
          ...t,
          status: "Completed" as const,
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    });

    setHabits(nextHabits);
    setTasks(nextTasks);
    
    // Sync current selection
    if (selectedTask) {
      const match = nextTasks.find(t => t.id === selectedTask.id);
      if (match) setSelectedTask(match);
    }

    saveStateToServer(nextTasks, nextHabits, whatsappMessages);
  };

  // Calculation for general statistics
  const pendingCount = tasks.filter((t) => t.status !== "Completed").length;
  const criticalCount = tasks.filter((t) => t.urgency >= 8 && t.status !== "Completed").length;
  const habitsCompletedCount = habits.filter((h) => h.completedToday).length;
  const habitsProgress = habits.length ? Math.round((habitsCompletedCount / habits.length) * 100) : 0;
  
  const completedTasksToday = tasks.filter((t) => t.status === "Completed").length;
  const generalProgressPercent = tasks.length ? Math.round((completedTasksToday / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#080808] text-[#E5E5E5] font-sans selection:bg-white/10 selection:text-white">
      
      {/* Visual Webhook Escalation Alerts (Floating HUD) */}
      {webhookAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90%] bg-[#120404] border border-red-500/40 text-red-200 p-3.5 rounded-2xl shadow-2xl flex items-start gap-3 animate-bounce red-zone-glow">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="font-bold text-[9px] uppercase tracking-widest font-mono text-red-400">Headless Escalation Webhook</h5>
            <p className="text-xs mt-0.5 font-sans leading-snug">{webhookAlert}</p>
          </div>
        </div>
      )}
 
      {/* Main Container */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Navigation / Brand Header */}
        <header className="grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-4 border-b border-white/5 pb-6">
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center shadow-md shadow-white/5">
                  <Sparkles className="w-4 h-4 fill-black" />
                </div>
                <h1 className="text-xl md:text-3xl font-display font-bold tracking-tight text-white italic">
                  Ignite
                </h1>
              </div>
              <div className="md:hidden bg-white/3 border border-white/5 rounded-xl px-3 py-1.5 flex items-center gap-2 shrink-0">
                <Flame className="w-3.5 h-3.5 text-zinc-400" />
                <div className="text-[9px] uppercase font-mono tracking-wider text-zinc-400">
                  Today's Progress: <span className="text-white font-bold">{habitsProgress}%</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-300 font-sans">
              Turn intention into action.
            </p>
          </div>

          {/* Quick HUD Metrics */}
          <div className="md:col-span-4 flex items-center gap-2 flex-wrap md:justify-center">
            <div className="hidden md:flex bg-white/3 border border-white/5 rounded-xl px-3 py-1.5 items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-zinc-400" />
              <div className="text-[9px] uppercase font-mono tracking-wider text-zinc-400">
                Today's Progress: <span className="text-white font-bold">{habitsProgress}%</span>
              </div>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl px-3 py-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
              <div className="text-[9px] uppercase font-mono tracking-wider text-zinc-400">
                Critical timelines: <span className="text-red-400 font-bold">{criticalCount}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="md:col-span-3 flex items-center gap-2 md:justify-end shrink-0 w-full md:w-auto">
            <button
              onClick={() => setCustomTaskOpen(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-[10px] uppercase font-mono font-bold tracking-wider px-5 py-2.5 rounded-xl transition shadow-sm"
              title="Add a Custom Task with anti-procrastination coaching questions"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
            <button
              onClick={() => setChaosModalOpen(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-white hover:bg-zinc-200 text-black text-[10px] uppercase font-mono font-bold tracking-wider px-5 py-2.5 rounded-xl shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Mind-Dump</span>
            </button>
          </div>
        </header>
 
        {/* Dashboard Grid System */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUMN 1: Calendar View + Daily Habits Tracking (width 7) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Chronological View Panel */}
            <div className="h-[480px]">
              <CalendarView
                tasks={tasks}
                onSelectTask={handleSelectTask}
                selectedTaskId={selectedTask?.id}
                onEditTask={handleStartEditTask}
                onDuplicateTask={handleDuplicateTask}
                onDeleteTask={handleStartDeleteTask}
              />
            </div>
 
            {/* Today's Progress monitoring panel */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div>
                  <h3 className="text-sm font-sans font-bold text-zinc-200">Today's Progress</h3>
                  <p className="text-[10px] text-zinc-500 font-sans tracking-wide">Dynamic real-time timeline completion</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-emerald-400 font-mono font-bold bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                    {completedTasksToday} / {tasks.length} Tasks Cleared
                  </span>
                  <span className="text-[9px] text-amber-400 font-mono font-bold bg-amber-950/40 border border-amber-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>Streak: 5 Days</span>
                  </span>
                </div>
              </div>

              {/* Elegant glow progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-medium">Total Accomplishment Metrics</span>
                  <span className="font-bold text-white text-sm">{generalProgressPercent}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden relative border border-white/5">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    style={{ width: `${generalProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* Subtitle / reward hint */}
              <div className="text-[11px] text-zinc-400 bg-white/3 border border-white/5 rounded-xl p-3 flex items-center justify-between font-sans">
                <span>You have completed the hardest parts of your goals today! Keep going.</span>
                <span className="font-mono text-[9px] text-zinc-500 uppercase">Ignite Reward Engine</span>
              </div>

              {/* Daily habits checklist within progress widget */}
              <div className="pt-2">
                <span className="text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider block mb-2">
                  Daily Accountability Habits
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {habits.map((h) => (
                    <div
                       key={h.id}
                       onClick={() => handleToggleHabit(h.id)}
                       className={`cursor-pointer p-3.5 border rounded-xl flex items-center justify-between transition-all duration-200 ${
                         h.completedToday
                           ? "bg-emerald-950/25 border-emerald-500/30 text-emerald-400 shadow-sm"
                           : "bg-white/2 border-white/5 text-zinc-400 hover:bg-white/5 hover:border-white/10"
                       }`}
                    >
                      <div className="space-y-1">
                        <span className="block text-xs font-semibold leading-tight">{h.title}</span>
                        <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          Streak: {h.streak}
                        </span>
                      </div>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        h.completedToday
                          ? "bg-emerald-500 border-transparent text-black"
                          : "border-zinc-800"
                      }`}>
                        {h.completedToday && <CheckCircle className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
 
            {/* Layer B: The "50% Done" Automated Workspace Panel */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-white/5 text-zinc-300 rounded-lg border border-white/10">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-sans font-bold text-zinc-100">
                      AI Workspace
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-sans">
                      The AI has already completed the hardest part. You only need to take the final step.
                    </p>
                  </div>
                </div>
 
                {selectedTask && (
                  <button
                    onClick={() => handleGenerateWorkspace(selectedTask)}
                    disabled={isGeneratingWorkspace}
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-[9px] font-mono uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${isGeneratingWorkspace ? "animate-spin text-zinc-400" : ""}`} />
                    <span>Re-build</span>
                  </button>
                )}
              </div>
 
              {!selectedTask ? (
                <div className="text-center py-8 text-zinc-500 text-xs font-mono uppercase tracking-widest">
                  Select a pending timeline task to load its personalized cognitive workspace.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Task Header details */}
                  <div className="flex flex-col gap-2 bg-white/2 p-4 border border-white/5 rounded-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-sans font-bold text-zinc-100">{selectedTask.title}</h4>
                        <p className="text-xs text-zinc-400 font-sans leading-relaxed">{selectedTask.context}</p>
                      </div>
                      <span className="text-[9px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-zinc-400 uppercase tracking-wider shrink-0">
                        {selectedTask.workspaceType === "communication" ? "Contact/Draft" : "Review/Notes"}
                      </span>
                    </div>

                    {/* AI Prepared Alert Tagline */}
                    <div className="mt-2.5 pt-2.5 border-t border-white/5 text-[11px] text-emerald-400 font-sans flex items-start gap-1.5 leading-normal">
                      <span className="font-bold shrink-0">AI Prepared:</span>
                      <span>This {selectedTask.workspaceType === "communication" ? "draft template" : "study blueprint and flashcard deck"} has been autonomously pre-generated based on your mental dump so you can execute immediately.</span>
                    </div>

                    {/* Inline Deadline View and Editor */}
                    <div className="mt-2.5 pt-2.5 border-t border-white/5 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-zinc-400 font-sans">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Deadline:</span>
                          <span className="text-zinc-200 font-semibold font-mono">
                            {formatDeadline(selectedTask.deadline)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            // Open deadline editor inline
                            setIsEditingDeadline(!isEditingDeadline);
                            if (selectedTask.deadline && selectedTask.deadline !== "No deadline") {
                              setEditHasDeadline(true);
                              if (selectedTask.deadline.includes("T")) {
                                setEditHasTime(true);
                                setEditDeadlineDate(selectedTask.deadline.split("T")[0]);
                                setEditDeadlineTime(selectedTask.deadline.split("T")[1].slice(0, 5));
                              } else {
                                setEditHasTime(false);
                                setEditDeadlineDate(selectedTask.deadline);
                                setEditDeadlineTime("12:00");
                              }
                            } else {
                              setEditHasDeadline(false);
                              setEditHasTime(false);
                              setEditDeadlineDate("2026-06-28");
                              setEditDeadlineTime("18:00");
                            }
                          }}
                          className="text-[10px] font-mono text-zinc-400 hover:text-white uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded border border-white/5 transition"
                        >
                          {isEditingDeadline ? "Cancel" : "Edit Deadline"}
                        </button>
                      </div>

                      {isEditingDeadline && (
                        <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-3 mt-1 animate-fade-in">
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editHasDeadline}
                                onChange={(e) => setEditHasDeadline(e.target.checked)}
                                className="rounded bg-black border-white/10 accent-white"
                              />
                              <span>Enable Deadline</span>
                            </label>

                            {editHasDeadline && (
                              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editHasTime}
                                  onChange={(e) => setEditHasTime(e.target.checked)}
                                  className="rounded bg-black border-white/10 accent-white"
                                />
                                <span>Include Due Time</span>
                              </label>
                            )}
                          </div>

                          {editHasDeadline && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <span className="text-[9px] uppercase font-mono text-zinc-500 block">Due Date</span>
                                <div 
                                   onClick={(e) => {
                                     const inputEl = e.currentTarget.querySelector('input');
                                     if (inputEl) {
                                       try {
                                         inputEl.showPicker();
                                       } catch (err) {
                                         console.error("Failed to showPicker", err);
                                         inputEl.focus();
                                         inputEl.click();
                                       }
                                     }
                                   }}
                                   className="relative flex items-center cursor-pointer w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-white/30 focus-within:border-white/30 transition group"
                                 >
                                   <Calendar className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 mr-2 transition-colors pointer-events-none" />
                                   <input
                                     type="date"
                                     value={editDeadlineDate}
                                     onChange={(e) => setEditDeadlineDate(e.target.value)}
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       try {
                                         e.currentTarget.showPicker();
                                       } catch (err) {
                                         console.error("Failed to showPicker inside click", err);
                                       }
                                     }}
                                     className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer [color-scheme:dark]"
                                   />
                                 </div>
                              </div>

                              {editHasTime && (
                                <div className="space-y-1">
                                  <span className="text-[9px] uppercase font-mono text-zinc-500 block">Due Time</span>
                                  <div 
                                     onClick={(e) => {
                                       const inputEl = e.currentTarget.querySelector('input');
                                       if (inputEl) {
                                         try {
                                           inputEl.showPicker();
                                         } catch (err) {
                                           console.error("Failed to showPicker", err);
                                           inputEl.focus();
                                           inputEl.click();
                                         }
                                       }
                                     }}
                                     className="relative flex items-center cursor-pointer w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-white/30 focus-within:border-white/30 transition group"
                                   >
                                     <Clock className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 mr-2 transition-colors pointer-events-none" />
                                     <input
                                       type="time"
                                       value={editDeadlineTime}
                                       onChange={(e) => setEditDeadlineTime(e.target.value)}
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         try {
                                           e.currentTarget.showPicker();
                                         } catch (err) {
                                           console.error("Failed to showPicker inside click", err);
                                         }
                                       }}
                                       className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer [color-scheme:dark]"
                                     />
                                   </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
                            <button
                              type="button"
                              onClick={handleSaveDeadlineEdit}
                              className="bg-white hover:bg-zinc-200 text-black text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition"
                            >
                              Save Deadline
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
 
                  {/* WORKSPACE TYPE A: COMMUNICATION DRAFTS */}
                  {selectedTask.workspaceType === "communication" && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
                          Ready Email Template Draft (One-click Copy)
                        </span>
                        <span className="text-[8px] font-mono bg-white/5 text-zinc-300 border border-white/15 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">
                          Draft Formulated
                        </span>
                      </div>
                      
                      <div className="relative">
                        <textarea
                          value={selectedTask.workspaceDraft || "Generating draft models..."}
                          readOnly
                          className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-3.5 text-xs font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-white/10"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedTask.workspaceDraft || "");
                            alert("Draft copied to clipboard! Ready to send.");
                          }}
                          className="absolute bottom-2.5 right-2.5 bg-white hover:bg-zinc-200 text-black text-[9px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition shadow-md"
                        >
                          Copy & Send
                        </button>
                      </div>
                    </div>
                  )}
 
                  {/* WORKSPACE TYPE B: COGNITIVE STUDY TOOLS */}
                  {selectedTask.workspaceType === "cognitive" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Outline framework */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
                          3-Bullet Blueprint Outline
                        </span>
                        <div className="bg-white/2 border border-white/5 p-3.5 rounded-xl space-y-3 min-h-[140px]">
                          {selectedTask.frameworkPoints?.map((p, i) => (
                            <div key={i} className="flex gap-2 text-xs leading-relaxed">
                              <span className="text-zinc-200 font-mono font-bold shrink-0">{i + 1}.</span>
                              <p className="text-zinc-300 font-sans">{p}</p>
                            </div>
                          )) || <p className="text-xs text-zinc-500 font-mono">Generating study framework outlines...</p>}
                        </div>
                      </div>
 
                      {/* Interactive Flip Cards */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
                          Interactive Flashcards ({currentCardIndex + 1} / {selectedTask.studyCards?.length || 0})
                        </span>
 
                        {selectedTask.studyCards && selectedTask.studyCards.length > 0 ? (
                          <div className="space-y-2">
                            {/* Card stage */}
                            <div
                              onClick={() => setCardFlipped(!cardFlipped)}
                              className="cursor-pointer h-28 bg-white/3 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:border-white/20 transition relative overflow-hidden"
                            >
                              <div className="absolute top-2.5 right-2.5 text-[8px] font-mono text-zinc-500 uppercase tracking-widest font-semibold">
                                {cardFlipped ? "Answer" : "Question"}
                              </div>
                              <p className="text-sm text-zinc-200 pr-10 leading-relaxed font-sans font-medium">
                                {cardFlipped
                                  ? selectedTask.studyCards[currentCardIndex].back
                                  : selectedTask.studyCards[currentCardIndex].front}
                              </p>
                              <span className="text-[8px] font-mono text-zinc-500 text-center block mt-1.5 uppercase tracking-widest font-medium">
                                (Tap to flip card)
                              </span>
                            </div>
 
                            {/* Card Navigation */}
                            <div className="flex justify-between items-center pt-0.5">
                              <button
                                onClick={() => {
                                  setCurrentCardIndex(prev => Math.max(0, prev - 1));
                                  setCardFlipped(false);
                                }}
                                disabled={currentCardIndex === 0}
                                className="text-[9px] font-mono text-zinc-400 disabled:opacity-30 hover:text-white transition uppercase tracking-widest"
                              >
                                ← Prev
                              </button>
                              <button
                                onClick={() => {
                                  setCurrentCardIndex(prev => Math.min((selectedTask.studyCards?.length || 1) - 1, prev + 1));
                                  setCardFlipped(false);
                                }}
                                disabled={currentCardIndex === (selectedTask.studyCards?.length || 1) - 1}
                                className="text-[9px] font-mono text-zinc-400 disabled:opacity-30 hover:text-white transition uppercase tracking-widest"
                              >
                                Next →
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white/2 border border-white/5 rounded-xl p-6 text-center text-xs text-zinc-500 min-h-[140px] flex items-center justify-center font-mono">
                            Generating study cards...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
 
          </div>
 
          {/* COLUMN 2: Sidebar containing Lock screen widget, Anti-procrastination Coach, WhatsApp Simulator, Vocal Sync Call */}
          <div className="lg:col-span-5 space-y-6">
 
            {/* Lock-Screen Simulation push widget (pinned permanently at top of sidebar) */}
            <div className="bg-[#120404] border-2 border-red-500/30 rounded-2xl overflow-hidden shadow-xl red-zone-glow">
              <div className="bg-[#1a0505] px-4 py-2.5 border-b border-red-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-400">
                  <Lock className="w-4 h-4" />
                  <span className="text-xs uppercase font-mono font-bold tracking-widest">
                    Device Lock-Screen Alerts
                  </span>
                </div>
                <span className="text-[9px] font-mono bg-red-950 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest animate-pulse">
                  STUCK UNTIL CLEARED
                </span>
              </div>
 
              {/* Outstanding locked alerts */}
              <div className="p-3 bg-black/40 divide-y divide-white/5">
                {tasks.filter((t) => t.status !== "Completed" && t.urgency >= 8).length === 0 ? (
                  <div className="text-center py-4 text-[10px] text-zinc-500 font-mono uppercase tracking-widest leading-relaxed">
                    All critical lock-screen cards completed and cleared. Device unlocked.
                  </div>
                ) : (
                  tasks
                    .filter((t) => t.status !== "Completed" && t.urgency >= 8)
                    .map((task) => (
                      <div key={task.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h5 className="text-xs font-display font-bold text-red-400 leading-tight">
                            {task.title}
                          </h5>
                          <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug line-clamp-1 font-sans">{task.context}</p>
                          <span className="inline-block text-[8px] font-mono bg-red-950/40 text-red-400 px-1.5 py-0.2 rounded border border-red-500/20 mt-1 uppercase tracking-widest font-semibold">
                            Locked on client overlay
                          </span>
                        </div>
                        <button
                          onClick={() => handleExecuteWhatsAppAction(task.id, "complete")}
                          className="shrink-0 text-[9px] font-mono font-bold bg-white text-black hover:bg-zinc-200 px-2 py-1 rounded-lg transition uppercase tracking-wider shadow-sm"
                        >
                          Resolve
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
 
            {/* Anti-procrastination motivation engine cards */}
            {selectedTask && selectedTask.status !== "Completed" && (
              <div className="glass rounded-2xl p-4 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs font-sans font-bold text-zinc-100 uppercase tracking-wider">
                        Executive Coaching Advisor
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Personalized anti-procrastination nudge</p>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-[9px] font-mono bg-white/5 text-zinc-400 border border-white/10 px-1.5 rounded uppercase">
                      Tone: {coachingStyle}
                    </span>
                  </div>
                </div>
 
                {/* Main Motivation nudge view */}
                <div className="space-y-3 relative z-10">
                  <div className="bg-white/3 p-3.5 border border-white/5 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Coaching Insight</span>
                    </div>
                    <p className="text-xs text-zinc-200 leading-relaxed italic font-sans font-medium">
                      "{selectedTask.motivationNudge || "Choose a motivational coaching style below to generate your personalized anti-procrastination nudge..."}"
                    </p>
                  </div>
 
                  {/* Adaptive Style Selector */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-mono font-bold text-zinc-500 tracking-wider block">
                      Experiment with adaptive coaching styles
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(["encouraging", "logical", "urgency", "humorous", "empathetic", "achievement"] as MotivationStyle[]).map((style) => (
                        <button
                          key={style}
                          onClick={() => handleTriggerCoach(selectedTask, style)}
                          disabled={isCoaching}
                          className={`text-[9px] font-mono px-2 py-1 rounded border transition-all ${
                            coachingStyle === style
                              ? "bg-white border-transparent text-black font-semibold shadow-sm"
                              : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
 
                  {/* Quick Nudge Action buttons */}
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleExecuteWhatsAppAction(selectedTask.id, "complete")}
                      className="flex-1 bg-white hover:bg-zinc-200 text-black text-[10px] uppercase font-mono font-bold tracking-wider py-1.5 rounded-xl transition"
                    >
                      Start Now
                    </button>
                    <button
                      onClick={() => handleExecuteWhatsAppAction(selectedTask.id, "delay")}
                      className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-[10px] uppercase font-mono font-bold tracking-wider py-1.5 rounded-xl transition"
                    >
                      Remind Later
                    </button>
                  </div>
                </div>
              </div>
            )}
 
            {/* WhatsApp Simulator Panel */}
            <div className="h-[400px]">
              <WhatsAppSimulator
                messages={whatsappMessages}
                onSendMessage={handleSendWhatsAppMessage}
                onExecuteAction={handleExecuteWhatsAppAction}
                tasks={tasks}
                isStreaming={isStreamingWhatsApp}
              />
            </div>
 
            {/* 9:00 PM Voice Call sync Panel */}
            <VocalSyncSimulator
              habits={habits}
              tasks={tasks}
              onSyncComplete={handleVocalSyncComplete}
              isSyncing={isSyncing}
              setIsSyncing={setIsSyncing}
            />
 
          </div>
 
        </div>
 
      </div>
 
      {/* Floating Action widget trigger button with dismissible first-launch tooltip */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5">
        {showDumpTooltip && (
          <div className="bg-[#121212] border border-white/10 text-zinc-200 text-xs px-3.5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 max-w-xs animate-bounce font-sans relative">
            <span>Dump everything on your mind. I'll organize it.</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDumpTooltip(false);
              }}
              className="text-zinc-500 hover:text-zinc-300 ml-1.5 font-bold p-0.5 hover:bg-white/5 rounded"
            >
              <X className="w-3 h-3" />
            </button>
            {/* Tooltip arrow */}
            <div className="absolute -bottom-1 right-5 w-2.5 h-2.5 bg-[#121212] border-r border-b border-white/10 rotate-45" />
          </div>
        )}
        <button
          onClick={() => {
            setChaosModalOpen(true);
            setShowDumpTooltip(false);
          }}
          className="w-12 h-12 rounded-full bg-white border border-white/15 hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-2xl transition group relative"
          title="Chaos Mind-Dump Widget"
        >
          <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300 fill-black" />
          {/* Tooltip */}
          <span className="absolute right-14 whitespace-nowrap bg-black border border-white/10 text-zinc-300 text-[10px] font-mono px-2.5 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none">
            Chaos Mind-Dump Box
          </span>
        </button>
      </div>
 
      {/* CHAOS MIND-DUMP BOX MODAL */}
      {chaosModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-zinc-300" />
                <h4 className="font-display italic font-bold text-zinc-100">The Chaos Mind-Dump Box</h4>
              </div>
              <button
                onClick={() => setChaosModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
 
            {/* Form Content */}
            <div className="p-4 space-y-4">
              <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                Paste your messy mental logs, raw audio transcripts, or unfiltered text here. VibePilot's AI parser will break down the context, allocate cognitive weight, score urgency, and create dynamic chronological tasks autonomously.
              </p>

              {/* Mic Input Section */}
              <div className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    className={`p-2 rounded-lg transition-all flex items-center justify-center h-8 w-8 shrink-0 ${
                      recordingState === "listening"
                        ? "bg-red-500 text-white animate-pulse"
                        : recordingState === "processing"
                        ? "bg-amber-500 text-white"
                        : recordingState === "complete"
                        ? "bg-emerald-500 text-white"
                        : "bg-white/10 text-zinc-300 hover:bg-white/20"
                    }`}
                    title={
                      recordingState === "listening"
                        ? "Stop Listening"
                        : recordingState === "processing"
                        ? "Transcribing..."
                        : recordingState === "complete"
                        ? "Transcription Complete! Tap to record again."
                        : "Start Voice Recording"
                    }
                  >
                    {recordingState === "processing" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                  <div className="text-xs">
                    <span className="font-semibold block text-zinc-200">
                      {recordingState === "ready" && "Record thoughts via mic"}
                      {recordingState === "listening" && "Listening... speak now"}
                      {recordingState === "processing" && "AI processing transcription..."}
                      {recordingState === "complete" && "Voice Dump Synced!"}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {recordingState === "ready" && "Tap mic to dump your mind vocally"}
                      {recordingState === "listening" && "Recording live audio thoughts..."}
                      {recordingState === "processing" && "Parsing phonetic brainwaves..."}
                      {recordingState === "complete" && "Transcribed successfully! Edit text below."}
                    </span>
                  </div>
                </div>

                {/* Status indicator pill */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-bold ${
                    recordingState === "listening"
                      ? "bg-red-950/40 border-red-500/20 text-red-400"
                      : recordingState === "processing"
                      ? "bg-amber-950/40 border-amber-500/20 text-amber-400"
                      : recordingState === "complete"
                      ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-400"
                      : "bg-zinc-950/40 border-zinc-500/10 text-zinc-500"
                  }`}>
                    {recordingState}
                  </span>
                </div>
              </div>

              {voiceError && (
                <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Microphone Status Indicator</span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-zinc-300">
                    {voiceError} Please ensure your browser has microphone permissions enabled for this app.
                  </p>
                  <button
                    type="button"
                    onClick={simulateVoiceRecording}
                    className="self-start text-[10px] font-mono text-amber-400 hover:text-amber-300 underline font-semibold uppercase tracking-wider"
                  >
                    Force-Simulate Speech-To-Text Instead
                  </button>
                </div>
              )}

              <textarea
                value={chaosText}
                onChange={(e) => setChaosText(e.target.value)}
                placeholder="E.g. 'I missed physics lab yesterday. Prof Vance says he will give me partial credit if I email it before midnight today. Also have my history midterm next Friday and need to restock organic groceries this weekend...'"
                className="w-full h-36 bg-black/40 border border-white/10 rounded-xl p-3.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/30"
              />

              <div className="flex gap-2 justify-between items-center">
                <button
                  type="button"
                  onClick={() => setChaosText("I have my history midterm on Friday, July 3rd which I need to get ready for. I keep scrolling Instagram instead of preparing! Also need to buy organic high-protein groceries at the market tomorrow at 6pm.")}
                  className="text-[9px] font-mono text-zinc-400 hover:text-white uppercase tracking-wider font-bold"
                >
                  Insert Sample Chaos
                </button>

                <button
                  type="button"
                  onClick={simulateVoiceRecording}
                  className="text-[9px] font-mono text-amber-400 hover:text-amber-300 uppercase tracking-wider font-bold"
                >
                  Simulate Voice Ingestion
                </button>
              </div>
            </div>
 
            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-white/1 flex justify-end gap-2.5">
              <button
                onClick={() => setChaosModalOpen(false)}
                className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg font-mono uppercase tracking-wider text-[10px]"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessChaos}
                disabled={isParsingChaos || !chaosText.trim()}
                className="bg-white hover:bg-zinc-200 disabled:opacity-40 text-black text-xs font-bold font-mono uppercase tracking-wider px-4 py-1.5 rounded-xl transition flex items-center gap-1.5"
              >
                {isParsingChaos ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Structuring Chaos...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-black" />
                    <span>Process Mind-Dump</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM TASK MODAL */}
      {customTaskOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-zinc-300" />
                <h4 className="font-sans font-bold text-zinc-100">Create Custom Task</h4>
              </div>
              <button
                onClick={() => setCustomTaskOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Task Title */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                  Task Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="E.g. Submit Physics Lab Report"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Context / Description */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                  Context / Background
                </label>
                <textarea
                  value={newContext}
                  onChange={(e) => setNewContext(e.target.value)}
                  placeholder="Provide background context... (e.g., Prof Vance allowed 50% credit if submitted by midnight)"
                  className="w-full h-16 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Coaching Questions: Why Important & Obstacle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    Why is this important?
                  </label>
                  <input
                    type="text"
                    value={newWhyImportant}
                    onChange={(e) => setNewWhyImportant(e.target.value)}
                    placeholder="E.g. Keeps my GPA above 3.5"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    What usually stops you?
                  </label>
                  <input
                    type="text"
                    value={newObstacle}
                    onChange={(e) => setNewObstacle(e.target.value)}
                    placeholder="E.g. Feeling overwhelmed with the math"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {/* Urgency & Cognitive Weight & Channel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Urgency */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    Urgency ({newUrgency}/10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={newUrgency}
                    onChange={(e) => setNewUrgency(parseInt(e.target.value))}
                    className="w-full accent-white"
                  />
                </div>

                {/* Cognitive Weight */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    Cognitive Weight
                  </label>
                  <select
                    value={newCognitiveWeight}
                    onChange={(e) => setNewCognitiveWeight(e.target.value as any)}
                    className="w-full bg-black border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                  >
                    <option value="Low">Low (Simple Email)</option>
                    <option value="Medium">Medium (Regular Task)</option>
                    <option value="High">High (Needs Blueprint)</option>
                  </select>
                </div>

                {/* Communication Channel */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    Contact Channel
                  </label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value as any)}
                    className="w-full bg-black border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                  >
                    <option value="WhatsApp">WhatsApp Bot</option>
                    <option value="Call">Phone Call Sync</option>
                  </select>
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-3.5 pt-2.5 border-t border-white/5">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newHasDeadline}
                      onChange={(e) => setNewHasDeadline(e.target.checked)}
                      className="rounded bg-black border-white/10 accent-white"
                    />
                    <span className="font-mono text-[10px] uppercase font-bold text-zinc-400">Set Task Deadline</span>
                  </label>

                  {newHasDeadline && (
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHasTime}
                        onChange={(e) => setNewHasTime(e.target.checked)}
                        className="rounded bg-black border-white/10 accent-white"
                      />
                      <span className="font-mono text-[10px] uppercase font-bold text-zinc-400">Include Due Time</span>
                    </label>
                  )}
                </div>

                {newHasDeadline ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-fade-in">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-zinc-500 block">
                        Due Date
                      </label>
                      <div 
                        onClick={(e) => {
                          const inputEl = e.currentTarget.querySelector('input');
                          if (inputEl) {
                            try {
                              inputEl.showPicker();
                            } catch (err) {
                              console.error("Failed to showPicker", err);
                              inputEl.focus();
                              inputEl.click();
                            }
                          }
                        }}
                        className="relative flex items-center cursor-pointer w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 hover:border-white/30 focus-within:border-white/30 transition group"
                      >
                        <Calendar className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 mr-2 transition-colors pointer-events-none" />
                        <input
                          type="date"
                          value={newDeadlineDate}
                          onChange={(e) => setNewDeadlineDate(e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              e.currentTarget.showPicker();
                            } catch (err) {
                              console.error("Failed to showPicker inside click", err);
                            }
                          }}
                          className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    {newHasTime && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono font-bold text-zinc-500 block">
                          Due Time
                        </label>
                        <div 
                          onClick={(e) => {
                            const inputEl = e.currentTarget.querySelector('input');
                            if (inputEl) {
                              try {
                                inputEl.showPicker();
                              } catch (err) {
                                console.error("Failed to showPicker", err);
                                inputEl.focus();
                                inputEl.click();
                              }
                            }
                          }}
                          className="relative flex items-center cursor-pointer w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 hover:border-white/30 focus-within:border-white/30 transition group"
                        >
                          <Clock className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 mr-2 transition-colors pointer-events-none" />
                          <input
                            type="time"
                            value={newDeadlineTime}
                            onChange={(e) => setNewDeadlineTime(e.target.value)}
                            onClick={(e) => {
                              e.stopPropagation();
                              try {
                                e.currentTarget.showPicker();
                              } catch (err) {
                                console.error("Failed to showPicker inside click", err);
                              }
                            }}
                            className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer [color-scheme:dark]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-white/3 border border-white/5 rounded-xl text-xs text-zinc-500 italic font-sans">
                    No deadline will be assigned to this task. It will remain flexible.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-white/1 flex justify-end gap-2.5">
              <button
                onClick={() => setCustomTaskOpen(false)}
                className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg font-mono uppercase tracking-wider text-[10px]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomTask}
                disabled={!newTitle.trim()}
                className="bg-white hover:bg-zinc-200 disabled:opacity-40 text-black text-xs font-bold font-mono uppercase tracking-wider px-4 py-1.5 rounded-xl transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Task</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL */}
      {isEditingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/3">
              <div className="flex items-center gap-2">
                <h4 className="font-sans font-bold text-zinc-100">Edit Task</h4>
              </div>
              <button
                onClick={() => {
                  setIsEditingTask(false);
                  setEditingTask(null);
                }}
                className="text-zinc-500 hover:text-zinc-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Task Title */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                  Task Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Context / Description */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                  Context / Background
                </label>
                <textarea
                  value={editContext}
                  onChange={(e) => setEditContext(e.target.value)}
                  className="w-full h-16 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Coaching Questions: Why Important & Obstacle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    Why is this important?
                  </label>
                  <input
                    type="text"
                    value={editWhyImportant}
                    onChange={(e) => setEditWhyImportant(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    What usually stops you?
                  </label>
                  <input
                    type="text"
                    value={editObstacle}
                    onChange={(e) => setEditObstacle(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {/* Urgency & Cognitive Weight & Channel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Urgency */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    Urgency ({editUrgency}/10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={editUrgency}
                    onChange={(e) => setEditUrgency(parseInt(e.target.value))}
                    className="w-full accent-white"
                  />
                </div>

                {/* Cognitive Weight */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    Cognitive Weight
                  </label>
                  <select
                    value={editCognitiveWeight}
                    onChange={(e) => setEditCognitiveWeight(e.target.value as any)}
                    className="w-full bg-black border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                  >
                    <option value="Low">Low (Simple Email)</option>
                    <option value="Medium">Medium (Regular Task)</option>
                    <option value="High">High (Needs Blueprint)</option>
                  </select>
                </div>

                {/* Communication Channel */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-zinc-400 block">
                    Contact Channel
                  </label>
                  <select
                    value={editChannel}
                    onChange={(e) => setEditChannel(e.target.value as any)}
                    className="w-full bg-black border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                  >
                    <option value="WhatsApp">WhatsApp Bot</option>
                    <option value="Call">Phone Call Sync</option>
                  </select>
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-3.5 pt-2.5 border-t border-white/5">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editModalHasDeadline}
                      onChange={(e) => setEditModalHasDeadline(e.target.checked)}
                      className="rounded bg-black border-white/10 accent-white"
                    />
                    <span className="font-mono text-[10px] uppercase font-bold text-zinc-400">Set Task Deadline</span>
                  </label>

                  {editModalHasDeadline && (
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editModalHasTime}
                        onChange={(e) => setEditModalHasTime(e.target.checked)}
                        className="rounded bg-black border-white/10 accent-white"
                      />
                      <span className="font-mono text-[10px] uppercase font-bold text-zinc-400">Include Due Time</span>
                    </label>
                  )}
                </div>

                {editModalHasDeadline ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-fade-in">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-zinc-500 block">
                        Due Date
                      </label>
                      <div 
                        onClick={(e) => {
                          const inputEl = e.currentTarget.querySelector('input');
                          if (inputEl) {
                            try {
                              inputEl.showPicker();
                            } catch (err) {
                              console.error("Failed to showPicker", err);
                              inputEl.focus();
                              inputEl.click();
                            }
                          }
                        }}
                        className="relative flex items-center cursor-pointer w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 hover:border-white/30 focus-within:border-white/30 transition group"
                      >
                        <Calendar className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 mr-2 transition-colors pointer-events-none" />
                        <input
                          type="date"
                          value={editModalDeadlineDate}
                          onChange={(e) => setEditModalDeadlineDate(e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              e.currentTarget.showPicker();
                            } catch (err) {
                              console.error("Failed to showPicker inside click", err);
                            }
                          }}
                          className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    {editModalHasTime && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono font-bold text-zinc-500 block">
                          Due Time
                        </label>
                        <div 
                          onClick={(e) => {
                            const inputEl = e.currentTarget.querySelector('input');
                            if (inputEl) {
                              try {
                                inputEl.showPicker();
                              } catch (err) {
                                console.error("Failed to showPicker", err);
                                inputEl.focus();
                                inputEl.click();
                              }
                            }
                          }}
                          className="relative flex items-center cursor-pointer w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 hover:border-white/30 focus-within:border-white/30 transition group"
                        >
                          <Clock className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 mr-2 transition-colors pointer-events-none" />
                          <input
                            type="time"
                            value={editModalDeadlineTime}
                            onChange={(e) => setEditModalDeadlineTime(e.target.value)}
                            onClick={(e) => {
                              e.stopPropagation();
                              try {
                                e.currentTarget.showPicker();
                              } catch (err) {
                                console.error("Failed to showPicker inside click", err);
                              }
                            }}
                            className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer [color-scheme:dark]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-white/3 border border-white/5 rounded-xl text-xs text-zinc-500 italic font-sans">
                    No deadline will be assigned to this task. It will remain flexible.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-white/1 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setIsEditingTask(false);
                  setEditingTask(null);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg font-mono uppercase tracking-wider text-[10px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedTask}
                disabled={!editTitle.trim()}
                className="bg-white hover:bg-zinc-200 disabled:opacity-40 text-black text-xs font-bold font-mono uppercase tracking-wider px-4 py-1.5 rounded-xl transition flex items-center gap-1.5"
              >
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE TASK CONFIRMATION DIALOG */}
      {isDeletingTask && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-red-500/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Content */}
            <div className="p-6 space-y-3.5 text-center">
              <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-sans font-bold text-zinc-100">Delete this task?</h4>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">This action cannot be undone.</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-white/5 bg-white/1 flex justify-stretch gap-2.5">
              <button
                onClick={() => {
                  setIsDeletingTask(false);
                  setTaskToDelete(null);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteTask}
                className="flex-1 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS TOAST MESSAGE */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-black/95 border border-emerald-500/30 backdrop-blur-md text-emerald-400 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
 
    </div>
  );
}
