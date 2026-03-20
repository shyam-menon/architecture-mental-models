# Mental Models — Architecture & AI Systems

A personal repository of first-principles mental models for software architects and AI systems builders.

## Philosophy

A mental model is only useful if it's:
- **Transferable** — applies across domains, not just "use a queue here"
- **Predictive** — tells you what will break *before* it breaks
- **Composable** — models combine to reason about complex systems
- **Falsifiable** — you can tell when it doesn't apply

This repo is the source of truth. The interactive graph visualization fetches directly from here.

---

## Repo Structure

```
mental-models/
├── models.json          ← source of truth (edit this to add models)
├── README.md
└── schema.md            ← field definitions and contribution guide
```

---

## Adding a Model

Edit `models.json` and add an entry to the `models` array. Every model follows this schema:

```json
{
  "id": "unique-kebab-case-id",
  "name": "Human Readable Name",
  "category": "tradeoff | failure | scale | emergence | cognitive | ai-specific",
  "first_principle": "One sentence: the core truth this model encodes.",
  "derived_from": "Where this came from — person, paper, field of study.",
  "when_applies": "The conditions under which this model is useful.",
  "when_breaks_down": "The conditions under which this model misleads you.",
  "ai_application": "Concrete application to AI systems or software architecture.",
  "connects_to": ["other-model-id", "another-model-id"],
  "tags": ["tag1", "tag2"]
}
```

### Categories

| Category | Symbol | Description |
|---|---|---|
| `tradeoff` | ⇌ | Things fundamentally in tension — you can't have all of them |
| `failure` | ✕ | How systems break and why |
| `scale` | ↑ | Behavior that changes nonlinearly with size |
| `emergence` | ◎ | System behavior that differs from its parts |
| `cognitive` | ⊙ | How humans reason about and build systems |
| `ai-specific` | ⚡ | Unique to probabilistic / learning systems |

---

## Using the Visualizer

The interactive graph is a React app. You can:

1. **Run it locally** — clone this repo and open `index.jsx` in a React environment (e.g., Vite or the Claude artifact renderer)
2. **Point it at GitHub** — paste your GitHub raw URL into the ⊕ GitHub button in the top-right corner:
   ```
   https://raw.githubusercontent.com/YOUR_USERNAME/mental-models/main/models.json
   ```
   The URL is saved locally so it auto-loads on next visit.

---

## Workflow: Growing the Repository

```
Encounter a problem or pattern
         ↓
Ask: "What model explains this?"
         ↓
If the model exists → add a real-world example to the connects_to graph
If it doesn't exist → add a new entry to models.json
         ↓
Push to GitHub
         ↓
Hit "Load from GitHub" in the visualizer → graph updates
```

The `connects_to` field is what turns a flat list into a graph. Always link new models to at least two existing ones.

---

## Seed Models (v1.0.0)

20 models across 6 categories. See `models.json` for the full dataset.

| Model | Category |
|---|---|
| CAP Theorem | Tradeoff |
| Conway's Law | Emergence |
| Chesterton's Fence | Cognitive |
| Leaky Abstractions | Failure |
| Fallacies of Distributed Computing | Failure |
| Two-Pizza Rule | Scale |
| Amdahl's Law | Scale |
| Little's Law | Scale |
| Second System Effect | Cognitive |
| Circuit Breaker | Failure |
| Eventual Consistency | Tradeoff |
| Goodhart's Law | Emergence |
| Distribution Shift | AI-Specific |
| Exploration-Exploitation Tradeoff | AI-Specific |
| Local vs. Global Optima | Cognitive |
| Survivorship Bias | Cognitive |
| Two Generals Problem | Failure |
| The Alignment Tax | AI-Specific |
| Feedback Loops | Emergence |
| Zero-One-Infinity Rule | Tradeoff |
