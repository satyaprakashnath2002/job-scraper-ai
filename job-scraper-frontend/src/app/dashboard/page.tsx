"use client";

import { useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import JobTable from "@/components/JobTable";
import { Job } from "@/types";
import { fetchApi } from "@/lib/api";

export default function DashboardPage() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleScrape = async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ keyword, location });
      const data = await fetchApi<{ results: Job[] }>(`/scrape-jobs?${params}`);
      setJobs(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scraping failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">
          <h1 className="text-2xl font-bold text-white mb-6">Scrape jobs</h1>
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 mb-6 flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Job keyword (e.g. SDE, React)"
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <input
              type="text"
              placeholder="Location"
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <button
              onClick={handleScrape}
              disabled={loading}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500 disabled:opacity-50 transition shrink-0"
            >
              {loading ? "Scraping…" : "Scrape Jobs"}
            </button>
          </div>
          {error && (
            <p className="mb-4 text-amber-400 text-sm">{error}</p>
          )}
          <JobTable jobs={jobs} />
        </main>
      </div>
    </RequireAuth>
  );
}
