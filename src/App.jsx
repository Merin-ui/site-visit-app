import { useState, useCallback, useEffect, useRef } from "react";

const BIN_ID = "6a3b85fcf5f4af5e2927780e";
const API_KEY = "$2a$10$iWwRndnpQH.pN8C/CsNC6.EzI.qo/XZXzdU0QgFupXtBBuO5VaqrK";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

async function loadFromBin() {
  const res = await fetch(BIN_URL, { headers: { "X-Master-Key": API_KEY } });
  const data = await res.json();
  return data.record || { visits: [], archived: [] };
}

async function saveToBin(payload) {
  await fetch(BIN_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
    body: JSON.stringify(payload),
  });
}

const DEFAULT_CHECKPOINTS = [
  { id: "cp1", category: "Safety", items: [
    { id: "cp1-1", label: "PPE available and in use" },
    { id: "cp1-2", label: "Emergency exits clearly marked" },
    { id: "cp1-3", label: "First aid kit accessible" },
    { id: "cp1-4", label: "Fire extinguishers in place" },
  ]},
  { id: "cp2", category: "Structural", items: [
    { id: "cp2-1", label: "Foundation integrity" },
    { id: "cp2-2", label: "Roof and ceilings — no damage/leaks" },
    { id: "cp2-3", label: "Walls and floors — no cracks/hazards" },
    { id: "cp2-4", label: "Doors and windows functional" },
  ]},
  { id: "cp3", category: "Electrical & Plumbing", items: [
    { id: "cp3-1", label: "Electrical panels labelled and accessible" },
    { id: "cp3-2", label: "No exposed wiring" },
    { id: "cp3-3", label: "Water supply functional" },
    { id: "cp3-4", label: "Drainage/sewage — no blockages" },
  ]},
  { id: "cp4", category: "Compliance", items: [
    { id: "cp4-1", label: "Permits displayed on site" },
    { id: "cp4-2", label: "Site boundaries respected" },
    { id: "cp4-3", label: "Waste disposal adequate" },
    { id: "cp4-4", label: "Noise/vibration within limits" },
  ]},
];

