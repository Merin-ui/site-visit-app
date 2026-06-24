import { useState, useCallback } from "react";

// ─── Default Checkpoint Categories ───────────────────────────────────────────
const DEFAULT_CHECKPOINTS = [
  {
    id: "cp1",
    category: "Safety",
    items: [
      { id: "cp1-1", label: "PPE available and in use" },
      { id: "cp1-2", label: "Emergency exits clearly marked" },
      { id: "cp1-3", label: "First aid kit accessible" },
      { id: "cp1-4", label: "Fire extinguishers in place" },
    ],
  },
  {
    id: "cp2",
    category: "Structural",
    items: [
      { id: "cp2-1", label: "Foundation integrity" },
      { id: "cp2-2", label: "Roof and ceilings — no damage/leaks" },
      { id: "cp2-3", label: "Walls and floors — no cracks/hazards" },
      { id: "cp2-4", label: "Doors and windows functional" },
    ],
  },
  {
    id: "cp3",
    category: "Electrical & Plumbing",
    items: [
      { id: "cp3-1", label: "Electrical panels labelled and accessible" },
      { id: "cp3-2", label: "No exposed wiring" },
      { id: "cp3-3", label: "Water supply functional" },
      { id: "cp3-4", label: "Drainage/sewage — no blockages" },
    ],
  },
  {
    id: "cp4",
    category: "Compliance",
    items: [
      { id: "cp4-1", label: "Permits displayed on site" },
      { id: "cp4-2", label: "Site boundaries respected" },
      { id: "cp4-3", label: "Waste disposal adequate" },
      { id: "cp4-4", label: "Noise/vibration within limits" },
    ],
  },
];

