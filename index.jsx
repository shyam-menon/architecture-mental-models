import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Radar from "./Radar.jsx";
import radarData from "./radar.json";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/YOUR_USERNAME/mental-models/main/models.json";

const CATEGORY_META = {
  tradeoff:   { label: "Tradeoff",    color: "#E8A838", glyph: "⇌" },
  failure:    { label: "Failure",     color: "#E05252", glyph: "✕" },
  scale:      { label: "Scale",       color: "#4EAEFF", glyph: "↑" },
  emergence:  { label: "Emergence",   color: "#7EC87E", glyph: "◎" },
  cognitive:  { label: "Cognitive",   color: "#B57BFF", glyph: "⊙" },
  "ai-specific": { label: "AI-Specific", color: "#FF7EC8", glyph: "⚡" },
};

const SEED_URL_KEY = "mm_github_url";

// ─── FORCE LAYOUT ─────────────────────────────────────────────────────────────

function useForceLayout(models, width, height) {
  const [positions, setPositions] = useState({});
  const frameRef = useRef(null);

  useEffect(() => {
    if (!models.length || !width || !height) return;

    // Initialize positions
    const pos = {};
    models.forEach((m, i) => {
      const angle = (i / models.length) * 2 * Math.PI;
      const r = Math.min(width, height) * 0.3;
      pos[m.id] = {
        x: width / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 60,
        y: height / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 60,
        vx: 0, vy: 0,
      };
    });

    let current = { ...pos };
    let iter = 0;
    const maxIter = 300;

    // Build edge set
    const edges = [];
    models.forEach(m => {
      (m.connects_to || []).forEach(target => {
        if (models.find(x => x.id === target)) {
          edges.push([m.id, target]);
        }
      });
    });

    const tick = () => {
      if (iter++ > maxIter) return;

      const next = {};
      models.forEach(m => {
        next[m.id] = { ...current[m.id] };
      });

      // Repulsion
      models.forEach((a, i) => {
        models.forEach((b, j) => {
          if (i >= j) return;
          const dx = current[a.id].x - current[b.id].x;
          const dy = current[a.id].y - current[b.id].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 6000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          next[a.id].vx += fx;
          next[a.id].vy += fy;
          next[b.id].vx -= fx;
          next[b.id].vy -= fy;
        });
      });

      // Attraction (springs along edges)
      edges.forEach(([aid, bid]) => {
        const a = current[aid], b = current[bid];
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ideal = 200;
        const force = (dist - ideal) * 0.04;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        next[aid].vx += fx;
        next[aid].vy += fy;
        next[bid].vx -= fx;
        next[bid].vy -= fy;
      });

      // Center gravity
      models.forEach(m => {
        next[m.id].vx += (width / 2 - current[m.id].x) * 0.005;
        next[m.id].vy += (height / 2 - current[m.id].y) * 0.005;
      });

      // Integrate + damp
      const pad = 80;
      models.forEach(m => {
        const n = next[m.id];
        n.vx *= 0.7;
        n.vy *= 0.7;
        n.x = Math.max(pad, Math.min(width - pad, current[m.id].x + n.vx));
        n.y = Math.max(pad, Math.min(height - pad, current[m.id].y + n.vy));
      });

      current = next;
      setPositions({ ...current });
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [models, width, height]);

  return positions;
}

// ─── MODEL CARD ───────────────────────────────────────────────────────────────

function ModelCard({ model, onClose, onNavigate, allModels }) {
  const meta = CATEGORY_META[model.category] || {};
  const connections = (model.connects_to || [])
    .map(id => allModels.find(m => m.id === id))
    .filter(Boolean);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(8,10,18,0.85)", backdropFilter: "blur(6px)",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0E1120",
          border: `1px solid ${meta.color}44`,
          borderTop: `3px solid ${meta.color}`,
          borderRadius: "2px",
          maxWidth: 620, width: "100%",
          maxHeight: "85vh", overflowY: "auto",
          padding: "32px",
          fontFamily: "'DM Mono', 'Fira Mono', monospace",
          boxShadow: `0 0 60px ${meta.color}22, 0 20px 60px rgba(0,0,0,0.6)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{
                background: meta.color + "22", color: meta.color,
                padding: "3px 10px", borderRadius: "2px",
                fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
              }}>
                {meta.glyph} {meta.label}
              </span>
            </div>
            <h2 style={{ margin: 0, color: "#F0F4FF", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {model.name}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#666",
            cursor: "pointer", fontSize: 20, padding: "0 4px",
          }}>✕</button>
        </div>

        {/* Fields */}
        {[
          { label: "First Principle", value: model.first_principle },
          { label: "Derived From", value: model.derived_from },
          { label: "When It Applies", value: model.when_applies },
          { label: "When It Breaks Down", value: model.when_breaks_down },
          { label: "AI / Architecture Application", value: model.ai_application, highlight: true },
        ].map(({ label, value, highlight }) => (
          <div key={label} style={{ marginBottom: 18 }}>
            <div style={{
              color: highlight ? meta.color : "#555",
              fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
              marginBottom: 6,
            }}>{label}</div>
            <div style={{
              color: highlight ? "#E8F0FF" : "#B0BAD0",
              fontSize: 14, lineHeight: 1.65,
              background: highlight ? meta.color + "0A" : "transparent",
              padding: highlight ? "10px 14px" : "0",
              borderLeft: highlight ? `2px solid ${meta.color}66` : "none",
              borderRadius: "1px",
            }}>{value}</div>
          </div>
        ))}

        {/* Tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {(model.tags || []).map(tag => (
            <span key={tag} style={{
              background: "#1A1F35", color: "#5B6A8A",
              padding: "3px 9px", borderRadius: "2px", fontSize: 11,
            }}>#{tag}</span>
          ))}
        </div>

        {/* Connections */}
        {connections.length > 0 && (
          <div>
            <div style={{ color: "#555", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              Connects To
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {connections.map(c => {
                const cm = CATEGORY_META[c.category] || {};
                return (
                  <button key={c.id} onClick={() => onNavigate(c)} style={{
                    background: cm.color + "15", border: `1px solid ${cm.color}44`,
                    color: cm.color, padding: "5px 12px", borderRadius: "2px",
                    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NODE ─────────────────────────────────────────────────────────────────────

function Node({ model, x, y, selected, dimmed, onClick }) {
  const meta = CATEGORY_META[model.category] || {};
  const [hovered, setHovered] = useState(false);
  const size = selected ? 14 : hovered ? 11 : 9;

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: "pointer", opacity: dimmed ? 0.2 : 1, transition: "opacity 0.2s" }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Glow ring */}
      {(hovered || selected) && (
        <circle r={size + 8} fill={meta.color + "18"} />
      )}
      <circle
        r={size}
        fill={selected ? meta.color : meta.color + "33"}
        stroke={meta.color}
        strokeWidth={selected ? 2 : 1.5}
      />
      {/* Label */}
      <text
        y={size + 14}
        textAnchor="middle"
        style={{
          fill: selected || hovered ? "#F0F4FF" : "#7A8AAA",
          fontSize: selected || hovered ? 11 : 10,
          fontFamily: "'DM Mono', 'Fira Mono', monospace",
          fontWeight: selected ? 600 : 400,
          pointerEvents: "none",
          transition: "all 0.15s",
        }}
      >
        {model.name.length > 20 ? model.name.slice(0, 18) + "…" : model.name}
      </text>
    </g>
  );
}

// ─── GRAPH ────────────────────────────────────────────────────────────────────

function Graph({ models, filter, onSelect, selected }) {
  const svgRef = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const e = entries[0].contentRect;
      setDims({ w: e.width, h: e.height });
    });
    if (svgRef.current) ro.observe(svgRef.current.parentElement);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(
    () => filter === "all" ? models : models.filter(m => m.category === filter),
    [models, filter]
  );

  const positions = useForceLayout(filtered, dims.w, dims.h);

  const edges = useMemo(() => {
    const result = [];
    filtered.forEach(m => {
      (m.connects_to || []).forEach(tid => {
        if (filtered.find(x => x.id === tid) && m.id < tid) {
          result.push([m.id, tid]);
        }
      });
    });
    return result;
  }, [filtered]);

  const connectedIds = useMemo(() => {
    if (!selected) return new Set();
    const s = new Set([selected.id]);
    (selected.connects_to || []).forEach(id => s.add(id));
    filtered.forEach(m => {
      if ((m.connects_to || []).includes(selected.id)) s.add(m.id);
    });
    return s;
  }, [selected, filtered]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <defs>
        {Object.entries(CATEGORY_META).map(([k, v]) => (
          <filter key={k} id={`glow-${k}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
      </defs>

      {/* Edges */}
      {edges.map(([aid, bid]) => {
        const a = positions[aid], b = positions[bid];
        if (!a || !b) return null;
        const isHighlighted = selected && connectedIds.has(aid) && connectedIds.has(bid);
        return (
          <line
            key={`${aid}-${bid}`}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={isHighlighted ? "#4EAEFF" : "#2A3050"}
            strokeWidth={isHighlighted ? 1.5 : 0.8}
            opacity={isHighlighted ? 0.8 : 0.4}
            style={{ transition: "all 0.2s" }}
          />
        );
      })}

      {/* Nodes */}
      {filtered.map(m => {
        const pos = positions[m.id];
        if (!pos) return null;
        return (
          <Node
            key={m.id}
            model={m}
            x={pos.x}
            y={pos.y}
            selected={selected?.id === m.id}
            dimmed={selected && !connectedIds.has(m.id)}
            onClick={() => onSelect(m)}
          />
        );
      })}
    </svg>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

function Sidebar({ models }) {
  const counts = useMemo(() => {
    const c = {};
    models.forEach(m => { c[m.category] = (c[m.category] || 0) + 1; });
    return c;
  }, [models]);

  return (
    <div style={{
      width: 200, padding: "20px 16px",
      borderRight: "1px solid #1A2030",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{
        color: "#3A4460", fontSize: 10, letterSpacing: "0.15em",
        textTransform: "uppercase", marginBottom: 8,
      }}>Categories</div>
      {Object.entries(CATEGORY_META).map(([key, meta]) => (
        <div key={key} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "5px 8px",
          borderLeft: `2px solid ${meta.color}`,
          background: meta.color + "08",
        }}>
          <span style={{ color: meta.color, fontSize: 12 }}>{meta.glyph} {meta.label}</span>
          <span style={{ color: "#3A4460", fontSize: 11 }}>{counts[key] || 0}</span>
        </div>
      ))}
      <div style={{
        marginTop: 16, paddingTop: 16, borderTop: "1px solid #1A2030",
        color: "#3A4460", fontSize: 11,
      }}>
        {models.length} models total
      </div>
    </div>
  );
}

// ─── SETTINGS MODAL ───────────────────────────────────────────────────────────

function SettingsModal({ onClose, onLoad }) {
  const [url, setUrl] = useState(() => localStorage.getItem(SEED_URL_KEY) || GITHUB_RAW_URL);
  const [status, setStatus] = useState(null);

  const handleLoad = async () => {
    setStatus("loading");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.models?.length) throw new Error("No models found");
      localStorage.setItem(SEED_URL_KEY, url);
      onLoad(data.models);
      setStatus("ok");
      setTimeout(onClose, 800);
    } catch (e) {
      setStatus(`error: ${e.message}`);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(8,10,18,0.9)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#0E1120", border: "1px solid #1E2640",
        borderTop: "3px solid #4EAEFF", borderRadius: "2px",
        padding: "28px 32px", maxWidth: 520, width: "90%",
        fontFamily: "'DM Mono', 'Fira Mono', monospace",
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 6px", color: "#F0F4FF", fontSize: 16, fontWeight: 600 }}>
          Load from GitHub
        </h3>
        <p style={{ margin: "0 0 20px", color: "#556080", fontSize: 12, lineHeight: 1.6 }}>
          Paste the raw GitHub URL to your <code style={{ color: "#4EAEFF" }}>models.json</code> file.
          The URL is saved locally so you can reload at any time.
        </p>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          style={{
            width: "100%", background: "#080A12", border: "1px solid #2A3050",
            color: "#B0BAD0", padding: "10px 12px", borderRadius: "2px",
            fontFamily: "inherit", fontSize: 12, marginBottom: 12,
            boxSizing: "border-box",
          }}
          placeholder="https://raw.githubusercontent.com/..."
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={handleLoad} style={{
            background: "#4EAEFF22", border: "1px solid #4EAEFF66",
            color: "#4EAEFF", padding: "8px 20px", borderRadius: "2px",
            fontFamily: "inherit", fontSize: 12, cursor: "pointer",
          }}>
            {status === "loading" ? "Loading…" : "Load Models"}
          </button>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #2A3050",
            color: "#556080", padding: "8px 20px", borderRadius: "2px",
            fontFamily: "inherit", fontSize: 12, cursor: "pointer",
          }}>Cancel</button>
          {status && status !== "loading" && (
            <span style={{ fontSize: 12, color: status === "ok" ? "#7EC87E" : "#E05252" }}>
              {status === "ok" ? "✓ Loaded" : status}
            </span>
          )}
        </div>
        <div style={{ marginTop: 20, borderTop: "1px solid #1A2030", paddingTop: 16 }}>
          <div style={{ color: "#3A4460", fontSize: 11, marginBottom: 8 }}>GitHub Raw URL format:</div>
          <code style={{ color: "#4EAEFF88", fontSize: 10, lineHeight: 1.7, display: "block" }}>
            https://raw.githubusercontent.com/<br />
            &nbsp;&nbsp;YOUR_USERNAME/YOUR_REPO/main/models.json
          </code>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [models, setModels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Radar view state ────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState("graph");
  const [radarFilter, setRadarFilter] = useState(null);
  const [radarSearch, setRadarSearch] = useState("");
  const [radarEditMode, setRadarEditMode] = useState(false);

  const handleSetView = (view) => {
    setActiveView(view);
    if (view === "radar") setSelected(null);
    if (view === "graph") setRadarEditMode(false);
  };

  // Load embedded seed on first mount
  useEffect(() => {
    const load = async () => {
      const savedUrl = localStorage.getItem(SEED_URL_KEY);
      if (savedUrl && savedUrl !== GITHUB_RAW_URL) {
        try {
          const res = await fetch(savedUrl);
          const data = await res.json();
          if (data.models?.length) { setModels(data.models); setLoading(false); return; }
        } catch (_) {}
      }
      // Fall back to embedded seed
      try {
        const res = await fetch("./models.json");
        const data = await res.json();
        setModels(data.models || []);
      } catch (_) {
        // If no local file, show empty state
        setModels([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const displayModels = useMemo(() => {
    let list = filter === "all" ? models : models.filter(m => m.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.first_principle.toLowerCase().includes(q) ||
        (m.tags || []).some(t => t.includes(q))
      );
    }
    return list;
  }, [models, filter, search]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#080A12", color: "#F0F4FF",
      fontFamily: "'DM Mono', 'Fira Mono', monospace",
      overflow: "hidden",
    }}>
      {/* Top Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52,
        borderBottom: "1px solid #1A2030",
        background: "#0A0C18",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#4EAEFF",
              boxShadow: "0 0 8px #4EAEFF",
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", color: "#E0E8FF" }}>
              MENTAL MODELS
            </span>
            <span style={{ color: "#3A4460", fontSize: 11 }}>/ architecture + AI</span>
          </div>

          {/* ── View toggle ───────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 0, marginLeft: 12, border: "1px solid #1E2640", borderRadius: "2px", overflow: "hidden", flexShrink: 0 }}>
            {[["graph", "⬡ Graph"], ["radar", "◎ Radar"]].map(([view, label], i) => (
              <button
                key={view}
                onClick={() => handleSetView(view)}
                style={{
                  background: activeView === view ? "#4EAEFF22" : "none",
                  border: "none",
                  borderRight: i === 0 ? "1px solid #1E2640" : "none",
                  color: activeView === view ? "#4EAEFF" : "#4A5470",
                  padding: "3px 12px",
                  fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >{label}</button>
            ))}
          </div>

          {/* ── Context-sensitive filter pills ───────────────────────── */}
          <div style={{ display: "flex", gap: 4, marginLeft: 8, flexWrap: "nowrap", overflowX: "auto" }}>
            {activeView === "graph" ? (
              [["all", "All", "#4EAEFF"], ...Object.entries(CATEGORY_META).map(([k, v]) => [k, v.glyph, v.color])].map(([key, label, color]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    background: filter === key ? color + "22" : "none",
                    border: `1px solid ${filter === key ? color + "88" : "#1E2640"}`,
                    color: filter === key ? color : "#4A5470",
                    padding: "3px 10px", borderRadius: "2px",
                    fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s", flexShrink: 0,
                  }}
                >{label}</button>
              ))
            ) : (
              [[null, "All", "#4EAEFF"], ...radarData.categories.map(c => [c.id, c.short, c.color])].map(([catId, label, color]) => {
                const isActive = radarFilter === catId;
                return (
                  <button
                    key={catId ?? "all"}
                    onClick={() => setRadarFilter(catId)}
                    style={{
                      background: isActive ? color + "22" : "none",
                      border: `1px solid ${isActive ? color + "88" : "#1E2640"}`,
                      color: isActive ? color : "#4A5470",
                      padding: "3px 10px", borderRadius: "2px",
                      fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.15s", flexShrink: 0,
                    }}
                  >{label}</button>
                );
              })
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* ── Context-sensitive search + edit toggle ─────────────────── */}
          {activeView === "graph" ? (
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="search models…"
              style={{
                background: "#0E1120", border: "1px solid #1E2640",
                color: "#B0BAD0", padding: "5px 12px", borderRadius: "2px",
                fontFamily: "inherit", fontSize: 11, width: 180, outline: "none",
              }}
            />
          ) : (
            <>
              <input
                value={radarSearch}
                onChange={e => setRadarSearch(e.target.value)}
                placeholder="search resources…"
                style={{
                  background: "#0E1120", border: "1px solid #1E2640",
                  color: "#B0BAD0", padding: "5px 12px", borderRadius: "2px",
                  fontFamily: "inherit", fontSize: 11, width: 180, outline: "none",
                }}
              />
              <button
                onClick={() => setRadarEditMode(v => !v)}
                style={{
                  background: radarEditMode ? "#4EAEFF22" : "none",
                  border: `1px solid ${radarEditMode ? "#4EAEFF88" : "#1E2640"}`,
                  color: radarEditMode ? "#4EAEFF" : "#4A5470",
                  padding: "5px 12px", borderRadius: "2px",
                  fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                }}
              >✎ Edit</button>
            </>
          )}
          <button onClick={() => setShowSettings(true)} style={{
            background: "none", border: "1px solid #1E2640",
            color: "#4A5470", padding: "5px 12px", borderRadius: "2px",
            fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}>⊕ GitHub</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {activeView === "radar" ? (
          <Radar
            filter={radarFilter}
            search={radarSearch}
            editMode={radarEditMode}
          />
        ) : (
          <>
        <Sidebar models={models} />
        <div style={{ flex: 1, position: "relative" }}>
          {loading ? (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#3A4460", fontSize: 13,
            }}>Loading models…</div>
          ) : displayModels.length === 0 ? (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 12,
            }}>
              <div style={{ color: "#3A4460", fontSize: 13 }}>No models found.</div>
              <button onClick={() => setShowSettings(true)} style={{
                background: "#4EAEFF11", border: "1px solid #4EAEFF44",
                color: "#4EAEFF", padding: "8px 18px", borderRadius: "2px",
                fontFamily: "inherit", fontSize: 12, cursor: "pointer",
              }}>Load from GitHub</button>
            </div>
          ) : (
            <Graph
              models={displayModels}
              filter={filter}
              onSelect={m => setSelected(selected?.id === m.id ? null : m)}
              selected={selected}
            />
          )}

          {/* Bottom status bar */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "6px 16px",
            background: "#0A0C18",
            borderTop: "1px solid #1A2030",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 10, color: "#3A4460",
          }}>
            <span>
              showing {displayModels.length} of {models.length} models
              {selected && <> · selected: <span style={{ color: "#4EAEFF" }}>{selected.name}</span></>}
            </span>
            <span>click node to explore · click again to open detail</span>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Detail panel — graph view only */}
      {activeView === "graph" && selected && (
        <div
          style={{
            position: "absolute", right: 0, top: 52, bottom: 24,
            width: 380, background: "#0A0C18",
            borderLeft: "1px solid #1A2030",
            overflowY: "auto", zIndex: 50,
            padding: "20px",
          }}
        >
          {(() => {
            const meta = CATEGORY_META[selected.category] || {};
            const connections = (selected.connects_to || [])
              .map(id => models.find(m => m.id === id))
              .filter(Boolean);
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{
                    background: meta.color + "22", color: meta.color,
                    padding: "3px 10px", borderRadius: "2px",
                    fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                  }}>{meta.glyph} {meta.label}</span>
                  <button onClick={() => setSelected(null)} style={{
                    background: "none", border: "none", color: "#444",
                    cursor: "pointer", fontSize: 16,
                  }}>✕</button>
                </div>
                <h3 style={{ margin: "0 0 16px", color: "#F0F4FF", fontSize: 16, fontWeight: 600 }}>
                  {selected.name}
                </h3>
                {[
                  { label: "First Principle", value: selected.first_principle },
                  { label: "Derived From", value: selected.derived_from },
                  { label: "When It Applies", value: selected.when_applies },
                  { label: "Breaks Down When", value: selected.when_breaks_down },
                  { label: "AI / Architecture", value: selected.ai_application, highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{
                      color: highlight ? meta.color : "#445",
                      fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4,
                    }}>{label}</div>
                    <div style={{
                      color: highlight ? "#DDE8FF" : "#8090B0",
                      fontSize: 12, lineHeight: 1.65,
                      borderLeft: highlight ? `2px solid ${meta.color}66` : "none",
                      paddingLeft: highlight ? 10 : 0,
                    }}>{value}</div>
                  </div>
                ))}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                  {(selected.tags || []).map(t => (
                    <span key={t} style={{
                      background: "#141828", color: "#445870",
                      padding: "2px 8px", borderRadius: "2px", fontSize: 10,
                    }}>#{t}</span>
                  ))}
                </div>
                {connections.length > 0 && (
                  <>
                    <div style={{ color: "#334", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                      Connected Models
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {connections.map(c => {
                        const cm = CATEGORY_META[c.category] || {};
                        return (
                          <button key={c.id} onClick={() => setSelected(c)} style={{
                            background: cm.color + "12", border: `1px solid ${cm.color}33`,
                            color: cm.color, padding: "4px 10px", borderRadius: "2px",
                            fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                          }}>{c.name}</button>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onLoad={newModels => { setModels(newModels); setShowSettings(false); }}
        />
      )}
    </div>
  );
}
