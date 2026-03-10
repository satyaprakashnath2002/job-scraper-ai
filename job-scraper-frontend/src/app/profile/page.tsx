"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import RequireAuth from "@/components/RequireAuth";
import Navbar from "@/components/Navbar";
import { fetchApi, uploadProfileImage, getProfileImageUrl, uploadResume, getResumeUrl, deleteResume, deleteProfileImage } from "@/lib/api";
import type { ApplicationHistoryItem, UserProfile } from "@/types";
import { useToast } from "@/components/Toast";

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [draftFullName, setDraftFullName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState<null | "name" | "upload" | "delete-image" | "bio" | "skills" | "resume">(null);
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [platformStats, setPlatformStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Edit states for bio and skills
  const [bio, setBio] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [skills, setSkills] = useState("");
  const [draftSkills, setDraftSkills] = useState("");
  const [editingSkills, setEditingSkills] = useState(false);

  // Calculate profile completion
  const profileCompletion = useMemo(() => {
    if (!user) return 0;
    let score = 0;
    const total = 5;
    if (user.full_name) score++;
    if (user.profile_image) score++;
    if (user.bio) score++;
    if (user.skills) score++;
    if (user.resume) score++;
    return Math.round((score / total) * 100);
  }, [user]);

  useEffect(() => {
    const load = async () => {
      try {
        const [profile, history] = await Promise.all([
          fetchApi<UserProfile>("/profile"),
          fetchApi<ApplicationHistoryItem[]>("/applications/history").catch(() => []),
        ]);
        setUser(profile);
        const name = profile.full_name ?? "";
        setFullName(name);
        setDraftFullName(name);
        
        // Set bio and skills
        const userBio = profile.bio ?? "";
        setBio(userBio);
        setDraftBio(userBio);
        const userSkills = profile.skills ?? "";
        setSkills(userSkills);
        setDraftSkills(userSkills);

        if (Array.isArray(history)) {
          setApplicationCount(history.length);
          const dates = history
            .map((h) => h.applied_date)
            .filter(Boolean)
            .map((d) => new Date(d));
          setLastApplied(dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : null);
          
          // Calculate platform stats
          const platforms: Record<string, number> = {};
          history.forEach((h) => {
            const platform = h.platform || "Unknown";
            platforms[platform] = (platforms[platform] || 0) + 1;
          });
          setPlatformStats(platforms);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveName = async () => {
    setMessage("");
    setError("");
    try {
      setSaving("name");
      await fetchApi("/profile/update", {
        method: "PUT",
        body: JSON.stringify({ full_name: draftFullName.trim() }),
      });
      const newName = draftFullName.trim();
      setFullName(newName);
      setUser((u) => (u ? { ...u, full_name: newName } : null));
      setEditingName(false);
      showToast("Name updated successfully!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
      showToast("Failed to update name", "error");
    } finally {
      setSaving(null);
    }
  };

  const saveBio = async () => {
    setMessage("");
    setError("");
    try {
      setSaving("bio");
      await fetchApi("/profile/update", {
        method: "PUT",
        body: JSON.stringify({ bio: draftBio.trim() }),
      });
      const newBio = draftBio.trim();
      setBio(newBio);
      setUser((u) => (u ? { ...u, bio: newBio } : null));
      setEditingBio(false);
      showToast("Bio updated successfully!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
      showToast("Failed to update bio", "error");
    } finally {
      setSaving(null);
    }
  };

  const saveSkills = async () => {
    setMessage("");
    setError("");
    try {
      setSaving("skills");
      await fetchApi("/profile/update", {
        method: "PUT",
        body: JSON.stringify({ skills: draftSkills.trim() }),
      });
      const newSkills = draftSkills.trim();
      setSkills(newSkills);
      setUser((u) => (u ? { ...u, skills: newSkills } : null));
      setEditingSkills(false);
      showToast("Skills updated successfully!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
      showToast("Failed to update skills", "error");
    } finally {
      setSaving(null);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setMessage("");
    setError("");
    try {
      setSaving("upload");
      const { profile_image } = await uploadProfileImage(file);
      setUser((u) => (u ? { ...u, profile_image } : null));
      showToast("Profile photo updated!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      showToast("Failed to upload photo", "error");
    } finally {
      setSaving(null);
      e.target.value = "";
    }
  };

  const onResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage("");
    setError("");
    try {
      setSaving("resume");
      const { resume } = await uploadResume(file);
      setUser((u) => (u ? { ...u, resume } : null));
      showToast("Resume uploaded successfully!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      showToast("Failed to upload resume", "error");
    } finally {
      setSaving(null);
      e.target.value = "";
    }
  };

  const deleteImage = async () => {
    setMessage("");
    setError("");
    try {
      setSaving("delete-image");
      await deleteProfileImage();
      setUser((u) => (u ? { ...u, profile_image: null } : null));
      showToast("Profile photo removed", "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove photo.");
      showToast("Failed to remove photo", "error");
    } finally {
      setSaving(null);
    }
  };

  const removeResume = async () => {
    setMessage("");
    setError("");
    try {
      setSaving("resume");
      await deleteResume();
      setUser((u) => (u ? { ...u, resume: null } : null));
      showToast("Resume removed", "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove resume.");
      showToast("Failed to remove resume", "error");
    } finally {
      setSaving(null);
    }
  };

  const initials = user ? (user.full_name || user.email)[0].toUpperCase() : "?";
  const avatarUrl = user ? getProfileImageUrl(user.profile_image) : null;
  const resumeUrl = user ? getResumeUrl(user.resume) : null;

  const skillList = skills ? skills.split(",").map(s => s.trim()).filter(Boolean) : [];

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-white mb-6">Profile</h1>
          
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-24 rounded-xl bg-slate-800" />
              <div className="h-32 rounded-xl bg-slate-800" />
              <div className="h-24 rounded-xl bg-slate-800" />
            </div>
          ) : user ? (
            <div className="space-y-6">
              {(message || error) && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    error
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {error || message}
                </div>
              )}

              {/* Profile Completion Card */}
              <div className="bg-gradient-to-r from-slate-900/80 to-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-white font-semibold">Profile Completion</h2>
                  <span className={`text-2xl font-bold ${
                    profileCompletion === 100 ? "text-emerald-400" : 
                    profileCompletion >= 60 ? "text-amber-400" : "text-slate-400"
                  }`}>
                    {profileCompletion}%
                  </span>
                </div>
                <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      profileCompletion === 100 ? "bg-emerald-500" : 
                      profileCompletion >= 60 ? "bg-amber-500" : "bg-slate-500"
                    }`}
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    { label: "Name", filled: !!user.full_name },
                    { label: "Photo", filled: !!user.profile_image },
                    { label: "Bio", filled: !!user.bio },
                    { label: "Skills", filled: !!user.skills },
                    { label: "Resume", filled: !!user.resume },
                  ].map((item) => (
                    <span 
                      key={item.label}
                      className={`text-xs px-2 py-1 rounded-full ${
                        item.filled 
                          ? "bg-emerald-500/20 text-emerald-300" 
                          : "bg-slate-700/50 text-slate-400"
                      }`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Main Profile Card */}
              <div className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-6 shadow-lg shadow-black/20">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={onFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving === "upload"}
                    className="relative group shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-full"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="w-28 h-28 rounded-full object-cover border-3 border-slate-600 group-hover:border-emerald-500/50 transition shadow-lg"
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border-3 border-slate-500 flex items-center justify-center text-slate-200 text-4xl font-bold group-hover:border-emerald-500/50 transition shadow-lg">
                        {initials}
                      </div>
                    )}
                    <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm font-medium">
                      {saving === "upload" ? "Uploading…" : "Change photo"}
                    </span>
                  </button>
                  <div className="flex-1 text-center sm:text-left min-w-0">
                    <p className="text-white font-semibold text-xl truncate">
                      {fullName || "Unnamed user"}
                    </p>
                    <p className="text-slate-400 text-sm truncate mt-0.5">{user.email}</p>
                    <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving === "upload"}
                        className="px-3 py-1.5 text-sm bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition disabled:opacity-50"
                      >
                        {saving === "upload" ? "Uploading…" : "Upload photo"}
                      </button>
                      {user.profile_image && (
                        <button
                          type="button"
                          onClick={deleteImage}
                          disabled={saving === "delete-image"}
                          className="px-3 py-1.5 text-sm border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/10 transition disabled:opacity-50"
                        >
                          {saving === "delete-image" ? "Removing…" : "Remove photo"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-700/60">
                  <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3 text-center">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Applications</p>
                    <p className="text-white text-xl font-semibold mt-1">
                      {applicationCount ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3 text-center">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Last Applied</p>
                    <p className="text-white text-sm font-medium mt-1">
                      {lastApplied ? new Date(lastApplied).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3 text-center">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Profile</p>
                    <p className="text-white text-xl font-semibold mt-1">
                      {profileCompletion}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3 text-center">
                    <p className="text-slate-400 text-xs uppercase tracking-wider">Skills</p>
                    <p className="text-white text-xl font-semibold mt-1">
                      {skillList.length}
                    </p>
                  </div>
                </div>

                {/* Platform Stats */}
                {Object.keys(platformStats).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700/60">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Applications by Platform</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(platformStats).map(([platform, count]) => (
                        <span 
                          key={platform}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-300"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {platform}: <span className="text-white font-medium">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bio Section */}
              <div className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-6 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    About Me
                  </h2>
                  {!editingBio && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftBio(bio);
                        setEditingBio(true);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                    >
                      {bio ? "Edit" : "Add"}
                    </button>
                  )}
                </div>
                {editingBio ? (
                  <div className="space-y-3">
                    <textarea
                      value={draftBio}
                      onChange={(e) => setDraftBio(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                      placeholder="Tell us about yourself..."
                      rows={3}
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={saveBio}
                        disabled={saving === "bio"}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-500 transition disabled:opacity-50"
                      >
                        {saving === "bio" ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftBio(bio);
                          setEditingBio(false);
                        }}
                        className="px-4 py-2 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-800 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-300 leading-relaxed">
                    {bio || <span className="text-slate-500 italic">Add a short bio to help others know you better.</span>}
                  </p>
                )}
              </div>

              {/* Skills Section */}
              <div className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-6 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Skills
                  </h2>
                  {!editingSkills && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftSkills(skills);
                        setEditingSkills(true);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                    >
                      {skills ? "Edit" : "Add"}
                    </button>
                  )}
                </div>
                {editingSkills ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={draftSkills}
                      onChange={(e) => setDraftSkills(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="JavaScript, Python, React, Node.js..."
                    />
                    <p className="text-slate-500 text-xs">Separate skills with commas</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={saveSkills}
                        disabled={saving === "skills"}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-500 transition disabled:opacity-50"
                      >
                        {saving === "skills" ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftSkills(skills);
                          setEditingSkills(false);
                        }}
                        className="px-4 py-2 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-800 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : skillList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {skillList.map((skill, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-300 text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Add your skills to improve job matching with AI tools.</p>
                )}
              </div>

              {/* Resume Section */}
              <div className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-6 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Resume
                  </h2>
                </div>
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={onResumeChange}
                />
                {user.resume ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                      <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2 2 0 002-2h12a2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">Resume uploaded</p>
                        <p className="text-slate-400 text-sm">PDF, DOC, DOCX, or TXT</p>
                      </div>
                      <a
                        href={resumeUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition"
                      >
                        View
                      </a>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => resumeInputRef.current?.click()}
                        disabled={saving === "resume"}
                        className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm hover:bg-slate-600 transition disabled:opacity-50"
                      >
                        {saving === "resume" ? "Uploading…" : "Upload new"}
                      </button>
                      <button
                        type="button"
                        onClick={removeResume}
                        disabled={saving === "resume"}
                        className="px-4 py-2 border border-red-500/40 text-red-400 rounded-lg text-sm hover:bg-red-500/10 transition disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div 
                      className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-slate-500 transition cursor-pointer"
                      onClick={() => resumeInputRef.current?.click()}
                    >
                      <svg className="w-10 h-10 mx-auto text-slate-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-slate-300 font-medium">Upload your resume</p>
                      <p className="text-slate-500 text-sm mt-1">PDF, DOC, DOCX, or TXT (max 10MB)</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Details Section */}
              <div className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-6 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-white font-semibold">Profile Details</h2>
                  {!editingName && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftFullName(fullName);
                        setEditingName(true);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <label className="block text-slate-400 text-sm mb-1">Full name</label>
                {editingName ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={draftFullName}
                      onChange={(e) => setDraftFullName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Your name"
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={saveName}
                        disabled={saving === "name" || draftFullName.trim() === fullName}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-500 transition disabled:opacity-50"
                      >
                        {saving === "name" ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftFullName(fullName);
                          setEditingName(false);
                        }}
                        className="px-4 py-2 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-800 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-white">{fullName || "—"}</p>
                )}
                
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <label className="block text-slate-400 text-sm mb-1">Email</label>
                  <p className="text-white">{user.email}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Could not load profile.</p>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}
