"use client";

import { useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import { fetchApi } from "@/lib/api";

type AnalyzeResult = {
  summary: string;
  key_skills: string[];
  match_score: number;
  missing_keywords: string[];
};

type InterviewQuestion = {
  question: string;
  category: string;
  difficulty: string;
};

type InterviewResult = {
  questions: InterviewQuestion[];
  tips: string[];
};

type ResumeSuggestion = {
  section: string;
  suggestion: string;
  priority: string;
};

type ResumeResult = {
  overall_score: number;
  suggestions: ResumeSuggestion[];
  improved_summary: string;
};

type LearningResource = {
  title: string;
  provider: string;
  url: string;
  format: string;
  is_free: boolean;
};

type LearningResult = {
  recommendations: LearningResource[];
  priority_skills: string[];
};

type Tab = "analyze" | "interview" | "resume" | "learn";

export default function AiToolsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("analyze");
  
  // Shared state
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState<null | "fetch" | "analyze" | "interview" | "resume" | "learn">(null);
  const [error, setError] = useState("");
  
  // Results state
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [interviewResult, setInterviewResult] = useState<InterviewResult | null>(null);
  const [resumeResult, setResumeResult] = useState<ResumeResult | null>(null);
  const [learningResult, setLearningResult] = useState<LearningResult | null>(null);

  const fetchFromUrl = async () => {
    setError("");
    setLoading("fetch");
    try {
      const data = await fetchApi<{ text: string }>("/ai/fetch-job", {
        method: "POST",
        body: JSON.stringify({ url: jobUrl }),
      });
      setJobText(data.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch job text.");
    } finally {
      setLoading(null);
    }
  };

  const analyze = async () => {
    setError("");
    setAnalyzeResult(null);
    setLoading("analyze");
    try {
      const data = await fetchApi<AnalyzeResult>("/ai/analyze", {
        method: "POST",
        body: JSON.stringify({ job_text: jobText, resume_text: resumeText, skills }),
      });
      setAnalyzeResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(null);
    }
  };

  const generateInterviewQuestions = async () => {
    setError("");
    setInterviewResult(null);
    setLoading("interview");
    try {
      const data = await fetchApi<InterviewResult>("/ai/interview-questions", {
        method: "POST",
        body: JSON.stringify({ job_text: jobText, resume_text: resumeText }),
      });
      setInterviewResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate questions.");
    } finally {
      setLoading(null);
    }
  };

  const optimizeResume = async () => {
    setError("");
    setResumeResult(null);
    setLoading("resume");
    try {
      const data = await fetchApi<ResumeResult>("/ai/resume-optimize", {
        method: "POST",
        body: JSON.stringify({ job_text: jobText, resume_text: resumeText }),
      });
      setResumeResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to optimize resume.");
    } finally {
      setLoading(null);
    }
  };

  const getLearningRecommendations = async () => {
    setError("");
    setLearningResult(null);
    setLoading("learn");
    try {
      const data = await fetchApi<LearningResult>("/ai/learning-recommendations", {
        method: "POST",
        body: JSON.stringify({ skills: skills || resumeText, job_text: jobText }),
      });
      setLearningResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get recommendations.");
    } finally {
      setLoading(null);
    }
  };

  const tabs = [
    { id: "analyze" as Tab, label: "Job Match Analysis" },
    { id: "interview" as Tab, label: "Interview Questions" },
    { id: "resume" as Tab, label: "Resume Optimizer" },
    { id: "learn" as Tab, label: "Learning Resources" },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/15 text-red-300 border-red-500/20";
      case "medium": return "bg-amber-500/15 text-amber-300 border-amber-500/20";
      default: return "bg-slate-700/50 text-slate-300 border-slate-600/30";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Hard": return "bg-red-500/15 text-red-300";
      case "Medium": return "bg-amber-500/15 text-amber-300";
      default: return "bg-emerald-500/15 text-emerald-300";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Technical": return "bg-blue-500/15 text-blue-300";
      case "Behavioral": return "bg-purple-500/15 text-purple-300";
      default: return "bg-slate-500/15 text-slate-300";
    }
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">AI Tools</h1>
            <p className="text-slate-400 mt-2">
              Get AI-powered insights to improve your job search and interview prep.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-700 pb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === tab.id
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300 text-sm">
              {error}
            </div>
          )}

          {/* Job Input Section - Always Visible */}
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-6 mb-6 shadow-xl shadow-black/10">
            <h2 className="font-semibold mb-4">Job Information</h2>
            
            <div className="space-y-2 mb-4">
              <label className="text-sm text-slate-400">Job URL (optional - for auto-fetch)</label>
              <div className="flex gap-2">
                <input
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="Paste job link (LinkedIn/Naukri/etc.)"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500"
                />
                <button
                  onClick={fetchFromUrl}
                  disabled={!jobUrl || loading !== null}
                  className="px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 transition disabled:opacity-50 text-sm font-medium"
                >
                  {loading === "fetch" ? "Fetching…" : "Fetch"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-400">Job description text</label>
              <textarea
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                placeholder="Paste job description here…"
                rows={6}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500 resize-y"
              />
            </div>
          </div>

          {/* Profile Input Section */}
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-6 mb-6 shadow-xl shadow-black/10">
            <h2 className="font-semibold mb-4">Your Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Resume text (optional)</label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume text here…"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500 resize-y"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Skills (comma-separated)</label>
                <input
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. React, Next.js, FastAPI, PostgreSQL"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "analyze" && (
            <div className="space-y-6">
              <button
                onClick={analyze}
                disabled={loading !== null || jobText.trim().length < 30}
                className="w-full px-5 py-3.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition disabled:opacity-50 shadow-lg shadow-emerald-500/20"
              >
                {loading === "analyze" ? "Analyzing…" : "Analyze Job Match"}
              </button>

              {analyzeResult && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Match score</p>
                    <p className="text-white text-3xl font-bold mt-1">{Math.max(0, Math.min(100, analyzeResult.match_score))}%</p>
                  </div>

                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Summary</p>
                    <p className="text-slate-200 text-sm mt-2 leading-relaxed">{analyzeResult.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
                      <p className="text-slate-400 text-xs uppercase tracking-wider">Key skills</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {analyzeResult.key_skills?.length ? (
                          analyzeResult.key_skills.map((s) => (
                            <span key={s} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs border border-emerald-500/20">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
                      <p className="text-slate-400 text-xs uppercase tracking-wider">Missing keywords</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {analyzeResult.missing_keywords?.length ? (
                          analyzeResult.missing_keywords.map((s) => (
                            <span key={s} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs border border-slate-700">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "interview" && (
            <div className="space-y-6">
              <button
                onClick={generateInterviewQuestions}
                disabled={loading !== null || jobText.trim().length < 30}
                className="w-full px-5 py-3.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition disabled:opacity-50 shadow-lg shadow-emerald-500/20"
              >
                {loading === "interview" ? "Generating…" : "Generate Interview Questions"}
              </button>

              {interviewResult && (
                <div className="space-y-4">
                  {/* Tips */}
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <p className="text-blue-300 text-sm font-semibold mb-2">Interview Tips</p>
                    <ul className="space-y-1">
                      {interviewResult.tips.map((tip, i) => (
                        <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                          <span className="text-blue-400">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Questions */}
                  <div className="space-y-3">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Generated Questions</p>
                    {interviewResult.questions.map((q, i) => (
                      <div key={i} className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(q.category)}`}>
                            {q.category}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(q.difficulty)}`}>
                            {q.difficulty}
                          </span>
                        </div>
                        <p className="text-white">{q.question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "resume" && (
            <div className="space-y-6">
              <button
                onClick={optimizeResume}
                disabled={loading !== null || jobText.trim().length < 30 || resumeText.trim().length < 30}
                className="w-full px-5 py-3.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition disabled:opacity-50 shadow-lg shadow-emerald-500/20"
              >
                {loading === "resume" ? "Optimizing…" : "Optimize My Resume"}
              </button>

              {resumeResult && (
                <div className="space-y-4">
                  {/* Score */}
                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Resume Score</p>
                    <p className="text-white text-3xl font-bold mt-1">{resumeResult.overall_score}/100</p>
                  </div>

                  {/* Improved Summary */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <p className="text-emerald-300 text-sm font-semibold mb-2">Suggested Professional Summary</p>
                    <p className="text-slate-200 text-sm">{resumeResult.improved_summary}</p>
                  </div>

                  {/* Suggestions */}
                  <div className="space-y-3">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Improvement Suggestions</p>
                    {resumeResult.suggestions.map((s, i) => (
                      <div key={i} className={`rounded-xl border p-4 ${getPriorityColor(s.priority)}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{s.section}</span>
                          <span className="text-xs uppercase opacity-70">({s.priority} priority)</span>
                        </div>
                        <p className="text-sm opacity-90">{s.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "learn" && (
            <div className="space-y-6">
              <button
                onClick={getLearningRecommendations}
                disabled={loading !== null || (skills.trim().length < 2 && resumeText.trim().length < 2)}
                className="w-full px-5 py-3.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition disabled:opacity-50 shadow-lg shadow-emerald-500/20"
              >
                {loading === "learn" ? "Finding Resources…" : "Get Learning Recommendations"}
              </button>

              {learningResult && (
                <div className="space-y-4">
                  {/* Priority Skills */}
                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Priority Skills to Learn</p>
                    <div className="flex flex-wrap gap-2">
                      {learningResult.priority_skills.map((skill) => (
                        <span key={skill} className="px-3 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-sm border border-amber-500/20">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Resources */}
                  <div className="space-y-3">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Recommended Resources</p>
                    {learningResult.recommendations.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl border border-slate-700/70 bg-slate-900/40 p-4 hover:border-emerald-500/30 hover:bg-slate-800/50 transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-white font-medium">{r.title}</p>
                            <p className="text-slate-400 text-sm mt-1">{r.provider}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2 py-0.5 rounded text-xs ${r.is_free ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
                              {r.is_free ? "Free" : "Paid"}
                            </span>
                            <span className="text-xs text-slate-500 capitalize">{r.format}</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}

