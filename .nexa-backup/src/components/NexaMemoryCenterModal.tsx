import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  X, 
  Search, 
  Brain, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Filter, 
  CheckCircle2, 
  Tag, 
  RefreshCw, 
  Settings, 
  SlidersHorizontal, 
  Download, 
  Upload, 
  ChevronDown, 
  Calendar, 
  Eye, 
  Check, 
  AlertTriangle, 
  FolderKanban, 
  Heart, 
  UserCheck, 
  Award, 
  Zap,
  Clock,
  Compass,
  Smile,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { 
  NexaMemory, 
  MemoryCategory, 
  MemoryStatus, 
  VerificationStatus, 
  MemorySettings,
  MemorySortOption 
} from "../types";
import { nexaMemoryStorage, DEFAULT_MEMORY_SETTINGS } from "../services/nexaMemoryStorage";
import { motion, AnimatePresence } from "framer-motion";

interface NexaMemoryCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: MemoryCategory | "All";
  prefillMemory?: {
    title?: string;
    content?: string;
    category?: MemoryCategory;
    tags?: string[];
  };
}

const CATEGORIES: { id: MemoryCategory | "All"; label: string; icon: any; color: string; bg: string; border: string; desc: string }[] = [
  { id: "All", label: "All Memories", icon: Brain, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", desc: "Complete persistent knowledge repository" },
  { id: "Identity", label: "Identity", icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", desc: "Creator, owner, personal profile, and core attributes" },
  { id: "Preferences", label: "Preferences", icon: Heart, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", desc: "Communication style, tone, channels, and working habits" },
  { id: "Life", label: "Life", icon: Compass, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", desc: "Routines, daily context, physical space, and interests" },
  { id: "Active", label: "Active", icon: FolderKanban, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30", desc: "Projects, ongoing software, roadmap items, and tasks" },
  { id: "Relationships", label: "Relationships", icon: Smile, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", desc: "People, team members, allies, and connections" },
  { id: "Milestones", label: "Milestones", icon: Award, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", desc: "Major achievements, launches, and key historic dates" },
  { id: "Behaviors", label: "Behaviors", icon: Zap, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/30", desc: "Standing instructions, custom rules, and cognitive directives" }
];

const STATUS_CONFIG: Record<MemoryStatus, { label: string; color: string; bg: string; border: string }> = {
  Active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  Planned: { label: "Planned", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  Completed: { label: "Completed", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  Archived: { label: "Archived", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/30" }
};

export default function NexaMemoryCenterModal({
  isOpen,
  onClose,
  initialCategory = "All",
  prefillMemory
}: NexaMemoryCenterModalProps) {
  const [memories, setMemories] = useState<NexaMemory[]>([]);
  const [settings, setSettings] = useState<MemorySettings>(DEFAULT_MEMORY_SETTINGS);
  const [activeTab, setActiveTab] = useState<MemoryCategory | "All">(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemoryStatus | "All">("All");
  const [sourceFilter, setSourceFilter] = useState<"All" | "Manual" | "Automatic">("All");
  const [verificationFilter, setVerificationFilter] = useState<"All" | VerificationStatus>("All");
  const [sortBy, setSortBy] = useState<MemorySortOption>("updated_desc");
  const [isLoading, setIsLoading] = useState(true);

  // Sub-modal states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<NexaMemory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NexaMemory | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [statusMenuOpenId, setStatusMenuOpenId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Form State for Create / Edit
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<MemoryCategory>("Active");
  const [formStatus, setFormStatus] = useState<MemoryStatus>("Active");
  const [formTags, setFormTags] = useState("");
  const [formVerification, setFormVerification] = useState<VerificationStatus>("UserVerified");
  const [formError, setFormError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load memories & settings
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allMems, currentSettings] = await Promise.all([
        nexaMemoryStorage.getAll(),
        nexaMemoryStorage.getSettings()
      ]);
      setMemories(allMems);
      setSettings(currentSettings);
    } catch (err) {
      console.error("[NexaMemoryCenterModal] Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Handle external prefill (e.g. from chat "Save to Memory")
  useEffect(() => {
    if (isOpen && prefillMemory && (prefillMemory.title || prefillMemory.content)) {
      setEditingMemory(null);
      setFormTitle(prefillMemory.title || "User Preference / Requirement");
      setFormContent(prefillMemory.content || "");
      setFormCategory(prefillMemory.category || "Preferences");
      setFormStatus("Active");
      setFormTags(prefillMemory.tags ? prefillMemory.tags.join(", ") : "bhavik, saved-from-chat");
      setFormVerification("UserVerified");
      setFormError("");
      setIsEditorOpen(true);
    }
  }, [isOpen, prefillMemory]);

  // Listen to external memory updates
  useEffect(() => {
    const handleMemoryChange = () => {
      loadData();
    };
    window.addEventListener("nexa-memory-changed", handleMemoryChange);
    return () => {
      window.removeEventListener("nexa-memory-changed", handleMemoryChange);
    };
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Category Counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: memories.length };
    CATEGORIES.forEach(c => {
      if (c.id !== "All") counts[c.id] = 0;
    });
    memories.forEach(m => {
      if (counts[m.category] !== undefined) {
        counts[m.category]++;
      }
    });
    return counts;
  }, [memories]);

  // Filtered and Sorted Memories
  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      // Category filter
      if (activeTab !== "All" && m.category !== activeTab) return false;

      // Status filter
      if (statusFilter !== "All" && m.status !== statusFilter) return false;

      // Source filter
      if (sourceFilter !== "All" && m.source !== sourceFilter) return false;

      // Verification filter
      if (verificationFilter !== "All" && m.verificationStatus !== verificationFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesContent = m.content.toLowerCase().includes(q);
        const matchesCategory = m.category.toLowerCase().includes(q);
        const matchesTags = (m.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesContent && !matchesCategory && !matchesTags) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "updated_desc") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === "created_desc") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "created_asc") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "alphabetical") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "recall_count") {
        return (b.recallCount || 0) - (a.recallCount || 0);
      }
      return 0;
    });
  }, [memories, activeTab, statusFilter, sourceFilter, verificationFilter, searchQuery, sortBy]);

  // Open Form to Add New Memory
  const handleOpenAdd = () => {
    setEditingMemory(null);
    setFormTitle("");
    setFormContent("");
    setFormCategory(activeTab === "All" ? "Active" : activeTab);
    setFormStatus("Active");
    setFormTags("");
    setFormVerification("UserVerified");
    setFormError("");
    setIsEditorOpen(true);
  };

  // Open Form to Edit Existing Memory
  const handleOpenEdit = (memory: NexaMemory) => {
    setEditingMemory(memory);
    setFormTitle(memory.title);
    setFormContent(memory.content);
    setFormCategory(memory.category);
    setFormStatus(memory.status);
    setFormTags(memory.tags ? memory.tags.join(", ") : "");
    setFormVerification(memory.verificationStatus);
    setFormError("");
    setIsEditorOpen(true);
  };

  // Save Form (Create or Update)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!formContent.trim()) {
      setFormError("Content is required.");
      return;
    }

    const tagList = formTags
      .split(/[,#\s]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    try {
      if (editingMemory) {
        // Update
        const updated = await nexaMemoryStorage.update(editingMemory.id, {
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory,
          status: formStatus,
          tags: tagList,
          verificationStatus: formVerification,
        });
        setMemories(prev => prev.map(m => m.id === updated.id ? updated : m));
        showToast(`Memory "${updated.title}" updated successfully.`);
      } else {
        // Create
        const created = await nexaMemoryStorage.save({
          id: "",
          userId: "bhavik-core",
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory,
          tags: tagList,
          source: "Manual",
          status: formStatus,
          verificationStatus: formVerification,
          confidence: 1.0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastRecalledAt: null,
          recallCount: 0,
          relatedMemoryIds: [],
          sourceConversationId: null
        });
        setMemories(prev => [created, ...prev]);
        showToast(`Memory "${created.title}" saved to long-term memory.`);
      }
      setIsEditorOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save memory.");
    }
  };

  // Delete Memory
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await nexaMemoryStorage.delete(deleteTarget.id);
      setMemories(prev => prev.filter(m => m.id !== deleteTarget.id));
      showToast(`Memory "${deleteTarget.title}" deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showToast("Failed to delete memory: " + err.message, "error");
    }
  };

  // Quick Verification Toggle
  const handleQuickVerify = async (memory: NexaMemory) => {
    try {
      const nextStatus: VerificationStatus = memory.verificationStatus === "UserVerified" ? "AIExtracted" : "UserVerified";
      const updated = await nexaMemoryStorage.update(memory.id, { verificationStatus: nextStatus });
      setMemories(prev => prev.map(m => m.id === updated.id ? updated : m));
      showToast(nextStatus === "UserVerified" ? "Marked as User-Verified!" : "Reset to AI-Extracted.");
    } catch (err) {
      showToast("Failed to update verification status.", "error");
    }
  };

  // Quick Status Change
  const handleQuickStatusChange = async (memory: NexaMemory, newStatus: MemoryStatus) => {
    setStatusMenuOpenId(null);
    try {
      const updated = await nexaMemoryStorage.update(memory.id, { status: newStatus });
      setMemories(prev => prev.map(m => m.id === updated.id ? updated : m));
      showToast(`Status changed to ${newStatus}.`);
    } catch (err) {
      showToast("Failed to change status.", "error");
    }
  };

  // Toggle Auto Memory
  const handleToggleAutoMemory = async () => {
    const updated = { ...settings, autoMemoryEnabled: !settings.autoMemoryEnabled };
    setSettings(updated);
    await nexaMemoryStorage.saveSettings(updated);
    showToast(updated.autoMemoryEnabled ? "AI Auto-Memory extraction enabled!" : "AI Auto-Memory extraction paused.");
  };

  // Export JSON
  const handleExportJSON = async () => {
    try {
      const jsonStr = await nexaMemoryStorage.exportJSON();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexa-memories-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Exported all memories to JSON backup!");
    } catch (err: any) {
      showToast("Export failed: " + err.message, "error");
    }
  };

  // Import JSON
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const content = evt.target?.result as string;
          const result = await nexaMemoryStorage.importJSON(content);
          const reloaded = await nexaMemoryStorage.getAll();
          setMemories(reloaded);
          showToast(`Imported ${result.importedCount} new memories and updated ${result.updatedCount}!`);
          if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (innerErr: any) {
          showToast("Import error: " + innerErr.message, "error");
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      showToast("Failed to read file: " + err.message, "error");
    }
  };

  // Clear All Memories
  const handleClearAll = async () => {
    try {
      await nexaMemoryStorage.clearAll();
      setMemories([]);
      setShowClearConfirm(false);
      setIsSettingsOpen(false);
      showToast("All memories cleared.", "info");
    } catch (err: any) {
      showToast("Failed to clear memories: " + err.message, "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl border shadow-xl flex items-center gap-2 text-sm font-medium backdrop-blur-md ${
              notification.type === "success" 
                ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-950/50" 
                : notification.type === "error"
                ? "bg-rose-950/90 text-rose-300 border-rose-500/40 shadow-rose-950/50"
                : "bg-cyan-950/90 text-cyan-300 border-cyan-500/40 shadow-cyan-950/50"
            }`}
          >
            {notification.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {notification.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-400" />}
            {notification.type === "info" && <Sparkles className="w-4 h-4 text-cyan-400" />}
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col bg-[#0B0F17]/95 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/40 overflow-hidden text-zinc-100">
        
        {/* ========================================================= */}
        {/* MODAL HEADER                                              */}
        {/* ========================================================= */}
        <div className="flex-none p-4 md:p-5 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-500/10">
              <Brain className="w-6 h-6 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-wider text-white">
                  NEXA <span className="text-cyan-400">MEMORY CORE</span>
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {memories.length} Memories
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  IndexedDB Persistent
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Structured multi-category durable knowledge engine across all sessions & restarts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Memory Toggle Quick Action */}
            <button
              onClick={handleToggleAutoMemory}
              title={`AI Auto-Memory: ${settings.autoMemoryEnabled ? "Enabled" : "Paused"}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                settings.autoMemoryEnabled
                  ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20"
                  : "bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${settings.autoMemoryEnabled ? "text-cyan-400" : "text-zinc-500"}`} />
              <span className="hidden sm:inline">AI Auto-Memory:</span>
              <span className="font-semibold">{settings.autoMemoryEnabled ? "ON" : "OFF"}</span>
            </button>

            {/* Add Memory Button */}
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Memory</span>
            </button>

            {/* Refresh */}
            <button
              onClick={loadData}
              title="Sync & Refresh Memories"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
            </button>

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Memory Center Settings & Export"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-cyan-400 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CATEGORY TABS                                             */}
        {/* ========================================================= */}
        <div className="flex-none px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-900/30 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeTab === cat.id;
              const count = categoryCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? `${cat.bg} ${cat.border} ${cat.color} border shadow-sm`
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
                  }`}
                  title={cat.desc}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-black/30 text-white font-bold" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SEARCH & FILTERS BAR                                      */}
        {/* ========================================================= */}
        <div className="flex-none p-3 md:px-5 border-b border-zinc-800/60 bg-zinc-950/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories by title, text, or #tag..."
              className="w-full pl-9 pr-8 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills & Sorters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-2 py-1">
              <span className="text-zinc-500 text-[11px] font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-zinc-300 focus:outline-none text-xs cursor-pointer"
              >
                <option value="All" className="bg-zinc-900">All</option>
                <option value="Active" className="bg-zinc-900">Active</option>
                <option value="Planned" className="bg-zinc-900">Planned</option>
                <option value="Completed" className="bg-zinc-900">Completed</option>
                <option value="Archived" className="bg-zinc-900">Archived</option>
              </select>
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-2 py-1">
              <span className="text-zinc-500 text-[11px] font-medium">Source:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="bg-transparent text-zinc-300 focus:outline-none text-xs cursor-pointer"
              >
                <option value="All" className="bg-zinc-900">All</option>
                <option value="Manual" className="bg-zinc-900">Manual (User)</option>
                <option value="Automatic" className="bg-zinc-900">Automatic (AI)</option>
              </select>
            </div>

            {/* Verification Filter */}
            <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-2 py-1">
              <span className="text-zinc-500 text-[11px] font-medium">Verification:</span>
              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value as any)}
                className="bg-transparent text-zinc-300 focus:outline-none text-xs cursor-pointer"
              >
                <option value="All" className="bg-zinc-900">All</option>
                <option value="UserVerified" className="bg-zinc-900">Verified</option>
                <option value="AIExtracted" className="bg-zinc-900">AI-Extracted</option>
                <option value="Uncertain" className="bg-zinc-900">Uncertain</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-2 py-1">
              <span className="text-zinc-500 text-[11px] font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-zinc-300 focus:outline-none text-xs cursor-pointer"
              >
                <option value="updated_desc" className="bg-zinc-900">Recently Updated</option>
                <option value="created_desc" className="bg-zinc-900">Recently Created</option>
                <option value="created_asc" className="bg-zinc-900">Oldest First</option>
                <option value="alphabetical" className="bg-zinc-900">A - Z</option>
                <option value="recall_count" className="bg-zinc-900">Most Recalled</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MEMORY CARDS GRID                                         */}
        {/* ========================================================= */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm">Synchronizing IndexedDB memory core...</p>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-zinc-800/80 rounded-2xl bg-zinc-950/20">
              <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 text-cyan-400 mb-3">
                <Brain className="w-10 h-10 opacity-70" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-200 mb-1">
                {searchQuery ? "No matching memories found" : "No memories in this category yet"}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mb-4">
                {searchQuery 
                  ? `Zero memories matched "${searchQuery}". Try different keywords or clear your search filters.`
                  : "NEXA will automatically extract long-term facts when Bhavik speaks, or you can record one manually right now."}
              </p>
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 text-xs font-semibold transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Memory</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMemories.map((mem) => {
                const catMeta = CATEGORIES.find(c => c.id === mem.category) || CATEGORIES[1];
                const statusMeta = STATUS_CONFIG[mem.status] || STATUS_CONFIG.Active;
                const isVerified = mem.verificationStatus === "UserVerified";

                return (
                  <div
                    key={mem.id}
                    className="group relative flex flex-col justify-between p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-cyan-500/40 transition-all shadow-md hover:shadow-cyan-950/30"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${catMeta.bg} ${catMeta.border} ${catMeta.color}`}>
                          {mem.category}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Quick Status Dropdown */}
                          <div className="relative">
                            <button
                              onClick={() => setStatusMenuOpenId(statusMenuOpenId === mem.id ? null : mem.id)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${statusMeta.bg} ${statusMeta.border} ${statusMeta.color}`}
                              title="Click to toggle status"
                            >
                              <span>{statusMeta.label}</span>
                              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                            </button>

                            {statusMenuOpenId === mem.id && (
                              <div className="absolute right-0 top-full mt-1 z-30 w-28 py-1 rounded-xl bg-zinc-950 border border-zinc-800 shadow-xl text-xs">
                                {(["Active", "Planned", "Completed", "Archived"] as MemoryStatus[]).map((st) => (
                                  <button
                                    key={st}
                                    onClick={() => handleQuickStatusChange(mem, st)}
                                    className={`w-full text-left px-3 py-1 hover:bg-zinc-800/80 flex items-center justify-between ${
                                      mem.status === st ? "text-cyan-400 font-bold" : "text-zinc-300"
                                    }`}
                                  >
                                    <span>{st}</span>
                                    {mem.status === st && <Check className="w-3 h-3 text-cyan-400" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Verification Badge */}
                          <button
                            onClick={() => handleQuickVerify(mem)}
                            title={isVerified ? "User-Verified memory (Click to change)" : "AI-Extracted memory (Click to verify)"}
                            className={`p-1 rounded-lg border transition-all ${
                              isVerified
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                            }`}
                          >
                            {isVerified ? (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-bold text-zinc-100 group-hover:text-cyan-300 transition-colors line-clamp-1 mb-1.5">
                        {mem.title}
                      </h4>

                      {/* Content */}
                      <p className="text-xs text-zinc-300/90 leading-relaxed whitespace-pre-wrap line-clamp-4 mb-3 font-normal">
                        {mem.content}
                      </p>

                      {/* Tags */}
                      {mem.tags && mem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {mem.tags.slice(0, 4).map((t, idx) => (
                            <span
                              key={idx}
                              onClick={() => setSearchQuery(t)}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors"
                            >
                              #{t}
                            </span>
                          ))}
                          {mem.tags.length > 4 && (
                            <span className="text-[10px] text-zinc-500 self-center">
                              +{mem.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer Info & Actions */}
                    <div className="pt-2.5 border-t border-zinc-800/60 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <div className="flex items-center gap-2">
                        {mem.recallCount > 0 ? (
                          <span className="flex items-center gap-1 text-cyan-400/80 font-medium" title={`Recalled in ${mem.recallCount} conversational turns`}>
                            <Eye className="w-3 h-3" />
                            <span>{mem.recallCount}x</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-zinc-600" title="Not recalled yet">
                            <Clock className="w-3 h-3" />
                            <span>New</span>
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(mem.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEdit(mem)}
                          title="Edit Memory"
                          className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(mem)}
                          title="Delete Memory"
                          className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* FOOTER BAR                                                */}
        {/* ========================================================= */}
        <div className="flex-none p-3 px-5 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <span>Showing <span className="text-zinc-200 font-semibold">{filteredMemories.length}</span> of {memories.length} memories</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline text-zinc-500">Auto-Recall matches relevant memories into Gemini context prior to answering</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CREATE / EDIT MODAL                                       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isEditorOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#0F1420] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden text-zinc-100"
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-sm text-white">
                    {editingMemory ? "Edit Memory" : "Save New Memory"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="p-5 space-y-4 text-xs">
                {formError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Title / Fact Label *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Next.js Architecture Preference"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 text-xs"
                  />
                </div>

                {/* Category & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-cyan-500/60 text-xs"
                    >
                      {CATEGORIES.filter(c => c.id !== "All").map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900">{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as MemoryStatus)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-cyan-500/60 text-xs"
                    >
                      <option value="Active" className="bg-zinc-900">Active</option>
                      <option value="Planned" className="bg-zinc-900">Planned</option>
                      <option value="Completed" className="bg-zinc-900">Completed</option>
                      <option value="Archived" className="bg-zinc-900">Archived</option>
                    </select>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Memory Content / Detail *</label>
                  <textarea
                    rows={4}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Describe what NEXA should permanently remember about this topic, project, preference, or person..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 text-xs leading-relaxed resize-none"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Tags (comma or space separated)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="react, tailwind, coding, prompt"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 text-xs"
                  />
                </div>

                {/* Verification Level */}
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Verification Level</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={formVerification === "UserVerified"}
                        onChange={() => setFormVerification("UserVerified")}
                        className="text-cyan-500 focus:ring-0"
                      />
                      <span className="text-zinc-300">User Verified (Protected)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={formVerification === "AIExtracted"}
                        onChange={() => setFormVerification("AIExtracted")}
                        className="text-cyan-500 focus:ring-0"
                      />
                      <span className="text-zinc-300">AI Extracted</span>
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20"
                  >
                    {editingMemory ? "Save Changes" : "Create Memory"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION MODAL                                 */}
      {/* ========================================================= */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0F1420] border border-rose-500/40 rounded-2xl shadow-2xl p-5 text-zinc-100"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white mb-1">Delete Long-Term Memory?</h3>
                  <p className="text-xs text-zinc-400">
                    Are you sure you want to permanently erase <span className="text-zinc-200 font-semibold">"{deleteTarget.title}"</span>?
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-400 mb-4 line-clamp-3 italic">
                "{deleteTarget.content}"
              </div>

              <p className="text-[11px] text-zinc-500 mb-5">
                NEXA will lose this knowledge across all future conversation turns and resets.
              </p>

              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-rose-600/30"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* SETTINGS DRAWER                                           */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0F1420] border border-cyan-500/40 rounded-2xl shadow-2xl p-5 text-zinc-100 text-xs space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-sm text-white">Memory Core Settings</h3>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Auto Memory Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div>
                  <h4 className="font-semibold text-zinc-200">AI Auto-Memory Extraction</h4>
                  <p className="text-[11px] text-zinc-400">Extracts projects and durable facts from chat automatically</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoMemoryEnabled}
                  onChange={handleToggleAutoMemory}
                  className="w-4 h-4 accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Backup & Restore */}
              <div className="space-y-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <h4 className="font-semibold text-zinc-200">Backup & Restore</h4>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleExportJSON}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    <span>Import JSON</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportJSON}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Danger Zone */}
              <div className="space-y-2 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                <h4 className="font-semibold text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Danger Zone</span>
                </h4>
                <p className="text-[11px] text-zinc-400">Wipe all stored long-term memories from IndexedDB</p>
                
                {showClearConfirm ? (
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={handleClearAll}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs"
                    >
                      Yes, Clear Everything
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-medium text-xs text-center"
                  >
                    Clear All Memories
                  </button>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-semibold"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