const STATUS_CONFIG = {
  pass: { label: "Pass", color: "#16a34a", bg: "#dcfce7", border: "#bbf7d0" },
  fail: { label: "Fail", color: "#dc2626", bg: "#fee2e2", border: "#fecaca" },
  flag: { label: "Flag", color: "#d97706", bg: "#fef3c7", border: "#fde68a" },
  na:   { label: "N/A",  color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
};

// ─── XLSX Export ──────────────────────────────────────────────────────────────
function exportToExcel(visit, checkpoints, observations) {
  // Build CSV content that Excel can open
  const rows = [];
  rows.push(["SITE VISIT REPORT"]);
  rows.push(["Site Name", visit.siteName]);
  rows.push(["Inspector", visit.inspector]);
  rows.push(["Date", visit.date]);
  rows.push(["Location", visit.location]);
  rows.push(["Weather", visit.weather]);
  rows.push([]);

  rows.push(["── CHECKPOINT RESULTS ──"]);
  rows.push(["Category", "Checkpoint", "Status", "Notes"]);
  checkpoints.forEach((cat) =>
    cat.items.forEach((item) => {
      const key = item.id;
      const result = visit.checkResults?.[key] || {};
      rows.push([cat.category, item.label, result.status?.toUpperCase() || "NOT CHECKED", result.note || ""]);
    })
  );

  rows.push([]);
  rows.push(["── OBSERVATIONS / NOTES ──"]);
  rows.push(["Time", "Type", "Priority", "Description", "Location"]);
  observations.forEach((o) => {
    rows.push([o.time, o.type, o.priority, o.description, o.location || ""]);
  });

  // Stats
  const allResults = checkpoints.flatMap((c) => c.items.map((i) => visit.checkResults?.[i.id]?.status));
  const counts = { pass: 0, fail: 0, flag: 0, na: 0, unchecked: 0 };
  allResults.forEach((s) => { if (s) counts[s]++; else counts.unchecked++; });
  const total = allResults.length;

  rows.push([]);
  rows.push(["── SUMMARY ──"]);
  rows.push(["Total Checkpoints", total]);
  rows.push(["Pass", counts.pass]);
  rows.push(["Fail", counts.fail]);
  rows.push(["Flagged", counts.flag]);
  rows.push(["N/A", counts.na]);
  rows.push(["Not Checked", counts.unchecked]);
  rows.push(["Observations Logged", observations.length]);

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `site-visit-${visit.siteName || "report"}-${visit.date || "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ status }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      letterSpacing: "0.05em",
    }}>{cfg.label}</span>
  );
}

function PriorityDot({ priority }) {
  const colors = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };
  return (
    <span style={{
      width: 8, height: 8, borderRadius: "50%", background: colors[priority] || "#9ca3af",
      display: "inline-block", marginRight: 6, flexShrink: 0,
    }} />
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: "14px 18px", minWidth: 90, textAlign: "center",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, fontWeight: 600, letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SiteVisitDashboard() {
  const today = new Date().toISOString().split("T")[0];

  const [tab, setTab] = useState("overview"); // overview | checkpoints | observations | export
  const [visit, setVisit] = useState({
    siteName: "", inspector: "", date: today, location: "", weather: "",
    checkResults: {}, // { [itemId]: { status, note } }
  });
  const [observations, setObservations] = useState([]);
  const [checkpoints] = useState(DEFAULT_CHECKPOINTS);
  const [newObs, setNewObs] = useState({
    type: "general", priority: "medium", description: "", location: "",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });
  const [expandedCp, setExpandedCp] = useState(null);
  const [cpNoteOpen, setCpNoteOpen] = useState(null);

  // ── Derived stats ────────────────────────────────────────────────────────
  const allItems = checkpoints.flatMap((c) => c.items);
  const total = allItems.length;
  const counts = { pass: 0, fail: 0, flag: 0, na: 0 };
  allItems.forEach((i) => {
    const s = visit.checkResults[i.id]?.status;
    if (s) counts[s]++;
  });
  const checked = counts.pass + counts.fail + counts.flag + counts.na;
  const progress = Math.round((checked / total) * 100);

  const setCheckResult = useCallback((itemId, status) => {
    setVisit((v) => ({
      ...v,
      checkResults: {
        ...v.checkResults,
        [itemId]: { ...v.checkResults[itemId], status },
      },
    }));
  }, []);

  const setCheckNote = useCallback((itemId, note) => {
    setVisit((v) => ({
      ...v,
      checkResults: {
        ...v.checkResults,
        [itemId]: { ...v.checkResults[itemId], note },
      },
    }));
  }, []);

  const addObservation = () => {
    if (!newObs.description.trim()) return;
    setObservations((prev) => [
      { ...newObs, id: Date.now(), time: newObs.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ...prev,
    ]);
    setNewObs((o) => ({ ...o, description: "", location: "" }));
  };

  const removeObservation = (id) => setObservations((prev) => prev.filter((o) => o.id !== id));

  // ── Styles ───────────────────────────────────────────────────────────────
  const S = {
    app: {
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      background: "#f8fafc", minHeight: "100vh", color: "#111827",
    },
    header: {
      background: "#0f172a", color: "#fff", padding: "16px 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    },
    headerTitle: { fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 },
    headerSub: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
    nav: {
      background: "#fff", borderBottom: "1px solid #e5e7eb",
      display: "flex", padding: "0 24px", gap: 0,
    },
    navBtn: (active) => ({
      padding: "12px 18px", fontSize: 13, fontWeight: 600, border: "none",
      background: "none", cursor: "pointer", borderBottom: active ? "2px solid #0ea5e9" : "2px solid transparent",
      color: active ? "#0ea5e9" : "#6b7280", transition: "all 0.15s",
    }),
    body: { padding: "24px", maxWidth: 900, margin: "0 auto" },
    card: {
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: 20, marginBottom: 16,
    },
    sectionTitle: { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 14, letterSpacing: "0.01em" },
    input: {
      border: "1px solid #d1d5db", borderRadius: 7, padding: "8px 12px",
      fontSize: 13, color: "#111827", width: "100%", boxSizing: "border-box",
      outline: "none", fontFamily: "inherit",
    },
    label: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
    btn: (color, bg, border) => ({
      border: `1px solid ${border || bg}`, borderRadius: 7, padding: "8px 16px",
      fontSize: 13, fontWeight: 600, cursor: "pointer", background: bg, color,
      transition: "opacity 0.15s", fontFamily: "inherit",
    }),
    statusRow: { display: "flex", gap: 6, flexWrap: "wrap" },
    statusBtn: (active, status) => {
      const cfg = STATUS_CONFIG[status];
      return {
        border: `1.5px solid ${active ? cfg.color : "#d1d5db"}`,
        borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700,
        cursor: "pointer", background: active ? cfg.bg : "#fff",
        color: active ? cfg.color : "#6b7280", transition: "all 0.1s",
      };
    },
  };

  // ── TAB: Overview ─────────────────────────────────────────────────────────
  const OverviewTab = () => (
    <div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Visit Details</div>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Site Name</label>
            <input style={S.input} placeholder="e.g. Building A — Floor 3" value={visit.siteName}
              onChange={(e) => setVisit((v) => ({ ...v, siteName: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Inspector Name</label>
            <input style={S.input} placeholder="Your name" value={visit.inspector}
              onChange={(e) => setVisit((v) => ({ ...v, inspector: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Date</label>
            <input style={S.input} type="date" value={visit.date}
              onChange={(e) => setVisit((v) => ({ ...v, date: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Location / Address</label>
            <input style={S.input} placeholder="123 Main St" value={visit.location}
              onChange={(e) => setVisit((v) => ({ ...v, location: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Weather Conditions</label>
            <input style={S.input} placeholder="e.g. Clear, 22°C" value={visit.weather}
              onChange={(e) => setVisit((v) => ({ ...v, weather: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Progress + Stats */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Inspection Progress</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            <span>{checked} of {total} checkpoints reviewed</span>
            <span style={{ fontWeight: 700, color: "#0ea5e9" }}>{progress}%</span>
          </div>
          <div style={{ height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#0ea5e9,#38bdf8)", borderRadius: 99, transition: "width 0.4s" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <StatCard label="PASS" value={counts.pass} color="#16a34a" />
          <StatCard label="FAIL" value={counts.fail} color="#dc2626" />
          <StatCard label="FLAGGED" value={counts.flag} color="#d97706" />
          <StatCard label="N/A" value={counts.na} color="#6b7280" />
          <StatCard label="OBSERVATIONS" value={observations.length} color="#0ea5e9" />
        </div>
      </div>

      {/* Quick issues */}
      {(counts.fail > 0 || counts.flag > 0) && (
        <div style={{ ...S.card, borderLeft: "4px solid #dc2626" }}>
          <div style={S.sectionTitle}>⚠ Items Needing Attention</div>
          {checkpoints.flatMap((c) =>
            c.items
              .filter((i) => ["fail", "flag"].includes(visit.checkResults[i.id]?.status))
              .map((i) => (
                <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Badge status={visit.checkResults[i.id].status} />
                  <span style={{ fontSize: 13, color: "#374151" }}>{c.category} — {i.label}</span>
                  {visit.checkResults[i.id].note && (
                    <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>{visit.checkResults[i.id].note}</span>
                  )}
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );

  // ── TAB: Checkpoints ──────────────────────────────────────────────────────
  const CheckpointsTab = () => (
    <div>
      {checkpoints.map((cat) => {
        const catItems = cat.items;
        const catCounts = { pass: 0, fail: 0, flag: 0, na: 0 };
        catItems.forEach((i) => { const s = visit.checkResults[i.id]?.status; if (s) catCounts[s]++; });
        const isOpen = expandedCp === cat.id || expandedCp === null;

        return (
          <div key={cat.id} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            {/* Category header */}
            <div
              onClick={() => setExpandedCp(expandedCp === cat.id ? null : cat.id)}
              style={{
                padding: "14px 20px", display: "flex", alignItems: "center",
                justifyContent: "space-between", cursor: "pointer",
                background: expandedCp === cat.id ? "#f8fafc" : "#fff",
                borderBottom: isOpen ? "1px solid #e5e7eb" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{cat.category}</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{catItems.length} items</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {catCounts.pass > 0 && <Badge status="pass" />}
                {catCounts.flag > 0 && <Badge status="flag" />}
                {catCounts.fail > 0 && <Badge status="fail" />}
                <span style={{ color: "#9ca3af", marginLeft: 4 }}>{expandedCp === cat.id ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Items */}
            {(expandedCp === cat.id || expandedCp === null) && (
              <div>
                {catItems.map((item, idx) => {
                  const result = visit.checkResults[item.id] || {};
                  const noteOpen = cpNoteOpen === item.id;
                  return (
                    <div key={item.id} style={{
                      padding: "14px 20px",
                      borderBottom: idx < catItems.length - 1 ? "1px solid #f3f4f6" : "none",
                      background: result.status === "fail" ? "#fff5f5" : result.status === "flag" ? "#fffbeb" : "#fff",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, color: "#374151", flex: 1 }}>{item.label}</span>
                        <div style={S.statusRow}>
                          {Object.keys(STATUS_CONFIG).map((s) => (
                            <button key={s} style={S.statusBtn(result.status === s, s)}
                              onClick={() => setCheckResult(item.id, result.status === s ? null : s)}>
                              {STATUS_CONFIG[s].label}
                            </button>
                          ))}
                          <button style={{
                            border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px",
                            fontSize: 12, cursor: "pointer", background: noteOpen ? "#eff6ff" : "#fff",
                            color: noteOpen ? "#1d4ed8" : "#6b7280",
                          }}
                            onClick={() => setCpNoteOpen(noteOpen ? null : item.id)}>
                            {result.note ? "✏ Note" : "+ Note"}
                          </button>
                        </div>
                      </div>
                      {noteOpen && (
                        <div style={{ marginTop: 10 }}>
                          <input style={{ ...S.input, fontSize: 12 }}
                            placeholder="Add a note for this checkpoint…"
                            value={result.note || ""}
                            onChange={(e) => setCheckNote(item.id, e.target.value)}
                            autoFocus
                          />
                        </div>
                      )}
                      {result.note && !noteOpen && (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                          📝 {result.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── TAB: Observations ────────────────────────────────────────────────────
  const ObservationsTab = () => (
    <div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Log an Observation</div>
        <div style={S.grid3}>
          <div>
            <label style={S.label}>Type</label>
            <select style={S.input} value={newObs.type}
              onChange={(e) => setNewObs((o) => ({ ...o, type: e.target.value }))}>
              {["general", "defect", "hazard", "progress", "material", "personnel", "equipment"].map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Priority</label>
            <select style={S.input} value={newObs.priority}
              onChange={(e) => setNewObs((o) => ({ ...o, priority: e.target.value }))}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Time</label>
            <input style={S.input} type="time" value={newObs.time}
              onChange={(e) => setNewObs((o) => ({ ...o, time: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Location on Site</label>
          <input style={S.input} placeholder="e.g. East wing, Level 2" value={newObs.location}
            onChange={(e) => setNewObs((o) => ({ ...o, location: e.target.value }))} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Description *</label>
          <textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }}
            placeholder="Describe what you observed…" value={newObs.description}
            onChange={(e) => setNewObs((o) => ({ ...o, description: e.target.value }))} />
        </div>
        <div style={{ marginTop: 12, textAlign: "right" }}>
          <button style={S.btn("#fff", "#0ea5e9", "#0284c7")} onClick={addObservation}>
            + Add Observation
          </button>
        </div>
      </div>

      {observations.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0", fontSize: 14 }}>
          No observations logged yet. Add one above.
        </div>
      ) : (
        <div>
          {observations.map((o) => {
            const typeColors = {
              hazard: "#dc2626", defect: "#d97706", general: "#0ea5e9",
              progress: "#16a34a", material: "#7c3aed", personnel: "#0891b2", equipment: "#6b7280"
            };
            return (
              <div key={o.id} style={{
                ...S.card, borderLeft: `4px solid ${typeColors[o.type] || "#6b7280"}`, marginBottom: 10,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                        color: typeColors[o.type], letterSpacing: "0.06em",
                      }}>{o.type}</span>
                      <PriorityDot priority={o.priority} />
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{o.priority} priority</span>
                      <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>@ {o.time}</span>
                    </div>
                    <div style={{ fontSize: 14, color: "#111827", marginBottom: 4 }}>{o.description}</div>
                    {o.location && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>📍 {o.location}</div>
                    )}
                  </div>
                  <button onClick={() => removeObservation(o.id)} style={{
                    border: "none", background: "none", cursor: "pointer", color: "#9ca3af",
                    fontSize: 16, padding: "0 4px", marginLeft: 12,
                  }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── TAB: Export ───────────────────────────────────────────────────────────
  const ExportTab = () => {
    const allResults = allItems.map((i) => ({ item: i, result: visit.checkResults[i.id] }));
    const unchecked = allResults.filter((r) => !r.result?.status).length;

    return (
      <div>
        <div style={S.card}>
          <div style={S.sectionTitle}>Export Summary</div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>
            Your report will be exported as a <strong>.csv</strong> file that opens directly in Excel or Google Sheets.
          </div>
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["Site", visit.siteName || "—"],
                ["Inspector", visit.inspector || "—"],
                ["Date", visit.date || "—"],
                ["Location", visit.location || "—"],
                ["Checkpoints", `${checked}/${total} reviewed`],
                ["Pass / Fail / Flag", `${counts.pass} / ${counts.fail} / ${counts.flag}`],
                ["Observations", observations.length],
                ["Unchecked", unchecked],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid #e5e7eb", paddingBottom: 6, paddingTop: 6 }}>
                  <span style={{ color: "#6b7280" }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {unchecked > 0 && (
            <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#92400e", marginBottom: 14 }}>
              ⚠ {unchecked} checkpoint{unchecked !== 1 ? "s" : ""} still unchecked. You can export now or go back to complete them.
            </div>
          )}
          <button
            style={{ ...S.btn("#fff", "#0f172a", "#0f172a"), padding: "12px 24px", fontSize: 14, width: "100%" }}
            onClick={() => exportToExcel(visit, checkpoints, observations)}
          >
            ⬇ Export to Excel (.csv)
          </button>
        </div>

        {/* Checklist preview */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Full Checklist Preview</div>
          {checkpoints.map((cat) => (
            <div key={cat.id} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>{cat.category}</div>
              {cat.items.map((item) => {
                const r = visit.checkResults[item.id];
                return (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <Badge status={r?.status} />
                    {!r?.status && <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>—</span>}
                    <span style={{ fontSize: 13, color: r?.status ? "#111827" : "#9ca3af" }}>{item.label}</span>
                    {r?.note && <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>— {r.note}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "checkpoints", label: `Checkpoints (${checked}/${total})` },
    { id: "observations", label: `Observations (${observations.length})` },
    { id: "export", label: "Export" },
  ];

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.headerTitle}>🏗 Site Visit Inspector</div>
          <div style={S.headerSub}>
            {visit.siteName ? `${visit.siteName} — ${visit.date}` : "Fill in visit details to get started"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {counts.fail > 0 && (
            <span style={{ background: "#dc2626", color: "#fff", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
              {counts.fail} FAIL{counts.fail > 1 ? "S" : ""}
            </span>
          )}
          <span style={{
            background: progress === 100 ? "#16a34a" : "#334155", color: "#fff",
            borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700,
          }}>{progress}% complete</span>
        </div>
      </div>

      {/* Nav */}
      <div style={S.nav}>
        {TABS.map((t) => (
          <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={S.body}>
        {tab === "overview" && <OverviewTab />}
        {tab === "checkpoints" && <CheckpointsTab />}
        {tab === "observations" && <ObservationsTab />}
        {tab === "export" && <ExportTab />}
      </div>
    </div>
  );
}
