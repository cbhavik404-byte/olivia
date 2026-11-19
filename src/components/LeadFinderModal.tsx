import React, { useState, useEffect } from "react";
import { 
  X, 
  Search, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  Globe, 
  Mail, 
  Linkedin, 
  Instagram, 
  ExternalLink, 
  Download, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  SlidersHorizontal,
  ChevronRight,
  Filter,
  UserCheck,
  MessageSquare,
  ArrowRight,
  Plus
} from "lucide-react";
import { LeadProspect, LeadSearchCriteria, OutreachStatus } from "../types";
import { searchAndGenerateLeads, generateFollowUpEmail } from "../services/leadService";
import { motion, AnimatePresence } from "motion/react";

interface LeadFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_INDUSTRIES = [
  "Perfume & Fragrances",
  "Skincare & Cosmetics",
  "Clothing & Fashion",
  "Jewelry & Luxury",
  "Restaurants & Cafes",
  "SaaS & B2B Software",
  "Health & Wellness",
  "E-commerce & D2C",
  "Real Estate & Architecture"
];

const COMPANY_SIZES = [
  "Solo / 1-5 employees",
  "6-20 employees (Boutique)",
  "21-50 employees (Growing)",
  "51-200 employees (Mid-Market)",
  "200+ employees (Enterprise)"
];

