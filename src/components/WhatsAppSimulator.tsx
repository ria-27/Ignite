import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, Task } from "../types";
import { Send, CheckCircle, RefreshCw, Clock, ArrowRight, User } from "lucide-react";

interface WhatsAppSimulatorProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onExecuteAction: (taskId: string, action: string) => void;
  tasks: Task[];
  isStreaming?: boolean;
}

export default function WhatsAppSimulator({
  messages,
  onSendMessage,
  onExecuteAction,
  tasks,
  isStreaming = false,
}: WhatsAppSimulatorProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chats
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText("");
    }
  };

  // Find active task associated with a message payload, if any
  const getTaskForMessage = (msg: ChatMessage): Task | undefined => {
    if (msg.payload && msg.payload.taskId) {
      return tasks.find((t) => t.id === msg.payload.taskId);
    }
    return undefined;
  };

  return (
    <div className="flex flex-col h-full glass rounded-2xl overflow-hidden relative shadow-xl">
      {/* Editorial Chat Header */}
      <div className="p-4 bg-white/3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-zinc-200 font-sans font-bold text-sm">
              IG
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-zinc-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-sans font-bold text-zinc-100 leading-tight">
                Ignite Assistant
              </span>
              {/* Verified Badge */}
              <span className="text-[9px] font-mono bg-white/5 text-zinc-400 font-bold px-1.5 py-0.2 rounded border border-white/10 uppercase tracking-widest scale-90">
                ACTIVE
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-sans tracking-wider block">Your AI Accountability Partner</span>
            <span className="text-[9px] text-zinc-600 font-sans uppercase tracking-wider block mt-0.5">WhatsApp & Voice Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono bg-white/5 text-zinc-400 px-2 py-1 rounded border border-white/10 uppercase tracking-widest">
            SIMULATED
          </span>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/1">
        {messages.map((msg) => {
          const isPilot = msg.sender === "pilot" || msg.sender === "assistant";
          const associatedTask = getTaskForMessage(msg);

          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${
                isPilot ? "self-start items-start" : "self-end items-end ml-auto"
              }`}
            >
              {/* Chat Bubble */}
              <div
                className={`p-4 rounded-2xl relative shadow ${
                  isPilot
                    ? "bg-white/3 border border-white/5 text-zinc-200 rounded-tl-none"
                    : "bg-white/10 border border-white/15 text-zinc-100 rounded-tr-none"
                }`}
              >
                {/* Text render */}
                <div className="text-xs whitespace-pre-wrap leading-relaxed tracking-tight break-words font-sans">
                  {msg.text}
                </div>

                {/* Quick Actions (Interactive AI Buttons) */}
                {associatedTask && (
                  <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-1.5 w-full">
                    <span className="text-[9px] uppercase font-mono font-bold text-zinc-500 tracking-wider">
                      Ignite Quick Actions
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <button
                        onClick={() => onExecuteAction(associatedTask.id, "select")}
                        className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-mono font-bold bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 px-2.5 py-1 rounded-lg transition"
                      >
                        <span><span className="text-white font-bold">✓</span> Open AI Workspace</span>
                      </button>

                      <button
                        onClick={() => onExecuteAction(associatedTask.id, "complete")}
                        className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-mono font-bold bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span><span className="text-white font-bold">✓</span> Mark Complete</span>
                      </button>

                      <button
                        onClick={() => onExecuteAction(associatedTask.id, "delay")}
                        className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-mono font-bold bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 border border-white/5 px-2.5 py-1 rounded-lg transition"
                      >
                        <Clock className="w-3 h-3" />
                        <span><span className="text-white font-bold">✓</span> Remind Me Later</span>
                      </button>

                      <button
                        onClick={() => onExecuteAction(associatedTask.id, "delay")}
                        className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-mono font-bold bg-zinc-900/40 hover:bg-zinc-800 text-zinc-400 border border-white/5 px-2.5 py-1 rounded-lg transition"
                      >
                        <span><span className="text-white font-bold">✓</span> Delay 1 Hour</span>
                      </button>

                      <button
                        onClick={() => onExecuteAction(associatedTask.id, "review")}
                        className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-mono font-bold bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg transition"
                      >
                        <span><span className="text-white font-bold">✓</span> Send Draft</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Timestamp */}
                <span className="block text-[8px] font-mono text-zinc-500 text-right mt-1.5 uppercase tracking-wider">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}

        {isStreaming && (
          <div className="self-start bg-white/3 border border-white/5 p-3.5 rounded-2xl rounded-tl-none max-w-[80%] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse [animation-delay:0.4s]" />
            <span className="text-[10px] font-mono text-zinc-500">Writing cognitive report...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Field Form */}
      <form onSubmit={handleSubmit} className="p-3 bg-white/3 border-t border-white/5 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Reply to Ignite Assistant..."
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/30"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-30 transition font-bold"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