const STATUS_CONFIG = {
  pass: { label: "Pass", color: "#16a34a", bg: "#dcfce7", border: "#bbf7d0" },
  fail: { label: "Fail", color: "#dc2626", bg: "#fee2e2", border: "#fecaca" },
  flag: { label: "Flag", color: "#d97706", bg: "#fef3c7", border: "#fde68a" },
  na:   { label: "N/A",  color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
};

const TYPE_COLORS = {
  hazard: "#dc2626", defect: "#d97706", general: "#0ea5e9",
  progress: "#16a34a", material: "#7c3aed", personnel: "#0891b2", equipment: "#6b7280"
};

function makeVisit() {
  return {
    id: Date.now(),
    siteName: "", inspector: "", date: new Date().toISOString().split("T")[0],
    location: "", weather: "", checkResults: {}, observations: [],
    createdAt: new Date().toISOString(),
  };
}

function getVisitStats(visit) {
  const allItems = DEFAULT_CHECKPOINTS.flatMap((c) => c.items);
  const counts = { pass: 0, fail: 0, flag: 0, na: 0 };
  allItems.forEach((i) => { const s = visit.checkResults?.[i.id]?.status; if (s) counts[s]++; });
  const checked = counts.pass + counts.fail + counts.flag + counts.na;
  const progress = Math.round((checked / allItems.length) * 100);
  return { counts, checked, total: allItems.length, progress };
}

function exportToCSV(visit) {
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
  DEFAULT_CHECKPOINTS.forEach((cat) =>
    cat.items.forEach((item) => {
      const r = visit.checkResults?.[item.id] || {};
      rows.push([cat.category, item.label, r.status?.toUpperCase() || "NOT CHECKED", r.note || ""]);
    })
  );
  rows.push([]);
  rows.push(["── OBSERVATIONS ──"]);
  rows.push(["Time", "Type", "Priority", "Description", "Location"]);
  (visit.observations || []).forEach((o) =>
    rows.push([o.time, o.type, o.priority, o.description, o.location || ""])
  );
  const { counts, total } = getVisitStats(visit);
  rows.push([]);
  rows.push(["── SUMMARY ──"]);
  rows.push(["Total", total], ["Pass", counts.pass], ["Fail", counts.fail],
    ["Flagged", counts.flag], ["N/A", counts.na],
    ["Observations", (visit.observations||[]).length]);
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `site-visit-${visit.siteName || "report"}-${visit.date || "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared primitives ──────────────────────────────────────────────────────

function Badge({ status }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, letterSpacing: "0.05em" }}>
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: "14px 18px", minWidth: 90, textAlign: "center", borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, fontWeight: 600, letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

function useStyles() {
  return {
    card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 },
    sectionTitle: { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 14 },
    input: { border: "1px solid #d1d5db", borderRadius: 7, padding: "8px 12px", fontSize: 13,
      color: "#111827", width: "100%", boxSizing: "border-box", outline: "none", fontFamily: "inherit", background: "#fff" },
    label: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  };
}

// ── Tab components ─────────────────────────────────────────────────────────

function OverviewTab({ visit, onUpdateVisit, counts, checked, total, progress }) {
  const S = useStyles();
  const attentionItems = DEFAULT_CHECKPOINTS.flatMap((c) =>
    c.items.filter((i) => ["fail", "flag"].includes(visit.checkResults[i.id]?.status))
      .map((i) => ({ cat: c.category, item: i, result: visit.checkResults[i.id] }))
  );
  return (
    <div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Visit Details</div>
        <div style={S.grid2}>
          {[
            { key: "siteName", label: "Site Name", placeholder: "e.g. Building A — Floor 3" },
            { key: "inspector", label: "Inspector Name", placeholder: "Your name" },
            { key: "location", label: "Location / Address", placeholder: "123 Main St" },
            { key: "weather", label: "Weather Conditions", placeholder: "e.g. Clear, 22°C" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={S.label}>{label}</label>
              <input style={S.input} placeholder={placeholder} value={visit[key]}
                onChange={(e) => onUpdateVisit(key, e.target.value)} />
            </div>
          ))}
          <div>
            <label style={S.label}>Date</label>
            <input style={S.input} type="date" value={visit.date}
              onChange={(e) => onUpdateVisit("date", e.target.value)} />
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Inspection Progress</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
          <span>{checked} of {total} checkpoints reviewed</span>
          <span style={{ fontWeight: 700, color: "#0ea5e9" }}>{progress}%</span>
        </div>
        <div style={{ height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#0ea5e9,#38bdf8)", borderRadius: 99, transition: "width 0.4s" }} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <StatCard label="PASS" value={counts.pass} color="#16a34a" />
          <StatCard label="FAIL" value={counts.fail} color="#dc2626" />
          <StatCard label="FLAGGED" value={counts.flag} color="#d97706" />
          <StatCard label="N/A" value={counts.na} color="#6b7280" />
          <StatCard label="OBSERVATIONS" value={(visit.observations||[]).length} color="#0ea5e9" />
        </div>
      </div>
      {attentionItems.length > 0 && (
        <div style={{ ...S.card, borderLeft: "4px solid #dc2626" }}>
          <div style={S.sectionTitle}>⚠ Items Needing Attention</div>
          {attentionItems.map(({ cat, item, result }) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Badge status={result.status} />
              <span style={{ fontSize: 13, color: "#374151" }}>{cat} — {item.label}</span>
              {result.note && <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>{result.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckpointsTab({ visit, onSetResult, onSetNote }) {
  const S = useStyles();
  const [expandedCp, setExpandedCp] = useState(null);
  const [cpNoteOpen, setCpNoteOpen] = useState(null);
  return (
    <div>
      {DEFAULT_CHECKPOINTS.map((cat) => {
        const catCounts = { pass: 0, fail: 0, flag: 0 };
        cat.items.forEach((i) => { const s = visit.checkResults[i.id]?.status; if (s && s !== "na") catCounts[s] = (catCounts[s]||0)+1; });
        return (
          <div key={cat.id} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div onClick={() => setExpandedCp(expandedCp === cat.id ? null : cat.id)}
              style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", background: expandedCp === cat.id ? "#f8fafc" : "#fff",
                borderBottom: (expandedCp === cat.id || expandedCp === null) ? "1px solid #e5e7eb" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{cat.category}</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{cat.items.length} items</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {catCounts.pass > 0 && <Badge status="pass" />}
                {catCounts.flag > 0 && <Badge status="flag" />}
                {catCounts.fail > 0 && <Badge status="fail" />}
                <span style={{ color: "#9ca3af", marginLeft: 4 }}>{expandedCp === cat.id ? "▲" : "▼"}</span>
              </div>
            </div>
            {(expandedCp === cat.id || expandedCp === null) && cat.items.map((item, idx) => {
              const result = visit.checkResults[item.id] || {};
              const noteOpen = cpNoteOpen === item.id;
              return (
                <div key={item.id} style={{ padding: "14px 20px",
                  borderBottom: idx < cat.items.length - 1 ? "1px solid #f3f4f6" : "none",
                  background: result.status === "fail" ? "#fff5f5" : result.status === "flag" ? "#fffbeb" : "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "#374151", flex: 1 }}>{item.label}</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.keys(STATUS_CONFIG).map((s) => (
                        <button key={s} onClick={() => onSetResult(item.id, result.status === s ? null : s)}
                          style={{ border: `1.5px solid ${result.status === s ? STATUS_CONFIG[s].color : "#d1d5db"}`,
                            borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                            background: result.status === s ? STATUS_CONFIG[s].bg : "#fff",
                            color: result.status === s ? STATUS_CONFIG[s].color : "#6b7280" }}>
                          {STATUS_CONFIG[s].label}
                        </button>
                      ))}
                      <button onClick={() => setCpNoteOpen(noteOpen ? null : item.id)}
                        style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px", fontSize: 12,
                          cursor: "pointer", background: noteOpen ? "#eff6ff" : "#fff",
                          color: noteOpen ? "#1d4ed8" : "#6b7280" }}>
                        {result.note ? "✏ Note" : "+ Note"}
                      </button>
                    </div>
                  </div>
                  {noteOpen && (
                    <input autoFocus style={{ ...S.input, fontSize: 12, marginTop: 10 }}
                      placeholder="Add a note…" value={result.note || ""}
                      onChange={(e) => onSetNote(item.id, e.target.value)} />
                  )}
                  {result.note && !noteOpen && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>📝 {result.note}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ObservationsTab({ visit, onAddObs, onRemoveObs }) {
  const S = useStyles();
  const [form, setForm] = useState({
    type: "general", priority: "medium", description: "", location: "",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });
  const handleAdd = () => {
    if (!form.description.trim()) return;
    onAddObs({ ...form, id: Date.now() });
    setForm((f) => ({ ...f, description: "", location: "" }));
  };
  return (
    <div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Log an Observation</div>
        <div style={S.grid3}>
          <div>
            <label style={S.label}>Type</label>
            <select style={S.input} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {["general","defect","hazard","progress","material","personnel","equipment"].map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Priority</label>
            <select style={S.input} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Time</label>
            <input style={S.input} type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Location on Site</label>
          <input style={S.input} placeholder="e.g. East wing, Level 2" value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>Description *</label>
          <textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }}
            placeholder="Describe what you observed…" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div style={{ marginTop: 12, textAlign: "right" }}>
          <button onClick={handleAdd} style={{ border: "1px solid #0284c7", borderRadius: 7, padding: "8px 16px",
            fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#0ea5e9", color: "#fff" }}>
            + Add Observation
          </button>
        </div>
      </div>
      {(visit.observations||[]).length === 0
        ? <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0", fontSize: 14 }}>No observations logged yet.</div>
        : (visit.observations||[]).map((o) => (
          <div key={o.id} style={{ ...S.card, borderLeft: `4px solid ${TYPE_COLORS[o.type]||"#6b7280"}`, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                    color: TYPE_COLORS[o.type], letterSpacing: "0.06em" }}>{o.type}</span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, display: "inline-block",
                    background: { high:"#dc2626", medium:"#d97706", low:"#16a34a" }[o.priority] }} />
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{o.priority} · {o.time}</span>
                </div>
                <div style={{ fontSize: 14, color: "#111827", marginBottom: 4 }}>{o.description}</div>
                {o.location && <div style={{ fontSize: 12, color: "#6b7280" }}>📍 {o.location}</div>}
              </div>
              <button onClick={() => onRemoveObs(o.id)} style={{ border: "none", background: "none",
                cursor: "pointer", color: "#9ca3af", fontSize: 16, padding: "0 4px", marginLeft: 12 }}>✕</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function ExportTab({ visit, counts, checked, total }) {
  const S = useStyles();
  const unchecked = total - checked;
  return (
    <div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Export Summary</div>
        <div style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>
          Exported as a <strong>.csv</strong> file — opens directly in Excel or Google Sheets.
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {[["Site",visit.siteName||"—"],["Inspector",visit.inspector||"—"],["Date",visit.date||"—"],
              ["Location",visit.location||"—"],["Checkpoints",`${checked}/${total}`],
              ["Pass/Fail/Flag",`${counts.pass}/${counts.fail}/${counts.flag}`],
              ["Observations",(visit.observations||[]).length],["Unchecked",unchecked]
            ].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13,
                borderBottom:"1px solid #e5e7eb", padding:"6px 0" }}>
                <span style={{ color:"#6b7280" }}>{k}</span>
                <span style={{ fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {unchecked > 0 && (
          <div style={{ background:"#fef3c7", border:"1px solid #fde68a", borderRadius:7,
            padding:"10px 14px", fontSize:13, color:"#92400e", marginBottom:14 }}>
            ⚠ {unchecked} checkpoint{unchecked!==1?"s":""} still unchecked.
          </div>
        )}
        <button onClick={() => exportToCSV(visit)}
          style={{ border:"1px solid #0f172a", borderRadius:7, padding:"12px 24px",
            fontSize:14, fontWeight:600, cursor:"pointer", background:"#0f172a", color:"#fff", width:"100%" }}>
          ⬇ Export to Excel (.csv)
        </button>
      </div>
      <div style={S.card}>
        <div style={S.sectionTitle}>Checklist Preview</div>
        {DEFAULT_CHECKPOINTS.map((cat) => (
          <div key={cat.id} style={{ marginBottom: 16 }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#374151", letterSpacing:"0.06em",
              textTransform:"uppercase", marginBottom:8 }}>{cat.category}</div>
            {cat.items.map((item) => {
              const r = visit.checkResults[item.id];
              return (
                <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                  {r?.status ? <Badge status={r.status}/> : <span style={{ fontSize:11, color:"#9ca3af" }}>—</span>}
                  <span style={{ fontSize:13, color:r?.status?"#111827":"#9ca3af" }}>{item.label}</span>
                  {r?.note && <span style={{ fontSize:12, color:"#9ca3af", fontStyle:"italic" }}>— {r.note}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── History Tab ────────────────────────────────────────────────────────────

function HistoryTab({ archived, onReopen, onDeleteArchived, onExportArchived }) {
  const S = useStyles();
  const [selected, setSelected] = useState(null);

  if (archived.length === 0) {
    return (
      <div style={{ ...S.card, textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗂</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 6 }}>No archived visits yet</div>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          When you're done with a visit, click <strong>"Archive Visit"</strong> in the visit switcher.<br/>
          It'll be saved here permanently and removed from active visits.
        </div>
      </div>
    );
  }

  if (selected) {
    const v = archived.find((a) => a.id === selected);
    if (!v) { setSelected(null); return null; }
    const { counts, checked, total, progress } = getVisitStats(v);
    const attentionItems = DEFAULT_CHECKPOINTS.flatMap((c) =>
      c.items.filter((i) => ["fail","flag"].includes(v.checkResults?.[i.id]?.status))
        .map((i) => ({ cat: c.category, item: i, result: v.checkResults[i.id] }))
    );
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ border:"1px solid #e5e7eb", borderRadius:7,
          padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer", background:"#fff",
          color:"#374151", marginBottom:16, display:"flex", alignItems:"center", gap:6 }}>
          ← Back to History
        </button>

        {/* Visit header */}
        <div style={{ ...S.card, borderTop: "4px solid #0ea5e9" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:"#111827" }}>{v.siteName || "Unnamed Visit"}</div>
              <div style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>
                {v.date} {v.inspector && `· Inspector: ${v.inspector}`} {v.location && `· ${v.location}`}
              </div>
              {v.weather && <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>🌤 {v.weather}</div>}
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>
                Archived {new Date(v.archivedAt).toLocaleString()}
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={() => { exportToCSV(v); }} style={{ border:"1px solid #0f172a", borderRadius:7,
                padding:"8px 14px", fontSize:13, fontWeight:600, cursor:"pointer", background:"#0f172a", color:"#fff" }}>
                ⬇ Export CSV
              </button>
              <button onClick={() => onReopen(v.id)} style={{ border:"1px solid #0ea5e9", borderRadius:7,
                padding:"8px 14px", fontSize:13, fontWeight:600, cursor:"pointer", background:"#eff6ff", color:"#0ea5e9" }}>
                ↩ Reopen
              </button>
              <button onClick={() => { onDeleteArchived(v.id); setSelected(null); }}
                style={{ border:"1px solid #fee2e2", borderRadius:7, padding:"8px 14px",
                  fontSize:13, fontWeight:600, cursor:"pointer", background:"#fff5f5", color:"#dc2626" }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Results Summary</div>
          <div style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#6b7280", marginBottom:6 }}>
              <span>{checked} of {total} checkpoints reviewed</span>
              <span style={{ fontWeight:700, color:"#0ea5e9" }}>{progress}%</span>
            </div>
            <div style={{ height:8, background:"#e5e7eb", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${progress}%`, background:"linear-gradient(90deg,#0ea5e9,#38bdf8)", borderRadius:99 }} />
            </div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <StatCard label="PASS" value={counts.pass} color="#16a34a" />
            <StatCard label="FAIL" value={counts.fail} color="#dc2626" />
            <StatCard label="FLAGGED" value={counts.flag} color="#d97706" />
            <StatCard label="N/A" value={counts.na} color="#6b7280" />
            <StatCard label="OBSERVATIONS" value={(v.observations||[]).length} color="#0ea5e9" />
          </div>
        </div>

        {/* Attention items */}
        {attentionItems.length > 0 && (
          <div style={{ ...S.card, borderLeft:"4px solid #dc2626" }}>
            <div style={S.sectionTitle}>⚠ Failed / Flagged Items</div>
            {attentionItems.map(({ cat, item, result }) => (
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <Badge status={result.status} />
                <span style={{ fontSize:13, color:"#374151" }}>{cat} — {item.label}</span>
                {result.note && <span style={{ fontSize:12, color:"#9ca3af", fontStyle:"italic" }}>{result.note}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Full checklist */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Full Checklist</div>
          {DEFAULT_CHECKPOINTS.map((cat) => (
            <div key={cat.id} style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#374151", letterSpacing:"0.06em",
                textTransform:"uppercase", marginBottom:8 }}>{cat.category}</div>
              {cat.items.map((item) => {
                const r = v.checkResults?.[item.id];
                return (
                  <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                    {r?.status ? <Badge status={r.status}/> : <span style={{ fontSize:11, color:"#9ca3af" }}>—</span>}
                    <span style={{ fontSize:13, color:r?.status?"#111827":"#9ca3af" }}>{item.label}</span>
                    {r?.note && <span style={{ fontSize:12, color:"#9ca3af", fontStyle:"italic" }}>— {r.note}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Observations */}
        {(v.observations||[]).length > 0 && (
          <div style={S.card}>
            <div style={S.sectionTitle}>Observations ({v.observations.length})</div>
            {v.observations.map((o) => (
              <div key={o.id} style={{ borderLeft:`4px solid ${TYPE_COLORS[o.type]||"#6b7280"}`,
                padding:"12px 16px", marginBottom:10, background:"#f8fafc", borderRadius:"0 8px 8px 0" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                    color:TYPE_COLORS[o.type], letterSpacing:"0.06em" }}>{o.type}</span>
                  <span style={{ fontSize:11, color:"#9ca3af" }}>{o.priority} · {o.time}</span>
                </div>
                <div style={{ fontSize:13, color:"#111827" }}>{o.description}</div>
                {o.location && <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>📍 {o.location}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div>
      <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>
        {archived.length} archived visit{archived.length!==1?"s":""}. Click any to view full details.
      </div>
      {[...archived].sort((a,b) => new Date(b.archivedAt)-new Date(a.archivedAt)).map((v) => {
        const { counts, progress } = getVisitStats(v);
        const hasFails = counts.fail > 0;
        return (
          <div key={v.id} onClick={() => setSelected(v.id)}
            style={{ ...S.card, cursor:"pointer", borderLeft:`4px solid ${hasFails?"#dc2626":counts.flag>0?"#d97706":"#16a34a"}`,
              transition:"box-shadow 0.15s" }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow="none"}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:"#111827" }}>{v.siteName||"Unnamed Visit"}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:3 }}>
                  {v.date} {v.inspector && `· ${v.inspector}`} {v.location && `· ${v.location}`}
                </div>
                <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>
                  Archived {new Date(v.archivedAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                {counts.fail > 0 && <Badge status="fail"/>}
                {counts.flag > 0 && <Badge status="flag"/>}
                {counts.pass > 0 && <Badge status="pass"/>}
                <span style={{ fontSize:12, fontWeight:700, color:"#0ea5e9", marginLeft:4 }}>{progress}%</span>
                <span style={{ fontSize:12, color:"#9ca3af" }}>→</span>
              </div>
            </div>
            {/* Mini progress bar */}
            <div style={{ height:4, background:"#e5e7eb", borderRadius:99, overflow:"hidden", marginTop:12 }}>
              <div style={{ height:"100%", width:`${progress}%`,
                background:hasFails?"#dc2626":counts.flag>0?"#d97706":"#16a34a", borderRadius:99 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Visit Switcher ─────────────────────────────────────────────────────────

function VisitSwitcher({ visits, activeId, onSelect, onNew, onDelete, onArchive }) {
  return (
    <div style={{ background:"#1e293b", padding:"8px 24px", display:"flex", alignItems:"center", gap:8, overflowX:"auto" }}>
      <span style={{ fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>ACTIVE</span>
      {visits.map((v) => (
        <div key={v.id} style={{ display:"flex", alignItems:"center" }}>
          <button onClick={() => onSelect(v.id)} style={{
            background: v.id===activeId?"#0ea5e9":"#334155",
            color: v.id===activeId?"#fff":"#94a3b8",
            border:"none", borderRadius: visits.length>1?"6px 0 0 6px":6,
            padding:"5px 12px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
            {v.siteName||`Visit ${visits.indexOf(v)+1}`}
          </button>
          {visits.length > 1 && (
            <button onClick={() => onDelete(v.id)} style={{
              background: v.id===activeId?"#0284c7":"#1e3a5f",
              color: v.id===activeId?"#fff":"#64748b",
              border:"none", borderRadius:"0 6px 6px 0", padding:"5px 7px", fontSize:11, cursor:"pointer" }}>✕</button>
          )}
        </div>
      ))}
      <button onClick={onNew} style={{ background:"none", border:"1px dashed #475569", borderRadius:6,
        color:"#94a3b8", padding:"4px 12px", fontSize:12, cursor:"pointer", whiteSpace:"nowrap" }}>
        + New Visit
      </button>
      {activeId && (
        <button onClick={() => onArchive(activeId)} style={{ background:"none", border:"1px solid #475569",
          borderRadius:6, color:"#94a3b8", padding:"4px 12px", fontSize:12, cursor:"pointer", whiteSpace:"nowrap",
          marginLeft:"auto" }}>
          🗂 Archive Visit
        </button>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [visits, setVisits] = useState([makeVisit()]);
  const [archived, setArchived] = useState([]);
  const [activeId, setActiveId] = useState(visits[0].id);
  const [tab, setTab] = useState("overview");
  const [syncStatus, setSyncStatus] = useState("loading");
  const [isLoaded, setIsLoaded] = useState(false);

  const saveTimer = useRef(null);
  // Refs so triggerSave always reads latest state without stale closure
  const visitsRef = useRef(visits);
  const archivedRef = useRef(archived);
  useEffect(() => { visitsRef.current = visits; }, [visits]);
  useEffect(() => { archivedRef.current = archived; }, [archived]);

  useEffect(() => {
    loadFromBin()
      .then((record) => {
        const v = record.visits?.length ? record.visits : [makeVisit()];
        const a = record.archived || [];
        setVisits(v);
        setArchived(a);
        setActiveId(v[0].id);
        setIsLoaded(true);
        setSyncStatus("idle");
      })
      .catch(() => { setIsLoaded(true); setSyncStatus("error"); });
  }, []);

  const triggerSave = useCallback((newVisits, newArchived) => {
    if (!isLoaded) return; // never save before load finishes
    const v = newVisits ?? visitsRef.current;
    const a = newArchived ?? archivedRef.current;
    setSyncStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveToBin({ visits: v, archived: a })
        .then(() => setSyncStatus("saved"))
        .catch(() => setSyncStatus("error"));
    }, 1200);
  }, [isLoaded]);

  const visit = visits.find((v) => v.id === activeId) || visits[0];

  const updateVisit = useCallback((updater) => {
    setVisits((vs) => {
      const next = vs.map((v) => v.id === activeId
        ? (typeof updater === "function" ? updater(v) : { ...v, ...updater })
        : v);
      triggerSave(next, archivedRef.current);
      return next;
    });
  }, [activeId, triggerSave]);

  const handleUpdateField = useCallback((key, value) => updateVisit((v) => ({ ...v, [key]: value })), [updateVisit]);
  const handleSetResult = useCallback((itemId, status) => updateVisit((v) => ({ ...v, checkResults: { ...v.checkResults, [itemId]: { ...v.checkResults[itemId], status } } })), [updateVisit]);
  const handleSetNote = useCallback((itemId, note) => updateVisit((v) => ({ ...v, checkResults: { ...v.checkResults, [itemId]: { ...v.checkResults[itemId], note } } })), [updateVisit]);
  const handleAddObs = useCallback((obs) => updateVisit((v) => ({ ...v, observations: [obs, ...(v.observations||[])] })), [updateVisit]);
  const handleRemoveObs = useCallback((id) => updateVisit((v) => ({ ...v, observations: (v.observations||[]).filter((o) => o.id !== id) })), [updateVisit]);

  const handleNewVisit = () => {
    const nv = makeVisit();
    setVisits((vs) => {
      const next = [...vs, nv];
      triggerSave(next, archivedRef.current);
      return next;
    });
    setActiveId(nv.id);
    setTab("overview");
  };

  const handleDeleteVisit = (id) => {
    if (visits.length === 1) return;
    setVisits((vs) => {
      const next = vs.filter((v) => v.id !== id);
      triggerSave(next, archivedRef.current);
      return next;
    });
    if (activeId === id) setActiveId(visits.find((v) => v.id !== id)?.id);
  };

  const handleArchive = (id) => {
    const toArchive = visitsRef.current.find((v) => v.id === id);
    if (!toArchive) return;
    const archivedVisit = { ...toArchive, archivedAt: new Date().toISOString() };
    const remaining = visitsRef.current.filter((v) => v.id !== id);
    const newVisits = remaining.length > 0 ? remaining : [makeVisit()];
    const newArchived = [archivedVisit, ...archivedRef.current];
    setVisits(newVisits);
    setArchived(newArchived);
    setActiveId(newVisits[0].id);
    setTab("overview");
    triggerSave(newVisits, newArchived);
  };

  const handleReopen = (id) => {
    const toReopen = archivedRef.current.find((a) => a.id === id);
    if (!toReopen) return;
    const { archivedAt, ...visitData } = toReopen;
    const reopened = { ...visitData, id: Date.now() };
    const newVisits = [...visitsRef.current, reopened];
    const newArchived = archivedRef.current.filter((a) => a.id !== id);
    setVisits(newVisits);
    setArchived(newArchived);
    setActiveId(reopened.id);
    setTab("overview");
    triggerSave(newVisits, newArchived);
  };

  const handleDeleteArchived = (id) => {
    const next = archivedRef.current.filter((v) => v.id !== id);
    setArchived(next);
    triggerSave(visitsRef.current, next);
  };

  const { counts, checked, total, progress } = getVisitStats(visit);
  const syncLabel = { saving:"⏳ Saving…", saved:"✓ Saved", error:"⚠ Save failed", loading:"⏳ Loading…" }[syncStatus] || "";
  const syncColor = { saving:"#94a3b8", saved:"#16a34a", error:"#dc2626", loading:"#94a3b8" }[syncStatus] || "#94a3b8";

  const TABS = [
    { id:"overview", label:"Overview" },
    { id:"checkpoints", label:`Checkpoints (${checked}/${total})` },
    { id:"observations", label:`Observations (${(visit.observations||[]).length})` },
    { id:"export", label:"Export" },
    { id:"history", label:`History (${archived.length})` },
  ];

  return (
    <div style={{ fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", background:"#f8fafc", minHeight:"100vh", color:"#111827" }}>
      <div style={{ background:"#0f172a", color:"#fff", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, letterSpacing:"-0.02em" }}>🏗 Site Visit Inspector</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>
            {visit.siteName ? `${visit.siteName} — ${visit.date}` : "Fill in visit details to get started"}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {syncLabel && <span style={{ fontSize:11, color:syncColor, fontWeight:600 }}>{syncLabel}</span>}
          {counts.fail > 0 && (
            <span style={{ background:"#dc2626", color:"#fff", borderRadius:999, padding:"4px 10px", fontSize:12, fontWeight:700 }}>
              {counts.fail} FAIL{counts.fail!==1?"S":""}
            </span>
          )}
          <span style={{ background:progress===100?"#16a34a":"#334155", color:"#fff",
            borderRadius:999, padding:"4px 10px", fontSize:12, fontWeight:700 }}>
            {progress}% complete
          </span>
        </div>
      </div>

      <VisitSwitcher visits={visits} activeId={activeId} onSelect={(id) => { setActiveId(id); setTab("overview"); }}
        onNew={handleNewVisit} onDelete={handleDeleteVisit} onArchive={handleArchive} />

      <div style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", display:"flex", padding:"0 24px", overflowX:"auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"12px 18px", fontSize:13, fontWeight:600,
            border:"none", background:"none", cursor:"pointer", whiteSpace:"nowrap",
            borderBottom: tab===t.id?"2px solid #0ea5e9":"2px solid transparent",
            color: tab===t.id?"#0ea5e9":"#6b7280" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding:"24px", maxWidth:900, margin:"0 auto" }}>
        {syncStatus === "loading" ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#6b7280", fontSize:14 }}>⏳ Loading your visits…</div>
        ) : (
          <>
            {tab==="overview" && <OverviewTab visit={visit} onUpdateVisit={handleUpdateField} counts={counts} checked={checked} total={total} progress={progress} />}
            {tab==="checkpoints" && <CheckpointsTab key={activeId} visit={visit} onSetResult={handleSetResult} onSetNote={handleSetNote} />}
            {tab==="observations" && <ObservationsTab key={activeId} visit={visit} onAddObs={handleAddObs} onRemoveObs={handleRemoveObs} />}
            {tab==="export" && <ExportTab visit={visit} counts={counts} checked={checked} total={total} />}
            {tab==="history" && <HistoryTab archived={archived} onReopen={handleReopen} onDeleteArchived={handleDeleteArchived} />}
          </>
        )}
      </div>
    </div>
  );
}
