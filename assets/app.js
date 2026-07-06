// ── PROJECT DATA ──────────────────────────────────────────────────────────
// status: 'active' | 'wip' | 'completed' | 'paused' | 'abandoned' | 'seasonal'
const PROJECTS = [
  {
    category: "Games",
    items: [
      {
        icon: "🎮",
        title: "Zeryndra",
        subtitle: "Solo-developed pixel art RPG",
        desc: "A top-down tile-based open world RPG in early development. Features story, progression, combat, skilling, and management systems. Built in Godot with pixel art created in Aseprite.",
        status: "wip",
        statusLabel: "In Development",
        updated: null,
        href: "/Zeryndra/",
      },
      {
        icon: "⛏️",
        title: "Idle Worker",
        subtitle: "Browser idle/incremental game",
        desc: "Manage a team of workers assigned to skilling jobs (woodcutting, fishing, mining, cooking…) or combat. Level up workers and global skills, craft gear to boost performance, and progress through equipment tiers from bronze to godtier.",
        status: "paused",
        statusLabel: "On Hold",
        updated: null,
        href: "/idleworker/",
      },
      {
        icon: "🏋️",
        title: "Training Game",
        subtitle: "Daily real-world activity game",
        desc: "Build activity plans for real-life workouts, mark them done to earn XP and gold, then invest in businesses for passive income. Designed so real-world effort is always the most rewarding path.",
        status: "paused",
        statusLabel: "On Hold",
        updated: null,
        href: "/training-game/",
      },
    ],
  },
  {
    category: "Game Trackers",
    items: [
      {
        icon: "🎲",
        title: "OSRS Loot Simulator",
        subtitle: "Old School RuneScape",
        desc: "Simulate boss kills and see what loot you could have gotten. Roll drop tables using real OSRS Wiki rates, hunt for rare uniques, and share your luck. Boss support now, with raids, clues, minigames, and skilling pets planned.",
        status: "active",
        statusLabel: "Active",
        updated: null,
        href: "/osrslootsim/",
      },
      {
        icon: "🗡️",
        title: "SAO Re: Hollow Fragment Tracker",
        subtitle: "Sword Art Online Re: Hollow Fragment",
        desc: "A completion tracker for SAO Re: Hollow Fragment. Track hollow missions, floor bosses, character affection, implementations, and all 54 Steam achievements.",
        status: "completed",
        statusLabel: "Completed",
        updated: null,
        href: "/sword-art-online-re-hollow-fragment/docs/",
      },
      {
        icon: "💀",
        title: "OSRS Boss Tracker",
        subtitle: "Old School RuneScape",
        desc: "Set kill count goals for any OSRS boss and track your progress over time. Features a custom XP progression system with title unlocks from Level 1–999, goal history, and WiseOldMan API integration.",
        status: "completed",
        statusLabel: "Completed",
        updated: null,
        href: "/osrsbosstracker/",
      },
    ],
  },
  {
    category: "Archived",
    items: [
      {
        icon: "🏆",
        title: "OSRS Leagues VI",
        subtitle: "Old School RuneScape — Seasonal (Apr–Jun 2026)",
        desc: "A tracker and helper built for OSRS Leagues 6. Covers league-specific tasks, point tracking, and planning tools for the duration of the season. Temporary project — active while the league ran.",
        status: "abandoned",
        statusLabel: "Ended",
        updated: null,
        href: "/osrs-leagues-vi/",
      },
      {
        icon: "⚙️",
        title: "HySkills Builder",
        subtitle: "Hytale mod tool",
        desc: "A skill builder for the HySkills mod for Hytale. Lets users create and configure custom skills for the mod. Development ended when the mod's developer stopped working on the project.",
        status: "abandoned",
        statusLabel: "Abandoned",
        updated: null,
        href: "/hytale/hyskills/",
      },
    ],
  },
];
// ─────────────────────────────────────────────────────────────────────────

const STATUS_CLASS = {
  active:    'badge-active',
  wip:       'badge-wip',
  completed: 'badge-completed',
  paused:    'badge-paused',
  abandoned: 'badge-abandoned',
  seasonal:  'badge-seasonal',
};

const STATUS_DOT = {
  active:    '●',
  wip:       '◑',
  completed: '✔',
  paused:    '○',
  abandoned: '✕',
  seasonal:  '◈',
};

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderCard(p) {
  const statusClass = STATUS_CLASS[p.status] || 'badge-paused';
  const dot = STATUS_DOT[p.status] || '○';
  const dateStr = formatDate(p.updated);

  return `
    <a class="card" href="${p.href}">
      <div class="card-top">
        <div class="card-icon">${p.icon}</div>
        <div class="card-title-wrap">
          <div class="card-title">${p.title}</div>
          ${p.subtitle ? `<div class="card-subtitle">${p.subtitle}</div>` : ''}
        </div>
      </div>
      <p class="card-desc">${p.desc}</p>
      <div class="card-badges">
        <span class="badge ${statusClass}">${dot} ${p.statusLabel}</span>
        ${dateStr ? `<span class="badge badge-date">Updated ${dateStr}</span>` : ''}
      </div>
      <div class="card-footer">
        <span class="btn-open">
          Open
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </span>
      </div>
    </a>`;
}

function renderAll() {
  const main = document.getElementById('main');
  main.innerHTML = PROJECTS.map(cat => `
    <section class="category">
      <div class="category-header">
        <span class="category-title">${cat.category}</span>
        <span class="category-line"></span>
        <span class="category-count">${cat.items.length} project${cat.items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="card-grid">
        ${cat.items.map(renderCard).join('')}
      </div>
    </section>
  `).join('');
}

renderAll();
