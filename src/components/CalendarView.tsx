import React, { useState } from "react";
import { Task, Habit } from "../types";
import { Calendar, Clock, AlertTriangle, ChevronLeft, ChevronRight, Zap, Target, MoreVertical } from "lucide-react";

// Helper to format deadline time strings in a clean, timezone-independent manner
const formatDeadlineTime = (deadline: string): string => {
  if (!deadline || deadline === "No deadline") return "No deadline";
  if (deadline.includes("T")) {
    const parts = deadline.split("T");
    const timeStr = parts[1]; // HH:MM:SS
    const timeParts = timeStr.split(":");
    if (timeParts.length >= 2) {
      let hour = parseInt(timeParts[0], 10);
      const minute = timeParts[1].slice(0, 2);
      const ampm = hour >= 12 ? "PM" : "AM";
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${minute} ${ampm}`;
    }
  }
  return "All Day";
};

// Helper to format short deadline strings in a clean, timezone-independent manner
const formatDeadlineShort = (deadline: string): string => {
  if (!deadline || deadline === "No deadline") return "No deadline";
  if (deadline.includes("T")) {
    const parts = deadline.split("T");
    const dateStr = parts[0];
    const timeStr = parts[1];
    
    const dateParts = dateStr.split("-");
    if (dateParts.length === 3) {
      const monthIndex = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthName = monthNames[monthIndex] || dateParts[1];
      
      const timeParts = timeStr.split(":");
      if (timeParts.length >= 2) {
        let hour = parseInt(timeParts[0], 10);
        const minute = timeParts[1].slice(0, 2);
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12;
        if (hour === 0) hour = 12;
        return `${monthName} ${day}, ${hour}:${minute} ${ampm}`;
      }
      return `${monthName} ${day}`;
    }
  } else {
    const dateParts = deadline.split("-");
    if (dateParts.length === 3) {
      const monthIndex = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthName = monthNames[monthIndex] || dateParts[1];
      return `${monthName} ${day} (All Day)`;
    }
  }
  return deadline;
};

interface CalendarViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string;
  onEditTask?: (task: Task) => void;
  onDuplicateTask?: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
}

export default function CalendarView({
  tasks,
  onSelectTask,
  selectedTaskId,
  onEditTask,
  onDuplicateTask,
  onDeleteTask,
}: CalendarViewProps) {
  const [viewType, setViewType] = useState<"month" | "week">("week");
  const [currentDate, setCurrentDate] = useState(new Date("2026-06-27")); // Frozen around our seed date for demonstration
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Helper to generate days for Monthly grid (June/July 2026)
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, date: null });
    }
    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ day: d, date: new Date(year, month, d), dateStr });
    }
    return days;
  };

  // Helper to generate 7 days of the focused week (around 2026-06-27)
  const getDaysInWeek = () => {
    const days = [];
    // Start of week (Sunday before June 27, which is June 21)
    const baseDate = new Date(currentDate);
    const dayIndex = baseDate.getDay();
    const startOfWeek = new Date(baseDate.setDate(baseDate.getDate() - dayIndex));
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      days.push({ day: date.getDate(), date, dateStr });
    }
    return days;
  };

  const getUrgencyColor = (urgency: number) => {
    if (urgency >= 8) return "from-red-950/30 to-transparent border-red-500/40 text-red-400 red-zone-glow";
    if (urgency >= 5) return "from-zinc-900/80 to-transparent border-amber-500/30 text-amber-200";
    return "from-zinc-900/60 to-transparent border-zinc-800/80 text-zinc-400";
  };

  const isToday = (dateStr: string) => dateStr === "2026-06-27";

  const getTasksForDate = (dateStr: string) => {
    return tasks.filter((t) => {
      if (!t.deadline || t.deadline === "No deadline") return false;
      const tDate = t.deadline.split("T")[0];
      return tDate === dateStr;
    });
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Dynamic Priority Anchoring: High urgency (>= 7) at the very top
  const anchoredHighPriorityTasks = tasks
    .filter((t) => t.urgency >= 7 && t.status !== "Completed")
    .sort((a, b) => b.urgency - a.urgency);

  const regularTasks = tasks
    .filter((t) => t.urgency < 7 || t.status === "Completed")
    .sort((a, b) => {
      if (a.status === "Completed" && b.status !== "Completed") return 1;
      if (a.status !== "Completed" && b.status === "Completed") return -1;
      return b.urgency - a.urgency;
    });

  // Calculate remaining hours and detect proactive 2-hour pre-deadline warnings
  const getTaskDeadlineAlert = (task: Task) => {
    if (task.status === "Completed") return null;
    if (!task.deadline || task.deadline === "No deadline") return null;
    const taskDate = new Date(task.deadline);
    if (isNaN(taskDate.getTime())) return null;
    const now = new Date("2026-06-27T18:00:00Z"); // Set simulation current time
    const diffMs = taskDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours > 0 && diffHours <= 2) {
      return `Proactive Alert: Overwhelming deadline in ${Math.round(diffHours * 60)} minutes! Ignite locked on screen.`;
    } else if (diffHours > 2 && diffHours <= 6) {
      return `Timeline Alert: Due in ${Math.ceil(diffHours)} hours.`;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full glass rounded-2xl overflow-hidden">
      {/* Header with Navigation and Toggles */}
      <div className="p-4 border-b border-white/5 bg-white/3 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <h2 className="text-xl font-display italic font-semibold text-zinc-100">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex gap-1 ml-2">
            <button 
              onClick={() => {
                const next = new Date(currentDate);
                next.setMonth(currentDate.getMonth() - 1);
                setCurrentDate(next);
              }}
              className="p-1 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-200 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => {
                const next = new Date(currentDate);
                next.setMonth(currentDate.getMonth() + 1);
                setCurrentDate(next);
              }}
              className="p-1 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-200 transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Month/Week Toggle Buttons */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-1 flex gap-1">
          <button
            onClick={() => setViewType("week")}
            className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md transition ${
              viewType === "week"
                ? "bg-white text-black shadow-md shadow-white/10"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewType("month")}
            className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md transition ${
              viewType === "month"
                ? "bg-white text-black shadow-md shadow-white/10"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Interactive Calendar Grid */}
      <div className="p-4 border-b border-white/5 bg-white/1">
        {viewType === "month" ? (
          <div className="grid grid-cols-7 gap-1 text-center">
            {daysOfWeek.map((d) => (
              <span key={d} className="text-[10px] font-mono font-bold text-zinc-500 py-1 uppercase tracking-widest">
                {d}
              </span>
            ))}
            {getDaysInMonth().map((item, index) => {
              const dateTasks = item.dateStr ? getTasksForDate(item.dateStr) : [];
              const isTodayDay = item.dateStr && isToday(item.dateStr);
              return (
                <div
                  key={index}
                  className={`min-h-[52px] p-1.5 border rounded-lg flex flex-col justify-between transition-all ${
                    item.day
                      ? isTodayDay
                        ? "bg-white/10 border-white/20 text-white shadow-sm"
                        : "bg-white/2 border-white/5 text-zinc-400 hover:bg-white/5 hover:border-white/10"
                      : "bg-transparent border-none"
                  }`}
                >
                  <span className={`text-[10px] font-mono font-bold self-start ${isTodayDay ? "text-white" : "text-zinc-500"}`}>
                    {item.day}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1 justify-center">
                    {dateTasks.map((t) => (
                      <span
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTask(t);
                        }}
                        className={`w-1.5 h-1.5 rounded-full cursor-pointer ${
                          t.urgency >= 8 ? "bg-red-500 shadow-sm shadow-red-500/50" : "bg-zinc-400"
                        }`}
                        title={t.title}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {getDaysInWeek().map((item, idx) => {
              const dateTasks = getTasksForDate(item.dateStr);
              const isTodayDay = isToday(item.dateStr);
              return (
                <div
                  key={idx}
                  className={`p-2 border rounded-xl flex flex-col items-center gap-1 transition ${
                    isTodayDay
                      ? "bg-white/10 border-white/20 text-white shadow-lg shadow-black/40"
                      : "bg-white/2 border-white/5 text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  <span className="text-[9px] uppercase font-mono text-zinc-500 tracking-wider font-semibold">{daysOfWeek[item.date.getDay()]}</span>
                  <span className={`text-sm font-display font-bold ${isTodayDay ? "text-white" : "text-zinc-300"}`}>
                    {item.day}
                  </span>
                  <div className="flex gap-1 mt-1">
                    {dateTasks.map((t) => (
                      <span
                        key={t.id}
                        onClick={() => onSelectTask(t)}
                        className={`w-1.5 h-1.5 rounded-full cursor-pointer ${
                          t.urgency >= 8 
                            ? "bg-red-500 animate-pulse shadow shadow-red-500/50" 
                            : "bg-zinc-400"
                        }`}
                        title={t.title}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tasks timeline showing priority anchoring */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Dynamic Priority Anchoring Header */}
        {anchoredHighPriorityTasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">
              <Zap className="w-3.5 h-3.5 fill-red-500/20" />
              <span>Requires Attention</span>
            </div>
            <div className="grid gap-2">
              {anchoredHighPriorityTasks.map((task) => {
                const isSelected = selectedTaskId === task.id;
                const proactiveAlert = getTaskDeadlineAlert(task);
                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className={`cursor-pointer p-4 border rounded-xl bg-gradient-to-r ${getUrgencyColor(
                      task.urgency
                    )} transition-all duration-300 relative overflow-hidden ${
                      isSelected ? "ring-2 ring-red-500 border-transparent scale-[0.99]" : "hover:border-white/15"
                    }`}
                  >
                    {/* Urgency Badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                      <span className="text-[9px] font-mono font-bold bg-black/60 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
                        URGENT • {task.urgency}/10
                      </span>
                      
                      {/* Three-dot dropdown */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === task.id ? null : task.id);
                          }}
                          className="p-1 bg-black/60 hover:bg-black/80 rounded-lg text-zinc-400 hover:text-zinc-200 border border-white/10 transition-colors"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        
                        {activeMenuId === task.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-30" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                              }}
                            />
                            <div className="absolute right-0 mt-1 w-36 bg-zinc-950 border border-white/10 rounded-xl shadow-2xl py-1.5 z-40 font-sans text-xs text-zinc-300">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  onEditTask?.(task);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                              >
                                Edit Task
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  onDuplicateTask?.(task);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                              >
                                Duplicate Task
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  onDeleteTask?.(task);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-red-950/40 hover:text-red-400 flex items-center gap-2 transition-colors font-semibold"
                              >
                                Delete Task
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="mt-0.5 p-1.5 bg-black/40 text-red-400 rounded-lg border border-red-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-1.5 pr-16 w-full">
                        <h4 className="text-base font-display font-bold text-zinc-100 tracking-tight leading-snug line-clamp-1">
                          {task.title}
                        </h4>
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-normal font-sans">{task.context}</p>

                        {/* AI Prepared Checklist */}
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                          <div className="text-[9px] uppercase font-mono text-zinc-400 tracking-wider">
                            AI Prepared
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-[11px] text-emerald-400 font-sans">
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-bold">✓</span>
                              <span className="text-zinc-300">AI Workspace Ready</span>
                            </div>
                            {task.workspaceType === "communication" ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white font-bold">✓</span>
                                  <span className="text-zinc-300">Email Draft Ready</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white font-bold">✓</span>
                                  <span className="text-zinc-300">WhatsApp Draft Ready</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white font-bold">✓</span>
                                  <span className="text-zinc-300">Study Guide Ready</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white font-bold">✓</span>
                                  <span className="text-zinc-300">Flashcards Ready</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Timings & Weight */}
                        <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono text-zinc-500 pt-2 border-t border-white/5 mt-3">
                          <span className="flex items-center gap-1 text-red-400 font-bold">
                            <Clock className="w-3 h-3 text-red-400/70" />
                            {formatDeadlineTime(task.deadline)}
                          </span>
                          <span className="bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                            COGNITIVE WEIGHT: {task.cognitiveWeight.toUpperCase()}
                          </span>
                        </div>

                        {/* Proactive alert badge */}
                        {proactiveAlert && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-950/20 px-2.5 py-1 rounded border border-red-500/10 animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>{proactiveAlert}</span>
                          </div>
                        )}

                        {/* Open AI Workspace primary button */}
                        <div className="mt-3.5 flex justify-end">
                          <button className="flex items-center gap-1.5 bg-white text-black hover:bg-zinc-200 text-[10px] uppercase font-mono font-bold tracking-wider px-3.5 py-2 rounded-xl transition shadow">
                            <span>Open AI Workspace</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular Tasks list */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            <Target className="w-3.5 h-3.5" />
            <span>Habit Timeline & General Tasks</span>
          </div>
          <div className="grid gap-2">
            {regularTasks.map((task) => {
              const isSelected = selectedTaskId === task.id;
              const isCompleted = task.status === "Completed";
              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className={`cursor-pointer p-4 border rounded-xl transition-all duration-200 ${
                    isSelected 
                      ? "bg-white/10 border-white/20 ring-1 ring-white/10" 
                      : "bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/10"
                  } ${isCompleted ? "opacity-50" : ""}`}
                >
                  <div className="flex gap-2.5 items-start justify-between">
                    <div className="flex gap-2.5 items-start w-full">
                      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-zinc-600" : "bg-emerald-500"}`} />
                      <div className="space-y-1 w-full">
                        <h4 className={`text-sm font-semibold tracking-tight ${isCompleted ? "line-through text-zinc-500" : "text-zinc-200"}`}>
                          {task.title}
                        </h4>
                        <p className="text-xs text-zinc-400 line-clamp-1 font-sans">{task.context}</p>
                        
                        {/* AI Prepared Checklist */}
                        <div className="text-[10px] text-emerald-400 font-sans flex items-center gap-3 pt-1">
                          <span className="text-zinc-500 font-mono font-bold text-[9px] uppercase tracking-wider">AI Prepared:</span>
                          <span className="flex items-center gap-0.5"><span className="text-white font-bold">✓</span> <span className="text-emerald-400">Ready</span></span>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-[9px] font-mono text-zinc-500 pt-2 border-t border-white/5 mt-2 uppercase tracking-wide">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>Urgency: {task.urgency}/10</span>
                            <span>•</span>
                            <span>Weight: {task.cognitiveWeight}</span>
                            <span>•</span>
                            <span className="text-zinc-400">
                              Due: {formatDeadlineShort(task.deadline)}
                            </span>
                          </div>
                          {!isCompleted && isSelected && (
                            <button className="flex items-center gap-1 bg-white/5 text-zinc-300 hover:bg-white/10 px-2 py-1 rounded-lg text-[8px] tracking-wider uppercase">
                              <span>Open AI Workspace</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 z-20">
                      {isCompleted && (
                        <span className="text-[9px] font-mono bg-white/5 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20 tracking-wider">
                          DONE
                        </span>
                      )}
                      
                      {/* Three-dot dropdown for regular tasks */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === task.id ? null : task.id);
                          }}
                          className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-white/5 transition-colors"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        
                        {activeMenuId === task.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-30" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                              }}
                            />
                            <div className="absolute right-0 mt-1 w-36 bg-zinc-950 border border-white/10 rounded-xl shadow-2xl py-1.5 z-40 font-sans text-xs text-zinc-300">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  onEditTask?.(task);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                              >
                                Edit Task
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  onDuplicateTask?.(task);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
                              >
                                Duplicate Task
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  onDeleteTask?.(task);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-red-950/40 hover:text-red-400 flex items-center gap-2 transition-colors font-semibold"
                              >
                                Delete Task
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
