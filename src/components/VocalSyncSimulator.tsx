import React, { useState, useEffect, useRef } from "react";
import { Habit, Task } from "../types";
import { Phone, PhoneOff, Mic, Play, RefreshCw, Volume2, User, VolumeX, Sparkles, CheckCircle2, MicOff } from "lucide-react";

function TypewriterText({ text, speed = 15, onCharTyped }: { text: string; speed?: number; onCharTyped?: () => void }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let index = 0;
    setDisplayed("");
    
    if (text.length > 0) {
      setDisplayed(text.charAt(0));
      index = 1;
      if (onCharTyped) onCharTyped();
    }

    const interval = setInterval(() => {
      setDisplayed(text.slice(0, index + 1));
      index++;
      if (onCharTyped) onCharTyped();
      if (index >= text.length) {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span>{displayed}</span>;
}

interface VocalSyncSimulatorProps {
  habits: Habit[];
  tasks: Task[];
  onSyncComplete: (updatedHabits: Record<string, boolean>, completedTaskIds: string[]) => void;
  isSyncing: boolean;
  setIsSyncing: (val: boolean) => void;
}

interface SyncItem {
  id: string;
  type: "habit" | "task";
  title: string;
  status: "Pending" | "Completed" | "Skipped" | "Understanding..." | "Updating...";
}

export default function VocalSyncSimulator({
  habits,
  tasks,
  onSyncComplete,
  isSyncing,
  setIsSyncing,
}: VocalSyncSimulatorProps) {
  const [callActive, setCallActive] = useState(false);
  const [statusText, setStatusText] = useState("Idle");
  const [pilotSpeech, setPilotSpeech] = useState("");
  const [userInput, setUserInput] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ sender: "pilot" | "user" | "system"; text: string; itemsSnapshot?: SyncItem[] }>>([]);
  const [voiceMuted, setVoiceMuted] = useState(false);

  // Advanced Interactive States
  const [isListening, setIsListening] = useState(false);
  const [processingStep, setProcessingStep] = useState<"idle" | "listening" | "understanding" | "updating" | "adjusting" | "almost_done" | "synced">("idle");
  const [transcriptionSuccess, setTranscriptionSuccess] = useState(false);
  const [lastTranscribedText, setLastTranscribedText] = useState("");
  const [recognitionSupported, setRecognitionSupported] = useState(true);
  const [recognition, setRecognition] = useState<any>(null);

  // Live Cognitive Tracking list of all items and their updated status
  const [callSyncItems, setCallSyncItems] = useState<SyncItem[]>([]);

  const logRef = useRef<HTMLDivElement>(null);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const scrollToBottom = () => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatLog, processingStep]);

  // Setup consistent speech voice locking
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const initVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0 && !selectedVoiceRef.current) {
        // Look for preferred consistent voice: Google US English, Samantha, Zira, etc.
        const voice =
          voices.find(v => v.name.includes("Google US English")) ||
          voices.find(v => v.name.toLowerCase().includes("samantha")) ||
          voices.find(v => v.name.toLowerCase().includes("zira")) ||
          voices.find(v => v.name.toLowerCase().includes("female")) ||
          voices.find(v => v.lang.startsWith("en-US")) ||
          voices.find(v => v.lang.startsWith("en")) ||
          voices[0];
        
        if (voice) {
          selectedVoiceRef.current = voice;
          console.log("Speech locked to consistent voice:", voice.name, voice.lang);
        }
      }
    };

    initVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = initVoice;
    }
  }, []);

  // Setup Web Speech Recognition API
  useEffect(() => {
    const SpeechLib = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechLib) {
      const rec = new SpeechLib();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setTranscriptionSuccess(false);
        setProcessingStep("listening");
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setLastTranscribedText(text);
          setTranscriptionSuccess(true);
          setIsListening(false);
          // Wait briefly to show success, then submit
          setTimeout(() => {
            processUserResponse(text);
          }, 1200);
        }
      };

      rec.onerror = (e: any) => {
        console.warn("Speech recognition error/permission denied:", e);
        setIsListening(false);
        setProcessingStep("idle");
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
      setRecognitionSupported(true);
    } else {
      setRecognitionSupported(false);
    }
  }, []);

  // Play spoken text with browser Web Speech synthesis using consistent voice
  const speakText = (text: string) => {
    if (voiceMuted || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
    } else {
      const voices = window.speechSynthesis.getVoices();
      const voice =
        voices.find(v => v.name.includes("Google US English")) ||
        voices.find(v => v.name.toLowerCase().includes("samantha")) ||
        voices.find(v => v.lang.startsWith("en-US")) ||
        voices[0];
      if (voice) {
        selectedVoiceRef.current = voice;
        utterance.voice = voice;
      }
    }
    
    window.speechSynthesis.speak(utterance);
  };

  // Start the call
  const startCall = async () => {
    setCallActive(true);
    setStatusText("Establishing Secure Voice Connection...");
    setChatLog([]);
    setProcessingStep("understanding");

    // Initialize all habits and tasks status tracker
    const activeHabitsToSync = habits.map(h => ({
      id: h.id,
      type: "habit" as const,
      title: h.title,
      status: h.completedToday ? ("Completed" as const) : ("Pending" as const)
    }));
    const activeTasksToSync = tasks.filter(t => t.status !== "Completed").map(t => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      status: "Pending" as const
    }));
    const initialItems = [...activeHabitsToSync, ...activeTasksToSync];
    setCallSyncItems(initialItems);

    try {
      const response = await fetch("/api/voice-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userResponse: "__START__",
          activeHabits: habits,
          activeTasks: tasks.filter(t => t.status !== "Completed"),
          chatLog: []
        }),
      });

      const data = await response.json();
      setProcessingStep("idle");

      if (data.success) {
        setStatusText("Live Call • Daily Progress Sync");
        setPilotSpeech(data.speechText);
        setChatLog([{ sender: "pilot", text: data.speechText, itemsSnapshot: initialItems }]);
        speakText(data.speechText);
      } else {
        setStatusText("Voice Sync Connection Error");
      }
    } catch (error) {
      setProcessingStep("idle");
      console.error("Vocal Sync Start Error:", error);
      setStatusText("Voice Sync Connection Error");
    }
  };

  // End the call
  const endCall = () => {
    setCallActive(false);
    setStatusText("Call Ended");
    setIsListening(false);
    setProcessingStep("idle");
    setTranscriptionSuccess(false);
    if (recognition) {
      try { recognition.abort(); } catch(e){}
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Toggle speech recording
  const toggleListening = () => {
    if (isListening) {
      if (recognition) {
        recognition.stop();
      }
      setIsListening(false);
      setProcessingStep("idle");
    } else {
      if (recognition) {
        try {
          recognition.start();
        } catch (e) {
          // Fallback if recognition is busy
          setIsListening(true);
          setProcessingStep("listening");
        }
      } else {
        // Soft fallback for Demo Mode or non-supported browsers
        setIsListening(true);
        setProcessingStep("listening");
        // Simulate speech recognition after 2.2 seconds with a preset
        setTimeout(() => {
          const fallbackTexts = [
            "Yes, crushed my morning workout! Felt amazing.",
            "I finished my workout.",
            "I drank all my water.",
            "Actually, I completed my lab report.",
            "I couldn't make it today."
          ];
          const randomText = fallbackTexts[Math.floor(Math.random() * fallbackTexts.length)];
          setLastTranscribedText(randomText);
          setTranscriptionSuccess(true);
          setIsListening(false);
          setTimeout(() => {
            processUserResponse(randomText);
          }, 1200);
        }, 2200);
      }
    }
  };

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

  const processUserResponse = async (userResponseText: string) => {
    if (!userResponseText.trim() || processingStep === "understanding") return;

    // Acknowledge user reply in Chat Log
    const updatedLog = [...chatLog, { sender: "user" as const, text: userResponseText }];
    setChatLog(updatedLog);
    setUserInput("");
    setTranscriptionSuccess(false);

    // 1. Immediately find what item was being discussed
    const pilotMsgs = chatLog.filter(log => log.sender === "pilot");
    let activeAskedItem: any = null;
    if (pilotMsgs.length > 0) {
      const lastPilotText = pilotMsgs[pilotMsgs.length - 1].text.toLowerCase();
      activeAskedItem = callSyncItems.find(item => matchesKeywords(lastPilotText, item.id, item.title));
    }

    // 2. Immediately animate the item to "Understanding..." in real-time
    if (activeAskedItem) {
      setCallSyncItems(prev => prev.map(item => 
        item.id === activeAskedItem.id 
          ? { ...item, status: "Understanding..." as const } 
          : item
      ));
    }

    // Progression step sequence
    setProcessingStep("understanding");

    const timer1 = setTimeout(() => {
      setProcessingStep("updating");
      if (activeAskedItem) {
        setCallSyncItems(prev => prev.map(item => 
          (item.id === activeAskedItem.id && item.status === "Understanding...") 
            ? { ...item, status: "Updating..." as const } 
            : item
        ));
      }
    }, 600);
    
    const timer2 = setTimeout(() => setProcessingStep("adjusting"), 1200);
    const timer3 = setTimeout(() => setProcessingStep("almost_done"), 1800);

    try {
      const response = await fetch("/api/voice-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userResponse: userResponseText,
          activeHabits: habits,
          activeTasks: tasks.filter(t => t.status !== "Completed"),
          chatLog: updatedLog
        }),
      });

      const data = await response.json();
      
      // Clear timers
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      setProcessingStep("synced");
      setTimeout(() => {
        setProcessingStep("idle");
      }, 1000);

      if (data.success) {
        // Update local database if habits/tasks are checked
        const updatedHabits = data.updates || {};
        const updatedTasks = data.completedTaskIds || [];

        // Compute updated item statuses first so we can attach them to this step's chat log
        const normResponse = userResponseText.toLowerCase();
        const isNegative = normResponse.includes("no") || normResponse.includes("couldn't") || normResponse.includes("skipped") || normResponse.includes("didn't") || normResponse.includes("not today") || normResponse.includes("nah") || normResponse.includes("not yet");

        const nextCallSyncItems = callSyncItems.map(item => {
          // If this item was confirmed completed in the server response, update to completed
          const isCompletedNow = (updatedHabits[item.id] === true) || (updatedTasks.includes(item.id));
          if (isCompletedNow) {
            return { ...item, status: "Completed" as const };
          }
          // If this item was the one currently asked and the user gave a negative response, update to Skipped
          if (activeAskedItem && item.id === activeAskedItem.id) {
            if (isNegative) {
              return { ...item, status: "Skipped" as const };
            } else {
              return { ...item, status: "Pending" as const };
            }
          }
          return item;
        });

        setCallSyncItems(nextCallSyncItems);

        let systemMsgText = "";
        if (activeAskedItem) {
          const isCompletedNow = (updatedHabits[activeAskedItem.id] === true) || (updatedTasks.includes(activeAskedItem.id));
          if (isCompletedNow) {
            systemMsgText = `✓ Today's Progress: Marked "${activeAskedItem.title}" as Completed`;
          } else {
            systemMsgText = `⚠ Today's Progress: "${activeAskedItem.title}" remains Pending`;
          }
        }

        const nextChatLogs = [...updatedLog];
        if (systemMsgText) {
          nextChatLogs.push({ sender: "system" as const, text: systemMsgText });
        }
        nextChatLogs.push({ 
          sender: "pilot" as const, 
          text: data.speechText,
          itemsSnapshot: nextCallSyncItems
        });

        setPilotSpeech(data.speechText);
        setChatLog(nextChatLogs);
        speakText(data.speechText);

        if (Object.keys(updatedHabits).length > 0 || updatedTasks.length > 0) {
          onSyncComplete(updatedHabits, updatedTasks);
        }
      }
    } catch (error) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setProcessingStep("idle");
      console.error("Vocal Sync API Error:", error);
      setStatusText("Voice Sync Connection Error");
      
      // Reset any temporary animating statuses back to Pending
      setCallSyncItems(prev => prev.map(item => 
        (item.status === "Understanding..." || item.status === "Updating...") 
          ? { ...item, status: "Pending" as const } 
          : item
      ));
    }
  };

  // Selectable Chips for Demo Responses (as requested)
  const demoChips = [
    { label: "I finished my workout.", text: "I finished my workout." },
    { label: "I couldn't make it today.", text: "No, I couldn't make it today." },
    { label: "I completed my lab report.", text: "Yes, I completed my lab report." },
    { label: "I drank all my water.", text: "Yeah, I drank all my water." }
  ];

  return (
    <div className="glass rounded-2xl p-4 overflow-hidden flex flex-col justify-between h-auto min-h-[160px] transition-all duration-300">
      <div>
        {/* Title */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h3 className="text-sm font-sans font-bold text-zinc-100 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-zinc-400" />
              Daily Progress Sync
            </h3>
            <p className="text-[10px] text-zinc-500 font-sans uppercase tracking-widest mt-0.5">
              Zero-Maintenance habit logging
            </p>
          </div>
          <button
            onClick={() => setVoiceMuted(!voiceMuted)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-zinc-200 transition"
            title={voiceMuted ? "Unmute voice" : "Mute voice"}
          >
            {voiceMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Call layout / simulation screen */}
        {!callActive ? (
          <div className="flex flex-col items-center justify-center py-5 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/3 border border-white/10 flex items-center justify-center text-zinc-200 shadow-lg relative">
              <Phone className="w-4 h-4 animate-pulse" />
              <div className="absolute inset-0 rounded-full border border-red-500/20 glow-ring" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-sans font-bold text-zinc-300">Sync Call Outstanding</h4>
              <p className="text-[11px] text-zinc-500 max-w-xs leading-normal font-sans">
                Don't check boxes inside the app. Let Ignite call you, hold a 15-second natural chat, and update everything in the database.
              </p>
            </div>
            <button
              onClick={startCall}
              className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 text-[10px] font-bold px-3.5 py-2 rounded-xl transition shadow text-stone-900 font-mono tracking-wide"
            >
              <Phone className="w-3 h-3 fill-black" />
              <span>Answer Daily Sync Call</span>
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {/* Active Phone Interface */}
            <div className="bg-white/3 rounded-xl p-3 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white">
                  <Phone className="w-3.5 h-3.5 fill-white animate-pulse" />
                  <span className="absolute inset-0 rounded-full border border-emerald-400/40 glow-ring" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-200">{statusText}</span>
                  <span className="block text-[9px] font-mono text-zinc-400">IGNITE Support Assistant</span>
                </div>
              </div>
              <button
                onClick={endCall}
                className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
                title="Hang up sync call"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>

            {/* Conversation Log - dynamically extends height */}
            <div 
              ref={logRef}
              className="max-h-[160px] overflow-y-auto bg-black/20 border border-white/5 rounded-xl p-3 space-y-2.5 transition-all duration-300 flex flex-col"
            >
              {chatLog.map((log, index) => {
                const isLatestPilot = log.sender === "pilot" && index === chatLog.length - 1;
                
                if (log.sender === "system") {
                  return (
                    <div key={index} className="w-full flex justify-center my-1 animate-fade-in">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono rounded-lg shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {log.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={index} className="space-y-1.5">
                    <div className={`flex gap-2 items-start ${log.sender === "user" ? "justify-end text-right" : ""}`}>
                      {log.sender === "pilot" && (
                        <div className="w-5 h-5 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[9px] font-bold text-zinc-300 shrink-0">
                          IG
                        </div>
                      )}
                      <div className={`p-2 rounded-xl text-xs max-w-[85%] leading-normal ${
                        log.sender === "pilot"
                          ? "bg-white/5 text-zinc-300"
                          : "bg-white/10 border border-white/10 text-white font-sans"
                      }`}>
                        {isLatestPilot ? (
                          <TypewriterText text={log.text} onCharTyped={scrollToBottom} />
                        ) : (
                          log.text
                        )}
                      </div>
                    </div>
                    {/* Inline Checklist of item statuses at this question turn */}
                    {log.sender === "pilot" && log.itemsSnapshot && (
                      <div className="ml-7 flex flex-wrap gap-1 pb-0.5 animate-fade-in">
                        {log.itemsSnapshot.map((item) => {
                          const isDone = item.status === "Completed";
                          const isSkipped = item.status === "Skipped";
                          return (
                            <span 
                              key={item.id} 
                              className={`text-[9px] font-sans px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all duration-300 ${
                                isDone 
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                  : isSkipped 
                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
                                    : "bg-zinc-500/5 border-white/5 text-zinc-400"
                              }`}
                            >
                              <span className="text-[10px] leading-none">{isDone ? "✓" : isSkipped ? "✕" : "○"}</span>
                              <span>{item.title}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Dynamic User-Friendly Progression Steps */}
              {processingStep !== "idle" && processingStep !== "listening" && (
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 p-1.5 bg-white/3 rounded-lg border border-white/5 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin text-zinc-400" />
                  <span className="transition-all duration-300">
                    {processingStep === "understanding" && "Understanding your response..."}
                    {processingStep === "updating" && "Updating today's progress..."}
                    {processingStep === "adjusting" && "Adjusting tomorrow's priorities..."}
                    {processingStep === "almost_done" && "Almost done..."}
                    {processingStep === "synced" && "✓ Progress Synced!"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Voice inputs / Refined Voice-First Interaction Area */}
      {callActive && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
          
          {/* Primary Voice-First Interface */}
          <div className="flex flex-col items-center justify-center text-center space-y-2 py-1">
            
            {/* Animated Waveform when listening */}
            {isListening && (
              <div className="flex items-center gap-1 h-5 mb-1 animate-pulse">
                <span className="w-1 h-3 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-1 h-5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-1 h-2 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                <span className="w-1 h-6 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "450ms" }}></span>
                <span className="w-1 h-4 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "600ms" }}></span>
              </div>
            )}

            {/* Microphone Button */}
            <button
              onClick={toggleListening}
              disabled={processingStep !== "idle" && processingStep !== "listening"}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative ${
                isListening 
                  ? "bg-emerald-500 text-black scale-110 shadow-[0_0_20px_rgba(16,185,129,0.4)]" 
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
              }`}
            >
              <Mic className={`w-6 h-6 ${isListening ? "animate-pulse" : ""}`} />
              {isListening && (
                <span className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-70" />
              )}
            </button>

            {/* Subtitles & Feedback */}
            <div className="space-y-0.5">
              <p className="text-[11px] font-sans font-bold text-zinc-300">
                {isListening ? "Listening..." : "Speak naturally"}
              </p>
              <p className="text-[10px] text-zinc-500 max-w-xs font-sans">
                {isListening ? "Speak naturally..." : "Speak naturally. I'll understand and update everything for you."}
              </p>
            </div>

            {/* Transcription Success banner */}
            {transcriptionSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5 text-center max-w-xs animate-fade-in space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-sans font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ✓ Transcribed Successfully
                </div>
                <p className="text-[11px] text-zinc-300 italic">"{lastTranscribedText}"</p>
              </div>
            )}
          </div>

          {/* Today's Progress Section */}
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 space-y-1.5">
            <span className="text-[10px] font-sans font-bold text-emerald-400 tracking-wider flex items-center gap-1.5 uppercase">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Today's Progress
            </span>
            <div className="space-y-1.5 text-xs">
              {callSyncItems.length > 0 ? (
                callSyncItems.map((item) => {
                  let statusBadgeColor = "text-zinc-500 bg-white/3";
                  let statusLabel = "Pending";
                  let statusIcon = <span className="text-zinc-500 text-xs">○</span>;
                  let textStyle = "text-zinc-200";

                  if (item.status === "Completed") {
                    statusBadgeColor = "text-emerald-400 bg-emerald-500/10 font-bold";
                    statusLabel = "Completed";
                    statusIcon = <span className="text-emerald-400 font-bold">✓</span>;
                    textStyle = "line-through text-zinc-500";
                  } else if (item.status === "Skipped") {
                    statusBadgeColor = "text-amber-400 bg-amber-500/10 font-semibold";
                    statusLabel = "Skipped";
                    statusIcon = <span className="text-amber-400 font-bold">✕</span>;
                    textStyle = "text-zinc-400 italic";
                  } else if (item.status === "Understanding...") {
                    statusBadgeColor = "text-cyan-400 bg-cyan-500/10 animate-pulse font-mono";
                    statusLabel = "Understanding...";
                    statusIcon = <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />;
                    textStyle = "text-cyan-200 font-medium";
                  } else if (item.status === "Updating...") {
                    statusBadgeColor = "text-indigo-400 bg-indigo-500/10 animate-pulse font-mono";
                    statusLabel = "Updating...";
                    statusIcon = <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />;
                    textStyle = "text-indigo-200 font-medium";
                  }

                  return (
                    <div key={item.id} className="flex items-center justify-between text-zinc-300 py-0.5 border-b border-white/5 last:border-0">
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 flex items-center justify-center">
                          {statusIcon}
                        </span>
                        <span className={`font-sans ${textStyle} transition-all duration-300`}>
                          {item.title}
                        </span>
                      </span>
                      <span className={`${statusBadgeColor} text-[9px] font-mono px-1.5 py-0.5 rounded transition-all duration-300`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-[11px] text-zinc-500 font-sans italic">
                  Listening to your voice to extract progress updates...
                </p>
              )}
              {callSyncItems.some(item => item.status !== "Pending") && (
                <div className="flex items-center justify-between text-zinc-400 border-t border-white/5 pt-1.5 mt-1 text-[10px] font-mono italic">
                  <span className="flex items-center gap-1.5 text-emerald-500">
                    <span>✓</span> Dashboard synced
                  </span>
                  <span>Auto-saved to Cloud</span>
                </div>
              )}
            </div>
          </div>

          {/* Demo Responses Section */}
          <div className="border-t border-white/5 pt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase font-mono font-bold text-zinc-400 tracking-wider block">
                Demo Responses
              </span>
              {!recognitionSupported && (
                <span className="text-[9px] text-amber-500 font-mono">Demo Mode Active</span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 font-sans">
              Choose a sample response or use your microphone.
            </p>
            
            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {demoChips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => processUserResponse(chip.text)}
                  disabled={processingStep !== "idle" && processingStep !== "listening"}
                  className="text-[10px] text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 px-2.5 py-1.5 rounded-full transition cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Custom backup input if needed */}
            <div className="flex gap-1.5 pt-1.5">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Or type custom response..."
                disabled={processingStep !== "idle" && processingStep !== "listening"}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/30"
                onKeyDown={(e) => e.key === "Enter" && processUserResponse(userInput)}
              />
              <button
                onClick={() => processUserResponse(userInput)}
                disabled={(processingStep !== "idle" && processingStep !== "listening") || !userInput.trim()}
                className="px-3 py-1.5 bg-white text-stone-950 hover:bg-zinc-200 rounded-xl text-xs font-bold transition font-mono"
              >
                Send
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
