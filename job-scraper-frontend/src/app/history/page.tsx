"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import { fetchApi } from "@/lib/api";
import type { ApplicationHistoryItem } from "@/types";
import { APPLICATION_STATUSES } from "@/types";
import Link from "next/link";
import { useToast } from "@/components/Toast";

// Status colors mapping
const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  Applied: { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-500/30" },
  Screening: { bg: "bg-purple-500/20", text: "text-purple-300", border: "border-purple-500/30" },
  Interview: { bg: "bg-amber-500/20", text: "text-amber-300", border: "border-amber-500/30" },
  Offer: { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/30" },
  Rejected: { bg: "bg-red-500/20", text: "text-red-300", border: "border-red-500/30" },
  Ghosted: { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30" },
};

export default function HistoryPage() {
  const [history, setHistory] = useState<ApplicationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<ApplicationHistoryItem | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const { showToast } = useToast();

  const loadHistory = async () => {
    try {
      const data = await fetchApi<ApplicationHistoryItem[]>("/applications/history");
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleStatusChange = async (applicationId: number, newStatus: string) => {
    setUpdatingId(applicationId);
    try {
      await fetchApi(`/applications/${applicationId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      setHistory((prev) =>
        prev.map((app) =>
          app.id === applicationId ? { ...app, status: newStatus } : app
        )
      );
      showToast(`Status updated to ${newStatus}`, "success");
    } catch (err) {
      showToast("Failed to update status", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredHistory = history.filter((app) =>
    statusFilter === "all" ? true : app.status === statusFilter
  );

  // Calculate stats
  const stats = {
    total: history.length,
    applied: history.filter((h) => h.status === "Applied").length,
    screening: history.filter((h) => h.status === "Screening").length,
    interview: history.filter((h) => h.status === "Interview").length,
    offer: history.filter((h) => h.status === "Offer").length,
    rejected: history.filter((h) => h.status === "Rejected").length,
    ghosted: history.filter((h) => h.status === "Ghosted").length,
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Application History</h1>
              <p className="text-slate-400 text-sm mt-1">Track and manage your job applications</p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            <button
              onClick={() => setStatusFilter("all")}
              className={`p-4 rounded-xl border transition ${
                statusFilter === "all"
                  ? "bg-emerald-500/20 border-emerald-500/40"
                  : "bg-slate-900/60 border-slate-700/80 hover:border-slate-600"
              }`}
            >
              <p className="text-slate-400 text-xs uppercase tracking-wider">Total</p>
              <p className="text-white text-2xl font-bold mt-1">{stats.total}</p>
            </button>
            <button
              onClick={() => setStatusFilter("Applied")}
              className={`p-4 rounded-xl border transition ${
                statusFilter === "Applied"
                  ? "bg-blue-500/20 border-blue-500/40"
                  : "bg-slate-900/60 border-slate-700/80 hover:border-slate-600"
              }`}
            >
              <p className="text-blue-400 text-xs uppercase tracking-wider">Applied</p>
              <p className="text-white text-2xl font-bold mt-1">{stats.applied}</p>
            </button>
            <button
              onClick={() => setStatusFilter("Screening")}
              className={`p-4 rounded-xl border transition ${
                statusFilter === "Screening"
                  ? "bg-purple-500/20 border-purple-500/40"
                  : "bg-slate-900/60 border-slate-700/80 hover:border-slate-600"
              }`}
            >
              <p className="text-purple-400 text-xs uppercase tracking-wider">Screening</p>
              <p className="text-white text-2xl font-bold mt-1">{stats.screening}</p>
            </button>
            <button
              onClick={() => setStatusFilter("Interview")}
              className={`p-4 rounded-xl border transition ${
                statusFilter === "Interview"
                  ? "bg-amber-500/20 border-amber-500/40"
                  : "bg-slate-900/60 border-slate-700/80 hover:border-slate-600"
              }`}
            >
              <p className="text-amber-400 text-xs uppercase tracking-wider">Interview</p>
              <p className="text-white text-2xl font-bold mt-1">{stats.interview}</p>
            </button>
            <button
              onClick={() => setStatusFilter("Offer")}
              className={`p-4 rounded-xl border transition ${
                statusFilter === "Offer"
                  ? "bg-emerald-500/20 border-emerald-500/40"
                  : "bg-slate-900/60 border-slate-700/80 hover:border-slate-600"
              }`}
            >
              <p className="text-emerald-400 text-xs uppercase tracking-wider">Offer</p>
              <p className="text-white text-2xl font-bold mt-1">{stats.offer}</p>
            </button>
            <button
              onClick={() => setStatusFilter("Rejected")}
              className={`p-4 rounded-xl border transition ${
                statusFilter === "Rejected"
                  ? "bg-red-500/20 border-red-500/40"
                  : "bg-slate-900/60 border-slate-700/80 hover:border-slate-600"
              }`}
            >
              <p className="text-red-400 text-xs uppercase tracking-wider">Rejected</p>
              <p className="text-white text-2xl font-bold mt-1">{stats.rejected}</p>
            </button>
            <button
              onClick={() => setStatusFilter("Ghosted")}
              className={`p-4 rounded-xl border transition ${
                statusFilter === "Ghosted"
                  ? "bg-slate-500/20 border-slate-500/40"
                  : "bg-slate-900/60 border-slate-700/80 hover:border-slate-600"
              }`}
            >
              <p className="text-slate-400 text-xs uppercase tracking-wider">Ghosted</p>
              <p className="text-white text-2xl font-bold mt-1">{stats.ghosted}</p>
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/50 overflow-hidden">
              <div className="animate-pulse divide-y divide-slate-700/50">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-5 flex gap-4">
                    <div className="h-5 flex-1 rounded bg-slate-700/50" />
                    <div className="h-5 w-24 rounded bg-slate-700/50" />
                    <div className="h-5 w-20 rounded bg-slate-700/50" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/50 overflow-hidden shadow-xl shadow-black/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-800/80 border-b border-slate-700">
                      <th className="p-4 text-slate-300 font-semibold text-sm">Job Title</th>
                      <th className="p-4 text-slate-300 font-semibold text-sm">Company</th>
                      <th className="p-4 text-slate-300 font-semibold text-sm">Platform</th>
                      <th className="p-4 text-slate-300 font-semibold text-sm">Status</th>
                      <th className="p-4 text-slate-300 font-semibold text-sm">Date</th>
                      <th className="p-4 text-slate-300 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-16 text-center">
                          <p className="text-slate-500 mb-4">
                            {statusFilter === "all" 
                              ? "No applications yet." 
                              : `No applications with status "${statusFilter}".`}
                          </p>
                          <Link
                            href="/dashboard"
                            className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-500 transition"
                          >
                            Go to Dashboard
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((row) => {
                        const colors = statusColors[row.status] || statusColors.Applied;
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-slate-700/50 hover:bg-slate-800/30 transition"
                          >
                            <td className="p-4">
                              <button
                                onClick={() => setSelectedJob(row)}
                                className="font-medium text-white hover:text-emerald-400 text-left transition"
                              >
                                {row.job_title}
                              </button>
                            </td>
                            <td className="p-4 text-slate-300">{row.company}</td>
                            <td className="p-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                                {row.platform}
                              </span>
                            </td>
                            <td className="p-4">
                              <select
                                value={row.status}
                                onChange={(e) => handleStatusChange(row.id, e.target.value)}
                                disabled={updatingId === row.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border} cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500`}
                              >
                                {APPLICATION_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-4 text-slate-400 text-sm">
                              {row.applied_date
                                ? new Date(row.applied_date).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <a
                                  href={row.job_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => setSelectedJob(row)}
                                  className="text-slate-400 hover:text-white text-sm font-medium"
                                >
                                  Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* Job Details Modal */}
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedJob(null)}
            />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
              <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedJob.job_title}</h2>
                  <p className="text-slate-400 mt-1">{selectedJob.company}</p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-2 text-slate-400 hover:text-white transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Status Section */}
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Status</label>
                  <select
                    value={selectedJob.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      handleStatusChange(selectedJob.id, newStatus);
                      setSelectedJob({ ...selectedJob, status: newStatus });
                    }}
                    className={`w-full px-4 py-3 rounded-xl border bg-slate-800 text-white focus:ring-2 focus:ring-emerald-500 outline-none ${
                      statusColors[selectedJob.status]?.border || "border-slate-600"
                    }`}
                  >
                    {APPLICATION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Platform</p>
                    <p className="text-white font-medium mt-1">{selectedJob.platform}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Applied Date</p>
                    <p className="text-white font-medium mt-1">
                      {selectedJob.applied_date 
                        ? new Date(selectedJob.applied_date).toLocaleDateString() 
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Job Link */}
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Job Link</label>
                  <a
                    href={selectedJob.job_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 transition break-all"
                  >
                    {selectedJob.job_link}
                  </a>
                </div>

                {/* Job Description */}
                {selectedJob.job_description && (
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Job Description</label>
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 max-h-60 overflow-y-auto">
                      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedJob.job_description}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-4 flex gap-3 justify-end">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                >
                  Close
                </button>
                <a
                  href={selectedJob.job_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition"
                >
                  Apply / View Job
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}

