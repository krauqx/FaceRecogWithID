import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const MAX_BYTES = 500 * 1024;

function isValidYear(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 2000 && n <= 2099;
}

export default function Registration() {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState(""); // canonical digits: YY4#### (7 digits)
  const [displayId, setDisplayId] = useState(""); // YY-4-####
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const canGenerateId = useMemo(() => isValidYear(year), [year]);

  const onPickPhoto = (file) => {
    setMsg({ type: "", text: "" });
    setPhoto(null);
    setPreviewUrl("");

    if (!file) return;

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setMsg({ type: "error", text: "Photo must be JPEG, PNG, or WebP." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMsg({ type: "error", text: "Photo is too large. Max size is 500KB." });
      return;
    }

    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const generateId = async () => {
    setMsg({ type: "", text: "" });

    if (!canGenerateId) {
      setMsg({ type: "error", text: "Enter a valid 4-digit year (2000–2099) first." });
      return;
    }

    try {
      setBusy(true);
      const res = await fetch("/api/students/generate-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: Number(year) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to generate ID.");

      setStudentId(data.id);
      setDisplayId(data.displayId);
      setMsg({ type: "success", text: `Generated ID: ${data.displayId}` });
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    if (!name || !department || !year || !email) {
      setMsg({ type: "error", text: "Please complete all fields." });
      return;
    }
    if (!isValidYear(year)) {
      setMsg({ type: "error", text: "Year must be a 4-digit year (2000–2099)." });
      return;
    }
    if (!studentId) {
      setMsg({ type: "error", text: "Generate an ID first." });
      return;
    }
    if (!photo) {
      setMsg({ type: "error", text: "Please upload a 1x1 face photo (max 500KB)." });
      return;
    }

    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("name", name);
      fd.append("department", department);
      fd.append("year", String(year));
      fd.append("email", email);
      fd.append("id", studentId); // canonical digits
      fd.append("photo", photo);

      const res = await fetch("/api/students/register", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Registration failed.");

      setMsg({
        type: "success",
        text: `Registered: ${data.student.name} (${data.student.displayId ?? data.student.id})`,
      });

      // Reset form except message
      setName("");
      setDepartment("");
      setYear("");
      setEmail("");
      setStudentId("");
      setDisplayId("");
      setPhoto(null);
      setPreviewUrl("");
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-slate-900/40 border border-slate-700 rounded-2xl p-6 shadow">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold">Student Registration</h1>
          <Link
            to="/"
            className="text-sm px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            Back to Verification
          </Link>
        </div>

        <p className="text-slate-300 text-sm mb-6">
          Fill out the details and upload a clear 1x1 face photo (JPEG/PNG/WebP, max 500KB).
        </p>

        {msg.text && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm border ${
              msg.type === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-200">Full name</label>
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 outline-none focus:border-slate-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Dela Cruz"
            />
          </div>

          <div>
            <label className="text-sm text-slate-200">Department</label>
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 outline-none focus:border-slate-500"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="CCICT"
            />
          </div>

          <div>
            <label className="text-sm text-slate-200">Year (YYYY)</label>
            <div className="mt-1 flex gap-2">
              <input
                className="flex-1 rounded-lg bg-slate-950 border border-slate-700 p-3 outline-none focus:border-slate-500"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2026"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={generateId}
                disabled={!canGenerateId || busy}
                className="px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Generate ID
              </button>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              ID format shown as <b>YY-4-IDNo</b>, stored as digits for OCR scanning.
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-200">Student ID</label>
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-slate-200"
              value={displayId || studentId}
              readOnly
              placeholder="Generate to fill"
            />
          </div>

          <div>
            <label className="text-sm text-slate-200">Email</label>
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3 outline-none focus:border-slate-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              type="email"
            />
          </div>

          <div>
            <label className="text-sm text-slate-200">1x1 Face Photo (max 500KB)</label>
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onPickPhoto(e.target.files?.[0])}
            />
            {previewUrl && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={previewUrl}
                  alt="preview"
                  className="w-20 h-20 object-cover rounded-lg border border-slate-700"
                />
                <div className="text-xs text-slate-300">
                  Make sure the face is centered, well-lit, and unobstructed.
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
          >
            {busy ? "Working..." : "Register Student"}
          </button>
        </form>
      </div>
    </div>
  );
}