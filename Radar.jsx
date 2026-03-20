import { useState, useMemo, useCallback, useRef } from "react";
import radarData from "./radar.json";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CX = 450, CY = 450, OUTER_R = 390;

// 8 distinct non-overlapping sectors (clockwise from east = 0°)
const SECTORS = {
  architecture:  { start: -26,  end:  26  },
  apis:          { start:  26,  end:  78  },
  data:          { start:  78,  end: 130  },
  devops:        { start: 130,  end: 182  },
  nonfunctional: { start: 182,  end: 206  },
  languages:     { start: 206,  end: 258  },
  security:      { start: 258,  end: 310  },
  genai:         { start: 310,  end: 334  },
};

const SECTOR_FILLS = [
  { id: "architecture",  color: "#00A4EF", start: -26,  end:  26  },
  { id: "apis",          color: "#7FBA00", start:  26,  end:  78  },
  { id: "data",          color: "#F25022", start:  78,  end: 130  },
  { id: "devops",        color: "#FFB900", start: 130,  end: 206  },
  { id: "languages",     color: "#8F7BE8", start: 206,  end: 258  },
  { id: "security",      color: "#E74856", start: 258,  end: 334  },
];

const RING_BOUNDARIES = [OUTER_R * 0.25, OUTER_R * 0.50, OUTER_R * 0.75, OUTER_R];
const RING_MID        = [OUTER_R * 0.13, OUTER_R * 0.375, OUTER_R * 0.625, OUTER_R * 0.875];

