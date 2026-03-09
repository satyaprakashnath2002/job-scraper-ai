"use client";

import { useState, useMemo } from "react";
import { Job } from "@/types";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface JobTableProps {
  jobs: Job[];
}

export default function JobTable({ jobs }: JobTableProps) {
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const { showToast } = useToast();

  const handleApply = async (job: Job, index: number) => {
    window.open(job.link, "_blank");
    setApplyingId(index);
    try {
      await fetchApi("/apply", {
        method: "POST",
        body: JSON.stringify({
          job_title: job.title,
          company: job.company,
          platform: job.platform,
          job_link: job.link,
        }),
      });
      showToast("Job application saved!", "success");
    } catch {
      showToast("Failed to save application", "error");
    } finally {
      setApplyingId(null);
    }
  };

  const exportToCSV = () => {
    const headers = ["Job Title", "Company", "Location", "Platform", "Job Link"];
    const csvContent = [
      headers.join(","),
      ...filteredJobs.map((job) =>
        [job.title, job.company, job.location, job.platform, job.link]
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `jobs_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    showToast("Jobs exported to CSV!", "success");
  };

  // Get unique platforms for filter
  const platforms = useMemo(() => {
    const allPlatforms = jobs.map((j) => j.platform);
    return ["all", ...new Set(allPlatforms)];
  }, [jobs]);

  // Filter jobs based on search and platform
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        searchTerm === "" ||
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlatform = platformFilter === "all" || job.platform === platformFilter;
      return matchesSearch && matchesPlatform;
    });
  }, [jobs, searchTerm, platformFilter]);

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-900/50">
      {/* Filter Bar */}
      <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
        >
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "All Platforms" : p}
            </option>
          ))}
        </select>
        <button
          onClick={exportToCSV}
          disabled={filteredJobs.length === 0}
          className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 disabled:opacity-50 transition flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
      </div>

      {/* Results count */}
      <div className="px-4 py-2 bg-slate-800/30 border-b border-slate-700">
        <p className="text-sm text-slate-400">
          Showing {filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"}
          {searchTerm || platformFilter !== "all" ? " (filtered)" : ""}
        </p>
      </div>

      {/* Desktop Table View - hidden on mobile */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700">
              <th className="p-4 text-slate-300 font-semibold text-sm">Job Title</th>
              <th className="p-4 text-slate-300 font-semibold text-sm">Company</th>
              <th className="p-4 text-slate-300 font-semibold text-sm">Location</th>
              <th className="p-4 text-slate-300 font-semibold text-sm">Platform</th>
              <th className="p-4 text-slate-300 font-semibold text-sm">Job Link</th>
              <th className="p-4 text-slate-300 font-semibold text-sm">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-500">
                  {jobs.length === 0
                    ? "No jobs yet. Enter a keyword and location, then click Scrape Jobs."
                    : "No jobs match your search criteria."}
                </td>
              </tr>
            ) : (
              filteredJobs.map((job, index) => (
                <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition">
                  <td className="p-4 font-medium text-white">{job.title}</td>
                  <td className="p-4 text-slate-300">{job.company}</td>
                  <td className="p-4 text-slate-400">{job.location}</td>
                  <td className="p-4">
                    <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                      {job.platform}
                    </span>
                  </td>
                  <td className="p-4">
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline text-sm truncate max-w-[180px] block"
                    >
                      View job
                    </a>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleApply(job, index)}
                      disabled={applyingId === index}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition"
                    >
                      {applyingId === index ? "Saved" : "Apply"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - visible only on mobile */}
      <div className="md:hidden">
        {filteredJobs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {jobs.length === 0
              ? "No jobs yet. Enter a keyword and location, then click Scrape Jobs."
              : "No jobs match your search criteria."}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {filteredJobs.map((job, index) => (
              <div key={index} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-white text-sm leading-tight">{job.title}</h3>
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                    {job.platform}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-slate-300">{job.company}</div>
                  <div className="text-sm text-slate-400">{job.location}</div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={job.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center px-3 py-2 rounded-lg bg-slate-800 text-emerald-400 text-sm font-medium hover:bg-slate-700 transition"
                  >
                    View Job
                  </a>
                  <button
                    onClick={() => handleApply(job, index)}
                    disabled={applyingId === index}
                    className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition"
                  >
                    {applyingId === index ? "Saved" : "Apply"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