export default function LeadFinderModal({ isOpen, onClose }: LeadFinderModalProps) {
  const [criteria, setCriteria] = useState<LeadSearchCriteria>({
    targetClientType: "Boutique Perfume & Skincare Brands",
    region: "United States & Europe",
    industry: "Perfume & Fragrances",
    companySize: "6-20 employees (Boutique)",
    offeringDescription: "AI automated customer support, high-converting product pages, and social media growth system",
    tone: "value-led",
    leadCount: 5
  });

  const [leads, setLeads] = useState<LeadProspect[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexa_saved_leads");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const seenIds = new Set<string>();
            const seenNames = new Set<string>();
            const cleaned: LeadProspect[] = [];
            
            parsed.forEach((item: any, idx: number) => {
              if (!item || typeof item !== "object") return;
              const nameKey = (item.businessName || "").toLowerCase().trim();
              if (nameKey && seenNames.has(nameKey)) return;
              if (nameKey) seenNames.add(nameKey);

              let id = item.id;
              if (!id || seenIds.has(id)) {
                id = `lead-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              }
              seenIds.add(id);
              cleaned.push({ ...item, id });
            });
            return cleaned;
          }
        } catch (e) {
          console.error("Failed to load saved leads", e);
        }
      }
    }
    return [];
  });

  const [isSearching, setIsSearching] = useState(false);
  const [searchStep, setSearchStep] = useState<string>("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"search" | "leads" | "outreach" | "followups">("search");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);

  // Save to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nexa_saved_leads", JSON.stringify(leads));
    }
  }, [leads]);

  // Set default selected lead if leads exist
  useEffect(() => {
    if (leads.length > 0 && !selectedLeadId) {
      setSelectedLeadId(leads[0].id);
    }
  }, [leads, selectedLeadId]);

  if (!isOpen) return null;

  const handleSearch = async () => {
    setIsSearching(true);
    setSearchStep("Scanning publicly available business data and directories...");

    const step1 = setTimeout(() => {
      setSearchStep("Extracting verified contact emails, websites, and social profiles...");
    }, 1200);

    const step2 = setTimeout(() => {
      setSearchStep("Evaluating prospect viability and crafting custom outreach drafts...");
    }, 2800);

    try {
      const results = await searchAndGenerateLeads(criteria);
      clearTimeout(step1);
      clearTimeout(step2);

      // Append new leads while avoiding duplicates by business name or ID
      setLeads(prev => {
        const existingNames = new Set(prev.map(p => p.businessName.toLowerCase().trim()));
        const existingIds = new Set(prev.map(p => p.id));
        const uniqueNew: LeadProspect[] = [];

        results.forEach((r, rIdx) => {
          const nameKey = (r.businessName || "").toLowerCase().trim();
          if (nameKey && existingNames.has(nameKey)) return;
          if (nameKey) existingNames.add(nameKey);

          let id = r.id;
          if (!id || existingIds.has(id)) {
            id = `lead-gen-${rIdx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          }
          existingIds.add(id);
          uniqueNew.push({ ...r, id });
        });

        return [...uniqueNew, ...prev];
      });

      if (results.length > 0) {
        setSelectedLeadId(results[0].id);
      }
      setActiveTab("leads");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
      setSearchStep("");
    }
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId) || leads[0];

  const updateLeadStatus = (leadId: string, newStatus: OutreachStatus) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const updated = { ...l, status: newStatus, lastUpdated: new Date().toISOString() };
        if (newStatus === "sent" && !l.followUpDate) {
          const followDate = new Date();
          followDate.setDate(followDate.getDate() + 3);
          updated.followUpDate = followDate.toISOString().split("T")[0];
        }
        return updated;
      }
      return l;
    }));
  };

  const updateLeadDetails = (leadId: string, fields: Partial<LeadProspect>) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...fields, lastUpdated: new Date().toISOString() } : l));
  };

  const approveAllDrafts = () => {
    setLeads(prev => prev.map(l => l.status === "draft" ? { ...l, status: "approved" } : l));
  };

  const copyToClipboard = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportCSV = () => {
    const headers = [
      "Business Name",
      "Industry",
      "Location",
      "Company Size",
      "Website",
      "Contact Email",
      "Contact Page",
      "LinkedIn",
      "Instagram",
      "Match Score",
      "Qualification Reason",
      "Outreach Status",
      "Email Subject",
      "Email Body",
      "Follow-up Date",
      "Notes"
    ];

    const rows = leads.map(l => [
      `"${l.businessName.replace(/"/g, '""')}"`,
      `"${l.industry.replace(/"/g, '""')}"`,
      `"${l.countryOrRegion.replace(/"/g, '""')}"`,
      `"${l.companySize.replace(/"/g, '""')}"`,
      `"${l.website.replace(/"/g, '""')}"`,
      `"${l.contactEmail.replace(/"/g, '""')}"`,
      `"${l.contactPageUrl.replace(/"/g, '""')}"`,
      `"${l.linkedinUrl.replace(/"/g, '""')}"`,
      `"${l.instagramUrl.replace(/"/g, '""')}"`,
      `${l.prospectScore}%`,
      `"${l.qualificationReason.replace(/"/g, '""')}"`,
      `"${l.status}"`,
      `"${l.emailSubject.replace(/"/g, '""')}"`,
      `"${l.emailBody.replace(/"/g, '""')}"`,
      `"${l.followUpDate || ""}"`,
      `"${(l.notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nexa_leads_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyForGoogleSheets = () => {
    const headers = [
      "Business Name",
      "Industry",
      "Location",
      "Company Size",
      "Website",
      "Contact Email",
      "Contact Page",
      "LinkedIn",
      "Instagram",
      "Match Score",
      "Qualification Reason",
      "Outreach Status",
      "Email Subject",
      "Email Body",
      "Follow-up Date"
    ];

    const rows = leads.map(l => [
      l.businessName,
      l.industry,
      l.countryOrRegion,
      l.companySize,
      l.website,
      l.contactEmail,
      l.contactPageUrl,
      l.linkedinUrl,
      l.instagramUrl,
      `${l.prospectScore}%`,
      l.qualificationReason,
      l.status,
      l.emailSubject,
      l.emailBody.replace(/\n/g, " "),
      l.followUpDate || ""
    ]);

    const tsvContent = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
    copyToClipboard(tsvContent, "sheets_export");
  };

  const handleSendEmail = (lead: LeadProspect) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.contactEmail)}&su=${encodeURIComponent(lead.emailSubject)}&body=${encodeURIComponent(lead.emailBody)}`;
    window.open(gmailUrl, "_blank");
    updateLeadStatus(lead.id, "sent");
  };

  const handleGenerateFollowUp = async (lead: LeadProspect) => {
    setIsGeneratingFollowUp(true);
    try {
      const followUpText = await generateFollowUpEmail(lead, 1);
      updateLeadDetails(lead.id, {
        notes: (lead.notes ? lead.notes + "\n\n" : "") + `[Follow-Up Draft]:\n${followUpText}`,
        status: "followup_needed"
      });
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  const filteredLeads = leads.filter(l => {
    if (statusFilter === "all") return true;
    return l.status === statusFilter;
  });

  const countDraft = leads.filter(l => l.status === "draft").length;
  const countApproved = leads.filter(l => l.status === "approved").length;
  const countSent = leads.filter(l => l.status === "sent").length;
  const countFollowUp = leads.filter(l => l.status === "followup_needed").length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-6xl h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-white">AI Lead Finder & Outreach Agent</h2>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  NEXA Pro
                </span>
              </div>
              <p className="text-xs text-zinc-400">Discover verified business leads, craft hyper-personalized emails, and manage follow-ups.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {leads.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition"
                  title="Download CSV file"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  CSV
                </button>
                <button
                  onClick={copyForGoogleSheets}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition"
                  title="Copy formatted data for Google Sheets"
                >
                  {copiedId === "sheets_export" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                      Sheets
                    </>
                  )}
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-800/60 bg-zinc-900/30 text-xs font-medium">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === "search"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Find New Leads
            </button>

            <button
              onClick={() => setActiveTab("leads")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === "leads"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Qualified Leads ({leads.length})
            </button>

            <button
              onClick={() => setActiveTab("outreach")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === "outreach"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Email Review & Dispatch
              {countDraft + countApproved > 0 && (
                <span className="px-1.5 py-0.2 bg-emerald-500/30 text-emerald-300 rounded text-[10px]">
                  {countDraft + countApproved}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("followups")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === "followups"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Follow-ups & Pipeline ({countSent + countFollowUp})
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3 text-zinc-400 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Draft: {countDraft}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              Approved: {countApproved}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Dispatched: {countSent}
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* TAB 1: SEARCH & CRITERIA FORM */}
          {activeTab === "search" && (
            <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                    Target Client Specifications
                  </h3>
                  <span className="text-xs text-zinc-400">Powered by Gemini & Business Intelligence</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Industry selection */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Industry Category</label>
                    <select
                      value={criteria.industry}
                      onChange={e => setCriteria(prev => ({ ...prev, industry: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                    >
                      {DEFAULT_INDUSTRIES.map((ind, idx) => (
                        <option key={`industry-${ind}-${idx}`} value={ind}>{ind}</option>
                      ))}
                      <option value="Other Custom Niche">Other Custom Niche</option>
                    </select>
                  </div>

                  {/* Country or Region */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Country, Region or City</label>
                    <input
                      type="text"
                      value={criteria.region}
                      onChange={e => setCriteria(prev => ({ ...prev, region: e.target.value }))}
                      placeholder="e.g. United States, UK, India, Dubai, Australia"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  {/* Target Client Type / Niche description */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Target Client Archetype / Niche</label>
                    <input
                      type="text"
                      value={criteria.targetClientType}
                      onChange={e => setCriteria(prev => ({ ...prev, targetClientType: e.target.value }))}
                      placeholder="e.g. D2C Perfume Brands, Luxury Med-Spas, High-end Apparel, SaaS"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  {/* Preferred Company Size */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Preferred Company Size</label>
                    <select
                      value={criteria.companySize}
                      onChange={e => setCriteria(prev => ({ ...prev, companySize: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
                    >
                      {COMPANY_SIZES.map((size, idx) => (
                        <option key={`comp-size-${size}-${idx}`} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Offering / Value Proposition */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Your Offering / What Value You Provide</label>
                  <textarea
                    rows={2}
                    value={criteria.offeringDescription}
                    onChange={e => setCriteria(prev => ({ ...prev, offeringDescription: e.target.value }))}
                    placeholder="e.g. AI automation workflows, modern website redesign, high-converting product pages, or growth marketing."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition resize-none"
                  />
                </div>

                {/* Tone & Lead Count */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Outreach Tone</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "value-led", label: "Value-Led & Direct" },
                        { id: "conversational", label: "Friendly & Warm" },
                        { id: "professional", label: "Crisp & Executive" },
                        { id: "high-impact", label: "Hook & Case Study" }
                      ].map((t, idx) => (
                        <button
                          key={`tone-btn-${t.id}-${idx}`}
                          type="button"
                          onClick={() => setCriteria(prev => ({ ...prev, tone: t.id as any }))}
                          className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition ${
                            criteria.tone === t.id
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                              : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Batch Size to Generate</label>
                    <div className="flex items-center gap-2">
                      {[3, 5, 8, 10].map((count, idx) => (
                        <button
                          key={`batch-count-${count}-${idx}`}
                          type="button"
                          onClick={() => setCriteria(prev => ({ ...prev, leadCount: count }))}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition ${
                            criteria.leadCount === count
                              ? "bg-emerald-500 text-black border-emerald-400"
                              : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {count} Leads
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition"
                  >
                    {isSearching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Searching & Analyzing Prospects...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Discover Qualified Prospects & Draft Emails</span>
                      </>
                    )}
                  </button>

                  {isSearching && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-400 animate-pulse">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{searchStep}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Niche Suggestion Pills */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-400">Popular Lead Generation Archetypes:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "Luxury Artisanal Perfumery", ind: "Perfume & Fragrances", reg: "Europe & US" },
                    { name: "Organic Clinical Skincare", ind: "Skincare & Cosmetics", reg: "United States" },
                    { name: "High-Ticket Custom Jewelry", ind: "Jewelry & Luxury", reg: "India & UK" },
                    { name: "Boutique Italian & French Dining", ind: "Restaurants & Cafes", reg: "New York & London" },
                    { name: "Early Stage B2B AI SaaS", ind: "SaaS & B2B Software", reg: "Global" }
                  ].map((preset, idx) => (
                    <button
                      key={`lead-preset-${preset.name}-${idx}`}
                      onClick={() => setCriteria(prev => ({
                        ...prev,
                        targetClientType: preset.name,
                        industry: preset.ind,
                        region: preset.reg
                      }))}
                      className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-full text-xs text-zinc-300 hover:text-white transition"
                    >
                      {preset.name} ({preset.reg})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUALIFIED LEADS LIST */}
          {activeTab === "leads" && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Left Column: Leads Directory List */}
              <div className="w-full md:w-5/12 border-r border-zinc-800 flex flex-col bg-zinc-950/60">
                {/* Filter and stats */}
                <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between gap-2 bg-zinc-900/40">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-zinc-400" />
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 focus:outline-none"
                    >
                      <option value="all">All Prospects ({leads.length})</option>
                      <option value="draft">Drafts ({countDraft})</option>
                      <option value="approved">Approved ({countApproved})</option>
                      <option value="sent">Dispatched ({countSent})</option>
                      <option value="followup_needed">Follow-up ({countFollowUp})</option>
                    </select>
                  </div>

                  {countDraft > 0 && (
                    <button
                      onClick={approveAllDrafts}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded transition"
                    >
                      Approve All ({countDraft})
                    </button>
                  )}
                </div>

                {/* List items */}
                <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
                  {filteredLeads.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 space-y-3">
                      <Search className="w-8 h-8 mx-auto text-zinc-600" />
                      <p className="text-xs">No leads found in this view. Use 'Find New Leads' to search.</p>
                      <button
                        onClick={() => setActiveTab("search")}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium"
                      >
                        Search Now
                      </button>
                    </div>
                  ) : (
                    filteredLeads.map((lead, idx) => (
                      <div
                        key={`filtered-lead-${lead.id}-${idx}`}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`p-3.5 cursor-pointer transition ${
                          selectedLeadId === lead.id
                            ? "bg-emerald-500/10 border-l-2 border-emerald-500"
                            : "hover:bg-zinc-900/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-zinc-100">{lead.businessName}</h4>
                            <p className="text-xs text-zinc-400">{lead.industry} • {lead.countryOrRegion}</p>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {lead.prospectScore}% Fit
                          </span>
                        </div>

                        <p className="text-xs text-zinc-400 line-clamp-2 mt-1.5 font-light">
                          {lead.qualificationReason}
                        </p>

                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-zinc-900 text-[11px] text-zinc-400">
                          <span className={`capitalize font-medium ${
                            lead.status === "approved" ? "text-blue-400" :
                            lead.status === "sent" ? "text-emerald-400" :
                            lead.status === "followup_needed" ? "text-amber-400" :
                            "text-zinc-500"
                          }`}>
                            ● {lead.status}
                          </span>
                          <span className="text-zinc-400">{lead.companySize}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Selected Lead Deep-Dive & Details */}
              <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-zinc-900/30 space-y-5">
                {selectedLead ? (
                  <>
                    {/* Top Identity Card */}
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-white">{selectedLead.businessName}</h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {selectedLead.prospectScore}% Prospect Match
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">
                            {selectedLead.industry} | {selectedLead.countryOrRegion} | {selectedLead.companySize}
                          </p>
                        </div>

                        {/* Status Switcher */}
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedLead.status}
                            onChange={e => updateLeadStatus(selectedLead.id, e.target.value as OutreachStatus)}
                            className="bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="draft">Status: Draft</option>
                            <option value="approved">Status: Approved</option>
                            <option value="sent">Status: Sent / Dispatched</option>
                            <option value="replied">Status: Client Replied</option>
                            <option value="followup_needed">Status: Follow-up Needed</option>
                          </select>
                        </div>
                      </div>

                      {/* Web & Social Links */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        <a
                          href={selectedLead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800/80 hover:border-emerald-500/50 rounded-lg text-xs text-zinc-300 hover:text-white transition group"
                        >
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="truncate">Website</span>
                          <ExternalLink className="w-3 h-3 text-zinc-500 ml-auto opacity-0 group-hover:opacity-100 transition" />
                        </a>

                        <a
                          href={selectedLead.contactPageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800/80 hover:border-emerald-500/50 rounded-lg text-xs text-zinc-300 hover:text-white transition group"
                        >
                          <Mail className="w-3.5 h-3.5 text-teal-400" />
                          <span className="truncate">Contact Page</span>
                          <ExternalLink className="w-3 h-3 text-zinc-500 ml-auto opacity-0 group-hover:opacity-100 transition" />
                        </a>

                        <a
                          href={selectedLead.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800/80 hover:border-blue-500/50 rounded-lg text-xs text-zinc-300 hover:text-white transition group"
                        >
                          <Linkedin className="w-3.5 h-3.5 text-blue-400" />
                          <span className="truncate">LinkedIn</span>
                          <ExternalLink className="w-3 h-3 text-zinc-500 ml-auto opacity-0 group-hover:opacity-100 transition" />
                        </a>

                        <a
                          href={selectedLead.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800/80 hover:border-pink-500/50 rounded-lg text-xs text-zinc-300 hover:text-white transition group"
                        >
                          <Instagram className="w-3.5 h-3.5 text-pink-400" />
                          <span className="truncate">Instagram</span>
                          <ExternalLink className="w-3 h-3 text-zinc-500 ml-auto opacity-0 group-hover:opacity-100 transition" />
                        </a>
                      </div>

                      {/* Qualification Reason */}
                      <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block mb-1">
                          Why they are a prime prospect:
                        </span>
                        <p className="text-xs text-zinc-300 leading-relaxed">{selectedLead.qualificationReason}</p>
                      </div>
                    </div>

                    {/* Email Draft Preview & Approval Action */}
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Mail className="w-4 h-4 text-emerald-400" />
                          Personalized Outreach Draft
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(selectedLead.emailBody, `email-${selectedLead.id}`)}
                            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg transition"
                          >
                            {copiedId === `email-${selectedLead.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Text</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setEditingEmailId(editingEmailId === selectedLead.id ? null : selectedLead.id)}
                            className="text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg transition"
                          >
                            {editingEmailId === selectedLead.id ? "Done Editing" : "Edit Draft"}
                          </button>
                        </div>
                      </div>

                      {/* Email Subject */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                          Email Subject Line
                        </label>
                        {editingEmailId === selectedLead.id ? (
                          <input
                            type="text"
                            value={selectedLead.emailSubject}
                            onChange={e => updateLeadDetails(selectedLead.id, { emailSubject: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg px-3 py-2 text-xs font-medium text-zinc-200">
                            {selectedLead.emailSubject}
                          </div>
                        )}
                      </div>

                      {/* Email Body */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                          Email Message
                        </label>
                        {editingEmailId === selectedLead.id ? (
                          <textarea
                            rows={8}
                            value={selectedLead.emailBody}
                            onChange={e => updateLeadDetails(selectedLead.id, { emailBody: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
                          />
                        ) : (
                          <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3.5 text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                            {selectedLead.emailBody}
                          </div>
                        )}
                      </div>

                      {/* Dispatch & Approval Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-2">
                          {selectedLead.status === "draft" && (
                            <button
                              onClick={() => updateLeadStatus(selectedLead.id, "approved")}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve Email Draft
                            </button>
                          )}

                          {selectedLead.status === "approved" && (
                            <span className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              Approved for Outreach
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleSendEmail(selectedLead)}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send via Gmail / Email Client
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center text-zinc-500">
                    <p>Select a lead from the left to view details and personalized outreach.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OUTREACH REVIEW & APPROVAL STREAM */}
          {activeTab === "outreach" && (
            <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Outreach Review & Dispatch Queue</h3>
                  <p className="text-xs text-zinc-400">Review every personalized pitch before approving and dispatching.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={approveAllDrafts}
                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white text-xs font-medium rounded-lg transition"
                  >
                    Approve All Drafts
                  </button>
                </div>
              </div>

              {leads.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center text-zinc-400 space-y-3">
                  <Mail className="w-8 h-8 mx-auto text-zinc-500" />
                  <p className="text-sm font-medium">No leads currently in queue.</p>
                  <button
                    onClick={() => setActiveTab("search")}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg"
                  >
                    Generate First Lead Batch
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {leads.map((lead, idx) => (
                    <div
                      key={`outreach-lead-${lead.id}-${idx}`}
                      className={`bg-zinc-900/70 border rounded-xl p-5 space-y-4 transition ${
                        lead.status === "sent" ? "border-emerald-500/40 bg-emerald-950/10" :
                        lead.status === "approved" ? "border-blue-500/40" :
                        "border-zinc-800"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-semibold">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              {lead.businessName}
                              <span className="text-xs font-normal text-zinc-400">({lead.industry})</span>
                            </h4>
                            <span className="text-xs text-zinc-500">{lead.contactEmail} • {lead.countryOrRegion}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            lead.status === "sent" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                            lead.status === "approved" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                            lead.status === "followup_needed" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                            "bg-zinc-800 text-zinc-400"
                          }`}>
                            {lead.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="md:col-span-1 space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                            Key Angle & Prospect Fit
                          </span>
                          <p className="text-zinc-300 leading-relaxed bg-zinc-950/60 p-3 rounded-lg border border-zinc-900">
                            {lead.qualificationReason}
                          </p>
                          <div className="flex gap-2 text-[11px]">
                            <a href={lead.website} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Visit Site
                            </a>
                            <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                              <Linkedin className="w-3 h-3" /> LinkedIn
                            </a>
                          </div>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                              Subject: <span className="text-zinc-200 font-normal">{lead.emailSubject}</span>
                            </span>
                            <button
                              onClick={() => copyToClipboard(lead.emailBody, `body-${lead.id}`)}
                              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                            >
                              {copiedId === `body-${lead.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              Copy
                            </button>
                          </div>

                          <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 text-zinc-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                            {lead.emailBody}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div>
                          {lead.status === "draft" && (
                            <button
                              onClick={() => updateLeadStatus(lead.id, "approved")}
                              className="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition"
                            >
                              Approve Email
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => handleSendEmail(lead)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md transition"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {lead.status === "sent" ? "Resend / Open Again" : "Send via Gmail"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FOLLOW-UPS & PIPELINE TRACKER */}
          {activeTab === "followups" && (
            <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Follow-up Engine & Outreach Pipeline</h3>
                  <p className="text-xs text-zinc-400">Track sent outreach, log replies, and generate timed follow-up messages.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <span className="text-xs text-zinc-400">Total Contacted</span>
                  <p className="text-2xl font-bold text-white mt-1">{countSent + countFollowUp}</p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <span className="text-xs text-zinc-400">Follow-up Needed</span>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{countFollowUp}</p>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                  <span className="text-xs text-zinc-400">Total Leads in Database</span>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{leads.length}</p>
                </div>
              </div>

              <div className="space-y-4">
                {leads.filter(l => l.status === "sent" || l.status === "followup_needed" || l.status === "replied").length === 0 ? (
                  <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center text-zinc-400 space-y-2">
                    <Clock className="w-8 h-8 mx-auto text-zinc-500" />
                    <p className="text-sm">No outreach sent yet. Approve and dispatch emails from the Leads tab to begin tracking follow-ups.</p>
                  </div>
                ) : (
                  leads.filter(l => l.status === "sent" || l.status === "followup_needed" || l.status === "replied").map((lead, idx) => (
                    <div key={`followup-lead-${lead.id}-${idx}`} className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-white">{lead.businessName}</h4>
                          <p className="text-xs text-zinc-400">{lead.contactEmail} • Scheduled follow-up: {lead.followUpDate || "In 3 days"}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateLeadStatus(lead.id, "replied")}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                              lead.status === "replied" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-zinc-800 text-zinc-300 hover:text-white"
                            }`}
                          >
                            Mark as Replied 🎉
                          </button>

                          <button
                            onClick={() => handleGenerateFollowUp(lead)}
                            disabled={isGeneratingFollowUp}
                            className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 rounded text-xs font-medium flex items-center gap-1.5 transition"
                          >
                            <Sparkles className="w-3 h-3" />
                            Generate Follow-up
                          </button>
                        </div>
                      </div>

                      {lead.notes && (
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                          {lead.notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