const toRad = deg => (deg * Math.PI) / 180;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeUniqueId(label, existingTopics) {
  const base = slugify(label) || `topic-${Date.now()}`;
  if (!existingTopics.some(t => t.id === base)) return base;
  let n = 2;
  while (existingTopics.some(t => t.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function sectorPath(startDeg, endDeg, r) {
  const x1 = CX + r * Math.cos(toRad(startDeg));
  const y1 = CY + r * Math.sin(toRad(startDeg));
  const x2 = CX + r * Math.cos(toRad(endDeg));
  const y2 = CY + r * Math.sin(toRad(endDeg));
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M${CX},${CY} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
}

function labelPos(catId) {
  const s = SECTORS[catId];
  if (!s) return { x: CX, y: CY };
  const mid = toRad((s.start + s.end) / 2);
  const d = OUTER_R + 34;
  return { x: CX + d * Math.cos(mid), y: CY + d * Math.sin(mid) };
}

function autoPlace(allTopics, category) {
  const sector = SECTORS[category];
  if (!sector) return { cx: CX, cy: CY };
  const same = allTopics.filter(t => t.category === category);
  const ringCounts = RING_MID.map(r =>
    same.filter(t => Math.abs(Math.sqrt((t.cx - CX) ** 2 + (t.cy - CY) ** 2) - r) < 40).length
  );
  const ri = ringCounts.indexOf(Math.min(...ringCounts));
  const r = RING_MID[ri];
  const jitters = [0, 8, -8, 14, -14, 5, -5, 18, -18];
  const jitter = jitters[same.length % jitters.length];
  const angle = toRad((sector.start + sector.end) / 2 + jitter);
  return { cx: Math.round(CX + r * Math.cos(angle)), cy: Math.round(CY + r * Math.sin(angle)) };
}

// ─── LAYOUT ENGINE ────────────────────────────────────────────────────────────

function layoutTopics(topics) {
  const groups = {};
  for (const t of topics) {
    (groups[t.category] = groups[t.category] || []).push(t);
  }
  const placed = [];
  for (const [catId, catTopics] of Object.entries(groups)) {
    const sector = SECTORS[catId];
    if (!sector) { catTopics.forEach(t => placed.push({ ...t })); continue; }
    const spreadDeg = sector.end - sector.start;
    let remaining = [...catTopics];
    for (const r of RING_MID) {
      if (!remaining.length) break;
      const maxFit = Math.max(1, Math.floor((spreadDeg * Math.PI / 180 * r) / 11));
      const batch = remaining.splice(0, Math.min(remaining.length, maxFit));
      batch.forEach((t, i) => {
        const frac = batch.length === 1 ? 0.5 : i / (batch.length - 1);
        const angleDeg = sector.start + spreadDeg * (0.08 + frac * 0.84);
        placed.push({
          ...t,
          cx: Math.round(CX + r * Math.cos(toRad(angleDeg))),
          cy: Math.round(CY + r * Math.sin(toRad(angleDeg))),
        });
      });
    }
    if (remaining.length) {
      const r = RING_MID[RING_MID.length - 1];
      remaining.forEach((t, i) => {
        const frac = (i + 0.5) / remaining.length;
        const angleDeg = sector.start + spreadDeg * (0.04 + frac * 0.92);
        placed.push({
          ...t,
          cx: Math.round(CX + r * Math.cos(toRad(angleDeg))),
          cy: Math.round(CY + r * Math.sin(toRad(angleDeg))),
        });
      });
    }
  }
  return placed;
}

// ─── useRadarEdits HOOK ───────────────────────────────────────────────────────

function useRadarEdits(baselineTopics) {
  const [edits, setEdits] = useState(() => {
    try {
      const saved = localStorage.getItem("radar_edits");
      return saved ? JSON.parse(saved) : { added: [], removed: [] };
    } catch {
      return { added: [], removed: [] };
    }
  });

  const topics = useMemo(() => {
    const removedSet = new Set(edits.removed);
    return [
      ...baselineTopics.filter(t => !removedSet.has(t.id)),
      ...edits.added,
    ];
  }, [baselineTopics, edits]);

  const addTopic = useCallback(topic => {
    setEdits(prev => {
      const next = { ...prev, added: [...prev.added, topic] };
      localStorage.setItem("radar_edits", JSON.stringify(next));
      return next;
    });
  }, []);

  const removeTopic = useCallback(id => {
    setEdits(prev => {
      const next = prev.added.some(t => t.id === id)
        ? { ...prev, added: prev.added.filter(t => t.id !== id) }
        : { ...prev, removed: [...prev.removed, id] };
      localStorage.setItem("radar_edits", JSON.stringify(next));
      return next;
    });
  }, []);

  return { topics, addTopic, removeTopic };
}

// ─── ADD LINK MODAL ───────────────────────────────────────────────────────────

function AddLinkModal({ categories, allTopics, onAdd, onClose }) {
  const [label, setLabel]       = useState("");
  const [href, setHref]         = useState("");
  const [category, setCategory] = useState(categories[0]?.id || "");
  const [error, setError]       = useState("");

  const inp = {
    width: "100%", background: "#080A12", border: "1px solid #2A3050",
    color: "#B0BAD0", padding: "8px 12px", borderRadius: "2px",
    fontFamily: "inherit", fontSize: 12, marginBottom: 10,
    boxSizing: "border-box", outline: "none",
  };
  const lbl = text => (
    <div style={{ color: "#556080", fontSize: 11, marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>{text}</div>
  );

  const submit = () => {
    if (!label.trim()) { setError("Label is required."); return; }
    const url = href.trim();
    try { new URL(url); } catch { setError("Enter a valid URL (e.g. https://...)."); return; }
    const id = makeUniqueId(label.trim(), allTopics);
    const pos = autoPlace(allTopics, category);
    onAdd({ id, category, label: label.trim(), href: url, cx: pos.cx, cy: pos.cy });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(8,10,18,0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#0E1120", border: "1px solid #1E2640", borderTop: "3px solid #4EAEFF", borderRadius: "2px", padding: "28px 32px", maxWidth: 480, width: "90%", fontFamily: "'DM Mono','Fira Mono',monospace" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 20px", color: "#F0F4FF", fontSize: 16, fontWeight: 600 }}>Add Resource Link</h3>
        {lbl("Label")}
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Martin Fowler blog" style={inp} onKeyDown={e => e.key === "Enter" && submit()} />
        {lbl("URL")}
        <input value={href} onChange={e => setHref(e.target.value)} placeholder="https://..." style={inp} onKeyDown={e => e.key === "Enter" && submit()} />
        {lbl("Category")}
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, marginBottom: 16, cursor: "pointer" }}>
          {categories.map(c => <option key={c.id} value={c.id} style={{ background: "#0E1120" }}>{c.label}</option>)}
        </select>
        {error && <div style={{ color: "#E05252", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={submit} style={{ background: "#4EAEFF22", border: "1px solid #4EAEFF66", color: "#4EAEFF", padding: "8px 20px", borderRadius: "2px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Add Link</button>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #2A3050", color: "#556080", padding: "8px 20px", borderRadius: "2px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── CATEGORY CONFIG ──────────────────────────────────────────────────────────

const CATEGORY_LABELS = [
  { id: "architecture",  label: "Architecture\n& Design",  color: "#00A4EF" },
  { id: "apis",          label: "APIs &\nProtocols",       color: "#7FBA00" },
  { id: "data",          label: "Data &\nDatabases",       color: "#F25022" },
  { id: "devops",        label: "DevOps &\nInfra",         color: "#FFB900" },
  { id: "nonfunctional", label: "Non-\nfunctional",        color: "#C084FC" },
  { id: "languages",     label: "Languages &\nFrameworks", color: "#8F7BE8" },
  { id: "security",      label: "Security &\nAuth",        color: "#E74856" },
  { id: "genai",         label: "AI\nEngineering",           color: "#E67E22" },
];

// ─── RADAR COMPONENT ──────────────────────────────────────────────────────────

export default function Radar({ filter, search, editMode }) {
  const { topics, addTopic, removeTopic } = useRadarEdits(radarData.topics);
  const [hoveredTopic, setHoveredTopic]   = useState(null);
  const [tooltip, setTooltip]             = useState(null);
  const [showAddModal, setShowAddModal]   = useState(false);

  const colorMap = useMemo(() => {
    const m = {};
    radarData.categories.forEach(c => { m[c.id] = c.color; });
    return m;
  }, []);

  const laidOut = useMemo(() => layoutTopics(topics), [topics]);

  const displayTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return laidOut.map(t => ({
      ...t,
      active: (!filter || t.category === filter) && (!q || t.label.toLowerCase().includes(q)),
    }));
  }, [laidOut, filter, search]);

  // Always show labels; in "All" mode use smaller font + outward anchor
  const showLabels = true;

  const VB = `${CX - OUTER_R - 90} ${CY - OUTER_R - 90} ${(OUTER_R + 90) * 2} ${(OUTER_R + 90) * 2}`;

  return (
    <div
      style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 8px 16px", background: "#080A12", gap: 8, position: "relative" }}
      onMouseLeave={() => setTooltip(null)}
    >
      <svg viewBox={VB} style={{ width: "min(calc(100vw - 16px), calc(100vh - 72px))", height: "auto" }}>
        <defs>
          <radialGradient id="radar-bg-dark" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#141828" />
            <stop offset="100%" stopColor="#0A0C18" />
          </radialGradient>
        </defs>

        {/* Background disc */}
        <circle cx={CX} cy={CY} r={OUTER_R + 2} fill="url(#radar-bg-dark)" stroke="#1E2640" strokeWidth="1" />

        {/* Sector fills */}
        {SECTOR_FILLS.map(s => (
          <path key={s.id} d={sectorPath(s.start, s.end, OUTER_R)} fill={s.color} fillOpacity="0.07" stroke={s.color} strokeOpacity="0.18" strokeWidth="0.5" />
        ))}

        {/* Accent overlays for the two narrow categories */}
        <path d={sectorPath(182, 206, OUTER_R)} fill="#C084FC" fillOpacity="0.12" />
        <path d={sectorPath(310, 334, OUTER_R)} fill="#E67E22" fillOpacity="0.12" />

        {/* Ring boundaries */}
        {RING_BOUNDARIES.map((r, i) => (
          <circle key={i} cx={CX} cy={CY} r={r} fill="none" stroke="#1E2640" strokeWidth={i === 3 ? 1 : 0.6} />
        ))}

        {/* Ring labels */}
        {["Core", "Fundamentals", "Advanced", "Specialist"].map((lbl, i) => (
          <text key={lbl} x={CX + 3} y={CY - RING_BOUNDARIES[i] + 15} textAnchor="middle" fontSize="15" fill="#303A58" fontFamily="'DM Mono','Fira Mono',monospace" style={{ userSelect: "none", pointerEvents: "none" }}>{lbl}</text>
        ))}

        {/* Centre title */}
        <text x={CX} y={CY - 10} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#2E3A5A" fontFamily="'DM Mono','Fira Mono',monospace" style={{ userSelect: "none", pointerEvents: "none" }}>System Design</text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#2E3A5A" fontFamily="'DM Mono','Fira Mono',monospace" style={{ userSelect: "none", pointerEvents: "none" }}>Radar</text>

        {/* Sector divider spokes */}
        {Object.values(SECTORS).map((s, i) => {
          const a = toRad(s.start);
          return <line key={i} x1={CX} y1={CY} x2={CX + OUTER_R * Math.cos(a)} y2={CY + OUTER_R * Math.sin(a)} stroke="#1E2640" strokeWidth="0.8" />;
        })}

        {/* Category outer labels */}
        {CATEGORY_LABELS.map(({ id, label, color }) => {
          const pos = labelPos(id);
          const lines = label.split("\n");
          return (
            <text key={id} x={pos.x} y={pos.y - (lines.length - 1) * 10} textAnchor="middle" fontFamily="'DM Mono','Fira Mono',monospace" style={{ userSelect: "none", pointerEvents: "none" }}>
              {lines.map((ln, i) => <tspan key={i} x={pos.x} dy={i === 0 ? 0 : 20} fontSize="17" fontWeight="bold" fill={color}>{ln}</tspan>)}
            </text>
          );
        })}

        {/* ── Topics ──────────────────────────────────────────────── */}
        {displayTopics.map(topic => {
          const color  = colorMap[topic.category] || "#888";
          const hov    = hoveredTopic === topic.id;
          const dotR   = hov ? 5.5 : 4;
          const labelW = topic.label.length * 6.4 + dotR + 10;
          const hitH   = 18;

          const handleEnter = (e) => {
            setHoveredTopic(topic.id);
            setTooltip({ label: topic.label, color, x: e.clientX, y: e.clientY });
          };
          const handleMove = (e) => {
            setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev);
          };
          const handleLeave = () => {
            setHoveredTopic(null);
            setTooltip(null);
          };

          // Radially orient label: point away from centre
          const onRight = topic.cx >= CX;
          const labelAnchor = onRight ? "start" : "end";
          const labelX = onRight ? topic.cx + dotR + 5 : topic.cx - dotR - 5;
          const labelFontSize = filter ? "15" : "12";

          const dotContent = (
            <>
              {hov && <circle cx={topic.cx} cy={topic.cy} r={dotR + 7} fill={color + "18"} />}
              <circle
                cx={topic.cx} cy={topic.cy} r={dotR}
                fill={hov ? color : color + "AA"}
                stroke={color} strokeWidth={hov ? 1.5 : 0.8}
              />
              {showLabels && (
                <text
                  x={labelX} y={topic.cy + 4}
                  textAnchor={labelAnchor}
                  fontSize={labelFontSize}
                  fontWeight={hov ? "bold" : "normal"}
                  fill={hov ? color : color + "DD"}
                  stroke="#080A12" strokeWidth="3" paintOrder="stroke"
                  fontFamily="'DM Mono','Fira Mono',monospace"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >{topic.label}</text>
              )}
            </>
          );

          return (
            <g
              key={topic.id}
              onMouseEnter={handleEnter}
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
              style={{
                opacity: topic.active ? 1 : 0.1,
                pointerEvents: topic.active ? "auto" : "none",
                transition: "opacity 0.2s",
                cursor: "pointer",
              }}
            >
              {editMode ? (
                <>
                  <rect
                    x={onRight ? topic.cx - dotR - 2 : topic.cx - labelW}
                    y={topic.cy - hitH / 2}
                    width={labelW + dotR + 4}
                    height={hitH}
                    fill="transparent"
                  />
                  {dotContent}
                  {hov && (
                    <g onClick={() => { setHoveredTopic(null); setTooltip(null); removeTopic(topic.id); }} style={{ cursor: "pointer" }}>
                      <circle cx={topic.cx + dotR + 2} cy={topic.cy - dotR - 2} r={7} fill="#E05252" />
                      <text x={topic.cx + dotR + 2} y={topic.cy - dotR + 1} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff" style={{ pointerEvents: "none", userSelect: "none" }}>✕</text>
                    </g>
                  )}
                </>
              ) : (
                <a href={topic.href} target="_blank" rel="noopener noreferrer">
                  <rect
                    x={onRight ? topic.cx - dotR - 2 : topic.cx - labelW}
                    y={topic.cy - hitH / 2}
                    width={labelW + dotR + 4}
                    height={hitH}
                    fill="transparent"
                  />
                  {dotContent}
                </a>
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Floating tooltip ────────────────────────────────────── */}
      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x + 14,
          top: tooltip.y - 14,
          background: "#0E1120",
          border: `1px solid ${tooltip.color}55`,
          borderLeft: `3px solid ${tooltip.color}`,
          color: tooltip.color,
          padding: "6px 12px",
          borderRadius: "2px",
          fontSize: 12,
          fontFamily: "'DM Mono','Fira Mono',monospace",
          pointerEvents: "none",
          zIndex: 500,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        }}>
          {tooltip.label}
          <div style={{ fontSize: 10, color: "#4A5470", marginTop: 3 }}>click to open →</div>
        </div>
      )}

      {/* ── Hint text ────────────────────────────────────────────── */}
      {!filter && !editMode && (
        <div style={{ fontSize: 11, color: "#2A3450", fontFamily: "'DM Mono','Fira Mono',monospace", marginTop: -4 }}>
          hover a dot to see its label · filter by category to show all labels
        </div>
      )}

      {/* ── Edit: Add Link button ─────────────────────────────────── */}
      {editMode && (
        <button onClick={() => setShowAddModal(true)} style={{ background: "#4EAEFF22", border: "1px solid #4EAEFF66", color: "#4EAEFF", padding: "8px 28px", borderRadius: "2px", fontFamily: "'DM Mono','Fira Mono',monospace", fontSize: 12, cursor: "pointer" }}>
          + Add Link
        </button>
      )}

      {showAddModal && (
        <AddLinkModal
          categories={radarData.categories}
          allTopics={topics}
          onAdd={t => { addTopic(t); setShowAddModal(false); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
