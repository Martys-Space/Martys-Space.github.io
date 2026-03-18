// Wise Old Man API Base URL
const API_BASE_URL = 'https://api.wiseoldman.net/v2';

// Boss names mapping
const BOSS_ACTIVITIES = [
    'abyssal_sire', 'alchemical_hydra', 'amoxliatl', 'araxxor', 'artio', 'barrows_chests', 'bryophyta',
    'callisto', 'calvarion', 'cerberus', 'chambers_of_xeric', 'chambers_of_xeric_challenge_mode',
    'chaos_elemental', 'chaos_fanatic', 'commander_zilyana', 'corporeal_beast', 'crazy_archaeologist',
    'dagannoth_prime', 'dagannoth_rex', 'dagannoth_supreme', 'deranged_archaeologist', 'doom_of_mokhaiotl',
    'duke_sucellus', 'lunar_chests', 'general_graardor', 'giant_mole', 'grotesque_guardians', 'hespori',
    'the_hueycoatl', 'kalphite_queen', 'king_black_dragon', 'kraken', 'kreearra', 'kril_tsutsaroth',
    'mimic', 'nex', 'nightmare', 'phosanis_nightmare', 'obor', 'phantom_muspah', 'the_royal_titans',
    'sarachnis', 'scorpia', 'scurrius', 'shellbane_gryphon', 'skotizo', 'sol_heredit', 'spindel',
    'tempoross', 'the_gauntlet', 'the_corrupted_gauntlet', 'the_leviathan', 'the_whisperer',
    'theatre_of_blood', 'theatre_of_blood_hard_mode', 'thermonuclear_smoke_devil', 'tombs_of_amascut',
    'tombs_of_amascut_expert', 'tzkal_zuk', 'tztok_jad', 'vardorvis', 'venenatis', 'vetion',
    'vorkath', 'wintertodt', 'yama', 'zalcano', 'zulrah'
];

// Level System Constants
const MAX_LEVEL = 999;
const XP_MAX = 13034431;
const EXPONENT = 1.4;

// Boss Points Data (will be loaded from bossPoints.json)
let bossPointsData = {};

// Titles Data (will be loaded from titles.json)
let titlesData = [];
let currentTitleId = 'novice';

// State
let currentUsername = null;
let currentGoals = [];
let currentFilter = 'active';
let editingGoalId = null;
let currentPlayerData = null;
let currentPlayerType = 'regular';
let userSettings = {
    dateFormat: 'default',
    showLevel: true,
    showUsernameWithTitle: true
};

// DOM Elements
const usernameInput = document.getElementById('usernameInput');
const submitUsername = document.getElementById('submitUsername');
const changeUsername = document.getElementById('changeUsername');
const displayUsername = document.getElementById('displayUsername');
const gamemodeDisplay = document.getElementById('gamemodeDisplay');
const mainHeader = document.getElementById('mainHeader');
const usernameSection = document.getElementById('usernameSection');
const compactHeader = document.getElementById('compactHeader');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingText = document.getElementById('loadingText');
const errorMessage = document.getElementById('errorMessage');
const mainContent = document.getElementById('mainContent');
const goalsOverview = document.getElementById('goalsOverview');
const goalDetailView = document.getElementById('goalDetailView');
const goalsList = document.getElementById('goalsList');
const emptyGoals = document.getElementById('emptyGoals');
const createGoalBtn = document.getElementById('createGoalBtn');
const goalModal = document.getElementById('goalModal');
const closeModal = document.getElementById('closeModal');
const cancelGoal = document.getElementById('cancelGoal');
const goalForm = document.getElementById('goalForm');
const backToOverview = document.getElementById('backToOverview');
const showHiddenGoals = document.getElementById('showHiddenGoals');
const hiddenGoalsModal = document.getElementById('hiddenGoalsModal');
const closeHiddenModal = document.getElementById('closeHiddenModal');
const modalTitle = document.getElementById('modalTitle');
const saveGoal = document.getElementById('saveGoal');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const saveSettingsBtn = document.getElementById('saveSettings');
const dateFormatSelect = document.getElementById('dateFormat');

// Utility Functions
function formatBossName(bossKey) {
    return bossKey.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const format = userSettings.dateFormat;

    switch (format) {
        case 'dmy':
            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        case 'ymd':
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        case 'long':
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        case 'default':
        default:
            return date.toLocaleDateString('en-US');
    }
}

function getGamemodeDisplay(playerType) {
    const gamemodes = {
        'ironman': '⚔️ Ironman',
        'hardcore': '💀 Hardcore Ironman',
        'ultimate': '🔥 Ultimate Ironman',
        'group_ironman': '👥 Group Ironman'
    };
    return gamemodes[playerType] || null;
}

function showError(message, isError = true) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.style.backgroundColor = isError ? 'var(--error-color)' : 'var(--success-color)';
    errorMessage.style.color = isError ? '#fff' : '#fff';
    setTimeout(() => { errorMessage.style.display = 'none'; }, 5000);
}

function hideError() {
    errorMessage.style.display = 'none';
}

function showLoading(show, text = 'Loading...') {
    loadingText.textContent = text;
    loadingIndicator.style.display = show ? 'block' : 'none';
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Level System Functions
function getXPForLevel(level) {
    if (level < 1) return 0;
    if (level >= MAX_LEVEL) return XP_MAX;
    const progress = (level - 1) / (MAX_LEVEL - 1);
    return Math.round(XP_MAX * Math.pow(progress, EXPONENT));
}

function getLevelFromXP(xp) {
    if (xp <= 0) return 1;
    if (xp >= XP_MAX) return MAX_LEVEL;

    let low = 1;
    let high = MAX_LEVEL;

    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const progress = (mid - 1) / (MAX_LEVEL - 1);
        const midXP = Math.round(XP_MAX * Math.pow(progress, EXPONENT));

        if (xp >= midXP) low = mid;
        else high = mid - 1;
    }

    return low;
}

function getLevelProgress(xp) {
    const level = getLevelFromXP(xp);

    const currXP = getXPForLevel(level);
    const nextXP = level < MAX_LEVEL ? getXPForLevel(level + 1) : currXP;

    const xpIntoLevel = xp - currXP;
    const xpNeededForNext = nextXP - currXP;
    const percent = xpNeededForNext > 0 ? (xpIntoLevel / xpNeededForNext) : 1;

    return {
        level,
        currXP,
        nextXP,
        xpIntoLevel,
        xpNeededForNext,
        percent: Math.max(0, Math.min(1, percent))
    };
}

function calculateTotalXP(playerData) {
    if (!playerData || !playerData.latestSnapshot) return 0;

    let totalXP = 0;
    const bosses = playerData.latestSnapshot.data.bosses;

    for (const [bossKey, bossData] of Object.entries(bosses)) {
        const kills = bossData.kills || 0;
        const pointsPerKC = bossPointsData[bossKey]?.points_per_kc || 0;
        totalXP += kills * pointsPerKC;
    }

    return totalXP;
}

async function loadBossPoints() {
    try {
        const response = await fetch('bossPoints.json');
        bossPointsData = await response.json();
    } catch (error) {
        console.error('Error loading boss points data:', error);
        bossPointsData = {};
    }
}

async function loadTitles() {
    try {
        const response = await fetch('titles.json');
        titlesData = await response.json();
    } catch (error) {
        console.error('Error loading titles data:', error);
        titlesData = [];
    }
}

// LocalStorage Functions
function saveGoalsToStorage(username, goals) {
    const key = `osrs_goals_${username.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(goals));
}

function loadGoalsFromStorage(username) {
    const key = `osrs_goals_${username.toLowerCase()}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

function saveUsername(username) {
    localStorage.setItem('osrs_current_username', username);
}

function loadSavedUsername() {
    return localStorage.getItem('osrs_current_username');
}

function saveSettings(settings) {
    localStorage.setItem('osrs_settings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('osrs_settings');
    return saved ? JSON.parse(saved) : {
        dateFormat: 'default',
        showLevel: true,
        showUsernameWithTitle: true
    };
}

function saveSelectedTitle(username, titleId) {
    const key = `osrs_title_${username.toLowerCase()}`;
    localStorage.setItem(key, titleId);
}

function loadSelectedTitle(username) {
    const key = `osrs_title_${username.toLowerCase()}`;
    return localStorage.getItem(key) || 'novice';
}

// API Functions
async function fetchPlayerData(username) {
    try {
        // Try to update player data first
        await fetch(`${API_BASE_URL}/players/${encodeURIComponent(username)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'OSRS-Boss-Goal-Tracker' }
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fetch player data
        const response = await fetch(`${API_BASE_URL}/players/${encodeURIComponent(username)}`, {
            headers: { 'User-Agent': 'OSRS-Boss-Goal-Tracker' }
        });

        if (!response.ok) {
            if (response.status === 404) throw new Error('Player not found. Please check the username.');
            if (response.status === 429) throw new Error('Too many requests. Please wait a moment.');
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching player data:', error);
        throw error;
    }
}

function getBossKillCount(playerData, bossKey) {
    if (!playerData || !playerData.latestSnapshot) return 0;
    const boss = playerData.latestSnapshot.data.bosses[bossKey];
    return boss ? boss.kills : 0;
}

// Username Management
async function handleSubmitUsername() {
    const username = usernameInput.value.trim();
    if (!username) {
        showError('Please enter a username.');
        return;
    }

    showLoading(true, 'Fetching player data...');

    try {
        const playerData = await fetchPlayerData(username);
        currentPlayerData = playerData;
        currentUsername = username;
        currentPlayerType = playerData.type || 'regular';
        saveUsername(username);

        displayUsername.textContent = username;

        // Update gamemode display
        const gamemodeText = getGamemodeDisplay(currentPlayerType);
        if (gamemodeText) {
            gamemodeDisplay.textContent = gamemodeText;
            gamemodeDisplay.style.display = 'inline-block';
        } else {
            gamemodeDisplay.style.display = 'none';
        }

        // Load user's selected title
        currentTitleId = loadSelectedTitle(username);

        // Calculate and display level
        const totalXP = calculateTotalXP(playerData);
        const levelProgress = getLevelProgress(totalXP);
        renderLevelDisplay(levelProgress, totalXP);

        // Hide main header and username section
        mainHeader.style.display = 'none';
        usernameSection.style.display = 'none';

        // Show compact header
        compactHeader.style.display = 'block';

        // Load goals for this user
        currentGoals = loadGoalsFromStorage(username);

        // Update all goals with current kill counts
        updateGoalsProgress();

        mainContent.style.display = 'block';
        renderGoalsOverview();
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function handleChangeUsername() {
    currentUsername = null;
    currentPlayerData = null;
    currentPlayerType = 'regular';
    currentGoals = [];
    usernameInput.value = '';

    // Clear cached boss KC data
    bossKCData = [];

    // Hide gamemode display
    if (gamemodeDisplay) {
        gamemodeDisplay.style.display = 'none';
    }

    // Reset to Active tab
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.main-tab[data-tab="active"]')?.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    const activeTab = document.getElementById('activeTabContent');
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = 'block';
    }

    // Show main header and username section
    mainHeader.style.display = 'block';
    usernameSection.style.display = 'block';

    // Hide compact header and main content
    compactHeader.style.display = 'none';
    mainContent.style.display = 'none';

    usernameInput.focus();
}

// Goals Management
function updateGoalsProgress() {
    if (!currentPlayerData) return;

    currentGoals.forEach(goal => {
        const currentKills = getBossKillCount(currentPlayerData, goal.boss);

        // Initialize progress tracking if not exists
        if (!goal.progressHistory) {
            goal.progressHistory = [];
        }

        // Add current snapshot to history
        const today = new Date().toISOString().split('T')[0];
        const lastEntry = goal.progressHistory[goal.progressHistory.length - 1];

        if (!lastEntry || lastEntry.date !== today) {
            goal.progressHistory.push({
                date: today,
                timestamp: Date.now(),
                kills: currentKills
            });
        } else {
            // Update today's entry
            lastEntry.kills = currentKills;
        }

        // Calculate progress
        goal.currentKills = currentKills;
        goal.startKills = goal.startKills || currentKills;
        goal.killsGained = goal.currentKills - goal.startKills;
        goal.progress = Math.min((goal.killsGained / goal.targetKills) * 100, 100);

        // Check if completed
        if (goal.killsGained >= goal.targetKills && goal.status === 'active') {
            goal.status = 'completed';
            goal.completedAt = Date.now();
        }

        // Calculate current milestone
        goal.currentMilestone = Math.floor(goal.killsGained / goal.milestoneInterval) * goal.milestoneInterval;
        goal.nextMilestone = goal.currentMilestone + goal.milestoneInterval;
    });

    saveGoalsToStorage(currentUsername, currentGoals);

    // Update level display with latest player data
    const totalXP = calculateTotalXP(currentPlayerData);
    const levelProgress = getLevelProgress(totalXP);
    renderLevelDisplay(levelProgress, totalXP);
}

// Goal CRUD Operations
function createGoal(goalData) {
    const goal = {
        id: generateId(),
        boss: goalData.boss,
        bossName: formatBossName(goalData.boss),
        targetKills: parseInt(goalData.targetKills),
        milestoneInterval: parseInt(goalData.milestoneInterval),
        status: 'active',
        hidden: false,
        createdAt: Date.now(),
        startKills: getBossKillCount(currentPlayerData, goalData.boss),
        currentKills: getBossKillCount(currentPlayerData, goalData.boss),
        killsGained: 0,
        progress: 0,
        currentMilestone: 0,
        nextMilestone: parseInt(goalData.milestoneInterval),
        progressHistory: [{
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            kills: getBossKillCount(currentPlayerData, goalData.boss)
        }]
    };

    currentGoals.push(goal);
    saveGoalsToStorage(currentUsername, currentGoals);
    return goal;
}

function updateGoal(goalId, updates) {
    const goalIndex = currentGoals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) return null;

    currentGoals[goalIndex] = { ...currentGoals[goalIndex], ...updates };
    saveGoalsToStorage(currentUsername, currentGoals);
    return currentGoals[goalIndex];
}

function deleteGoal(goalId) {
    currentGoals = currentGoals.filter(g => g.id !== goalId);
    saveGoalsToStorage(currentUsername, currentGoals);
}

function toggleGoalStatus(goalId, newStatus) {
    updateGoal(goalId, { status: newStatus });
    renderGoalsOverview();
}

function toggleGoalHidden(goalId, hidden) {
    updateGoal(goalId, { hidden });
    renderGoalsOverview();
}

// Level Display Function
function renderLevelDisplay(levelProgress, totalXP) {
    const levelDisplay = document.getElementById('levelDisplay');
    if (!levelDisplay) return;

    // Check visibility settings
    if (!userSettings.showLevel) {
        levelDisplay.style.display = 'none';
        return;
    } else {
        levelDisplay.style.display = 'block';
    }

    // Get current title
    const selectedTitle = titlesData.find(t => t.id === currentTitleId);
    const titleDisplay = selectedTitle ? formatTitleWithUsername(selectedTitle, currentUsername) : '';

    levelDisplay.innerHTML = `
        ${userSettings.showUsernameWithTitle && titleDisplay ? `
            <div class="username-title-display">
                <div class="username-title-text">${titleDisplay}</div>
            </div>
        ` : ''}
        <div class="level-info">
            <div class="level-number">Level ${levelProgress.level}</div>
            <div class="level-xp-text">${formatNumber(levelProgress.xpIntoLevel)} / ${formatNumber(levelProgress.xpNeededForNext)} XP</div>
        </div>
        <div class="level-progress-container">
            <div class="level-progress-bar" style="width: ${levelProgress.percent * 100}%"></div>
        </div>
        <div class="level-xp-total">Total XP: ${formatNumber(totalXP)}</div>
    `;
}

function formatTitleWithUsername(title, username) {
    if (!title || !username) return '';

    if (title.position === 'prefix') {
        return `<span class="title-prefix">${title.title}</span><span class="username">${username}</span>`;
    } else {
        return `<span class="username">${username}</span><span class="title-suffix">${title.title}</span>`;
    }
}

// Rendering Functions
function renderGoalsOverview() {
    // Render goals for each status
    renderGoalsForStatus('active');
    renderGoalsForStatus('paused');
    renderGoalsForStatus('completed');

    // Update hidden goals button
    const hiddenCount = currentGoals.filter(g => g.hidden).length;
    if (hiddenCount > 0) {
        showHiddenGoals.style.display = 'inline-block';
        showHiddenGoals.textContent = `Show Hidden Goals (${hiddenCount})`;
    } else {
        showHiddenGoals.style.display = 'none';
    }
}

function renderGoalsForStatus(status) {
    const filteredGoals = currentGoals.filter(goal => {
        if (goal.hidden) return false;
        return goal.status === status;
    });

    let listElement, emptyElement;

    if (status === 'active') {
        listElement = document.getElementById('goalsList');
        emptyElement = document.getElementById('emptyGoals');
    } else if (status === 'paused') {
        listElement = document.getElementById('goalsListPaused');
        emptyElement = document.getElementById('emptyGoalsPaused');
    } else {
        listElement = document.getElementById('goalsListCompleted');
        emptyElement = document.getElementById('emptyGoalsCompleted');
    }

    if (!listElement) return;

    listElement.innerHTML = '';

    if (filteredGoals.length === 0) {
        if (emptyElement) emptyElement.style.display = 'block';
        listElement.style.display = 'none';
    } else {
        if (emptyElement) emptyElement.style.display = 'none';
        listElement.style.display = 'grid';

        filteredGoals.forEach(goal => {
            const card = createGoalCard(goal);
            listElement.appendChild(card);
        });
    }
}

function createGoalCard(goal) {
    const card = document.createElement('div');
    card.className = `goal-card ${goal.status}`;

    const progressPercent = Math.min(goal.progress, 100).toFixed(1);

    // Calculate milestone info
    const totalMilestones = Math.ceil(goal.targetKills / goal.milestoneInterval);
    const completedMilestones = Math.floor(goal.killsGained / goal.milestoneInterval);
    const remainingToNextMilestone = goal.nextMilestone - goal.killsGained;

    // Calculate milestone progress percentage
    const milestoneProgress = Math.min(((goal.killsGained % goal.milestoneInterval) / goal.milestoneInterval) * 100, 100);

    // Calculate days since goal started
    const daysSinceStart = Math.floor((Date.now() - goal.createdAt) / (1000 * 60 * 60 * 24));

    card.innerHTML = `
        <div class="goal-header">
            <div class="goal-info">
                <h3>${goal.bossName}</h3>
                <div class="goal-timeframe">Day ${daysSinceStart}</div>
            </div>
            <div class="goal-header-right">
                <div class="goal-actions-compact">
                    <button class="btn-icon view-details" data-goal-id="${goal.id}" title="View Details">👁️</button>
                    ${goal.status === 'active' ? `<button class="btn-icon pause-goal" data-goal-id="${goal.id}" title="Pause">⏸️</button>` : ''}
                    ${goal.status === 'paused' ? `<button class="btn-icon resume-goal" data-goal-id="${goal.id}" title="Resume">▶️</button>` : ''}
                    <button class="btn-icon edit-goal" data-goal-id="${goal.id}" title="Edit">✏️</button>
                    <button class="btn-icon hide-goal" data-goal-id="${goal.id}" title="Hide">👁️‍🗨️</button>
                    <button class="btn-icon delete-goal" data-goal-id="${goal.id}" title="Delete">🗑️</button>
                </div>
                <span class="goal-status-badge ${goal.status}">${goal.status}</span>
            </div>
        </div>

        <div class="goal-progress">
            <div class="progress-text">
                <span>${formatNumber(goal.killsGained)} / ${formatNumber(goal.targetKills)} kills</span>
                <span>${progressPercent}%</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progressPercent}%">
                    ${progressPercent > 10 ? progressPercent + '%' : ''}
                </div>
            </div>
        </div>

        <div class="goal-milestone-compact">
            <div class="milestone-compact-header">
                <span class="milestone-compact-title">Milestones (${completedMilestones} / ${totalMilestones})</span>
            </div>
            <div class="milestone-compact-info">
                <span>Current: ${formatNumber(goal.killsGained % goal.milestoneInterval)} / ${formatNumber(goal.milestoneInterval)}</span>
                <span>${formatNumber(remainingToNextMilestone)} remaining</span>
            </div>
            <div class="progress-bar-container" style="height: 15px; margin-top: 8px;">
                <div class="progress-bar" style="width: ${milestoneProgress}%; font-size: 0.7em;">
                    ${milestoneProgress > 20 ? milestoneProgress.toFixed(0) + '%' : ''}
                </div>
            </div>
        </div>

        <div class="goal-stats">
            <div class="stat">
                <div class="stat-label">Started at</div>
                <div class="stat-value">${formatNumber(goal.startKills)} KC</div>
            </div>
            <div class="stat">
                <div class="stat-label">Current KC</div>
                <div class="stat-value">${formatNumber(goal.currentKills)}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Target KC</div>
                <div class="stat-value">${formatNumber(goal.startKills + goal.targetKills)}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Remaining</div>
                <div class="stat-value">${formatNumber(goal.targetKills - goal.killsGained)}</div>
            </div>
        </div>
    `;

    // Event listeners
    card.querySelector('.view-details').addEventListener('click', (e) => {
        e.stopPropagation();
        showGoalDetail(goal.id);
    });

    const pauseBtn = card.querySelector('.pause-goal');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleGoalStatus(goal.id, 'paused');
        });
    }

    const resumeBtn = card.querySelector('.resume-goal');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleGoalStatus(goal.id, 'active');
        });
    }

    card.querySelector('.edit-goal').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditGoalModal(goal);
    });

    card.querySelector('.hide-goal').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Hide goal for ${goal.bossName}?`)) {
            toggleGoalHidden(goal.id, true);
        }
    });

    card.querySelector('.delete-goal').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete goal for ${goal.bossName}? This cannot be undone.`)) {
            deleteGoal(goal.id);
            renderGoalsOverview();
        }
    });

    return card;
}

function showGoalDetail(goalId) {
    const goal = currentGoals.find(g => g.id === goalId);
    if (!goal) return;

    goalsOverview.style.display = 'none';
    goalDetailView.style.display = 'block';

    renderGoalDetail(goal);
}

function renderGoalDetail(goal) {
    const progressPercent = Math.min(goal.progress, 100).toFixed(1);

    // Calculate milestones
    const milestones = [];
    for (let i = goal.milestoneInterval; i <= goal.targetKills; i += goal.milestoneInterval) {
        const status = i <= goal.killsGained ? 'completed' : i <= goal.nextMilestone ? 'current' : 'pending';
        milestones.push({ kills: i, status });
    }

    // Get progress data for different timeframes
    const dailyProgress = calculateDailyProgress(goal);
    const weeklyProgress = calculateWeeklyProgress(goal);
    const monthlyProgress = calculateMonthlyProgress(goal);

    // Calculate statistics
    const stats = calculateGoalStatistics(goal);

    const detailHTML = `
        <div class="detail-header">
            <h2>${goal.bossName} Goal</h2>
            <div class="detail-meta">
                <span class="goal-status-badge ${goal.status}">${goal.status}</span>
                <span>Created ${formatDate(goal.createdAt)}</span>
                ${goal.status === 'completed' ? `<span>Completed ${formatDate(goal.completedAt)}</span>` : ''}
            </div>
        </div>

        <div class="detail-overview">
            <div class="overview-card">
                <h4>Started at</h4>
                <div class="value">${formatNumber(goal.startKills)}</div>
            </div>
            <div class="overview-card">
                <h4>Current KC</h4>
                <div class="value">${formatNumber(goal.currentKills)}</div>
            </div>
            <div class="overview-card">
                <h4>Target KC</h4>
                <div class="value">${formatNumber(goal.startKills + goal.targetKills)}</div>
            </div>
            <div class="overview-card">
                <h4>Progress</h4>
                <div class="value">${progressPercent}%</div>
            </div>
            <div class="overview-card">
                <h4>Kills Gained</h4>
                <div class="value">${formatNumber(goal.killsGained)}</div>
            </div>
            <div class="overview-card">
                <h4>Remaining</h4>
                <div class="value">${formatNumber(goal.targetKills - goal.killsGained)}</div>
            </div>
        </div>

        <div class="stats-section">
            <h3>Statistics</h3>
            <div class="detail-overview">
                <div class="overview-card">
                    <h4>${goal.status === 'completed' ? 'Days to Complete' : 'Days Active'}</h4>
                    <div class="value">${stats.daysActive}</div>
                </div>
                <div class="overview-card">
                    <h4>Daily Average</h4>
                    <div class="value">${stats.dailyAverage}</div>
                </div>
                <div class="overview-card">
                    <h4>Weekly Average</h4>
                    <div class="value">${stats.weeklyAverage}</div>
                </div>
                <div class="overview-card">
                    <h4>Monthly Average</h4>
                    <div class="value">${stats.monthlyAverage}</div>
                </div>
                <div class="overview-card">
                    <h4>Best Day</h4>
                    <div class="value">${stats.bestDay} kills</div>
                </div>
                <div class="overview-card">
                    <h4>Days with 0 Kills</h4>
                    <div class="value">${stats.daysWithZeroKills}</div>
                </div>
            </div>
        </div>

        <div class="goal-progress" style="margin-bottom: 30px;">
            <div class="progress-text">
                <span>${formatNumber(goal.killsGained)} / ${formatNumber(goal.targetKills)} kills</span>
                <span>${progressPercent}%</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progressPercent}%">
                    ${progressPercent > 10 ? progressPercent + '%' : ''}
                </div>
            </div>
        </div>

        <div class="milestones-section">
            <h3>Milestones</h3>
            ${renderMilestonesSummary(goal, milestones)}
        </div>

        <div class="progress-chart">
            <h3>Kill Progress Over Time</h3>
            <div class="chart-container">
                <div class="chart-tabs">
                    <button class="chart-tab active" data-timeframe="daily">Daily</button>
                    <button class="chart-tab" data-timeframe="weekly">Weekly</button>
                    <button class="chart-tab" data-timeframe="monthly">Monthly</button>
                </div>
                <div class="progress-entries" id="progressEntries">
                    ${renderProgressEntries(dailyProgress)}
                </div>
            </div>
        </div>

        <div class="goal-actions" style="margin-top: 30px;">
            ${goal.status === 'active' ? `<button class="btn-warning" id="pauseDetailGoal">Pause Goal</button>` : ''}
            ${goal.status === 'paused' ? `<button class="btn-primary" id="resumeDetailGoal">Resume Goal</button>` : ''}
            <button class="btn-secondary" id="editDetailGoal">Edit Goal</button>
            <button class="btn-secondary" id="hideDetailGoal">Hide Goal</button>
            <button class="btn-danger" id="deleteDetailGoal">Delete Goal</button>
        </div>
    `;

    document.getElementById('goalDetailContent').innerHTML = detailHTML;

    // Add event listeners for chart tabs
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const timeframe = tab.dataset.timeframe;
            let progressData;
            if (timeframe === 'daily') progressData = dailyProgress;
            else if (timeframe === 'weekly') progressData = weeklyProgress;
            else progressData = monthlyProgress;

            document.getElementById('progressEntries').innerHTML = renderProgressEntries(progressData);
        });
    });

    // Action buttons
    const pauseBtn = document.getElementById('pauseDetailGoal');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            toggleGoalStatus(goal.id, 'paused');
            showGoalDetail(goal.id);
        });
    }

    const resumeBtn = document.getElementById('resumeDetailGoal');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            toggleGoalStatus(goal.id, 'active');
            showGoalDetail(goal.id);
        });
    }

    document.getElementById('editDetailGoal').addEventListener('click', () => {
        openEditGoalModal(goal);
    });

    document.getElementById('hideDetailGoal').addEventListener('click', () => {
        if (confirm(`Hide goal for ${goal.bossName}?`)) {
            toggleGoalHidden(goal.id, true);
            handleBackToOverview();
        }
    });

    document.getElementById('deleteDetailGoal').addEventListener('click', () => {
        if (confirm(`Delete goal for ${goal.bossName}? This cannot be undone.`)) {
            deleteGoal(goal.id);
            handleBackToOverview();
        }
    });

    // Toggle milestones list
    const toggleMilestonesBtn = document.getElementById('toggleAllMilestones');
    if (toggleMilestonesBtn) {
        toggleMilestonesBtn.addEventListener('click', () => {
            const milestoneList = document.getElementById('milestoneListFull');
            if (milestoneList.style.display === 'none') {
                milestoneList.style.display = 'block';
                toggleMilestonesBtn.textContent = 'Hide All Milestones';
            } else {
                milestoneList.style.display = 'none';
                toggleMilestonesBtn.textContent = `Show All Milestones (${milestones.length})`;
            }
        });
    }
}

function renderMilestonesSummary(goal, milestones) {
    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
    const totalMilestones = milestones.length;
    const currentMilestone = milestones.find(m => m.status === 'current') || milestones.find(m => m.status === 'pending');
    const remainingToNextMilestone = currentMilestone ? currentMilestone.kills - goal.killsGained : 0;

    return `
        <div class="milestone-summary">
            <div class="milestone-current">
                <div class="milestone-current-header">
                    <h4>Current Milestone</h4>
                    <span class="milestone-progress">${completedMilestones} / ${totalMilestones} completed</span>
                </div>
                ${currentMilestone ? `
                    <div class="milestone-current-card">
                        <div class="milestone-target">
                            <span class="milestone-label">Target:</span>
                            <span class="milestone-value">${formatNumber(currentMilestone.kills)} kills</span>
                        </div>
                        <div class="milestone-remaining">
                            <span class="milestone-label">Remaining:</span>
                            <span class="milestone-value">${formatNumber(remainingToNextMilestone)} kills</span>
                        </div>
                        <div class="milestone-progress-bar">
                            <div class="progress-bar-container" style="height: 15px;">
                                <div class="progress-bar" style="width: ${Math.min((goal.killsGained / currentMilestone.kills) * 100, 100)}%; font-size: 0.7em;">
                                </div>
                            </div>
                        </div>
                    </div>
                ` : '<p class="milestone-complete-msg">All milestones completed!</p>'}
            </div>

            <button class="btn-secondary milestone-toggle" id="toggleAllMilestones" style="margin-top: 15px;">
                Show All Milestones (${totalMilestones})
            </button>

            <div class="milestone-list-full" id="milestoneListFull" style="display: none; margin-top: 15px;">
                ${milestones.map(m => `
                    <div class="milestone-item ${m.status}">
                        <div class="milestone-kills">${formatNumber(m.kills)} kills</div>
                        <div class="milestone-status ${m.status}">${m.status}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderProgressEntries(progressData) {
    if (progressData.length === 0) {
        return '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No data available yet.</p>';
    }

    return progressData.map(entry => `
        <div class="progress-entry">
            <div class="entry-date">${entry.label}</div>
            <div class="entry-details">
                ${entry.gain !== undefined ?
                    `<div class="entry-gain ${entry.gain > 0 ? 'positive' : ''}">KC gained ${entry.gain > 0 ? '+' : ''}${formatNumber(entry.gain)}</div>
                     <div class="entry-total">Total KC ${formatNumber(entry.kills)}</div>` :
                    `<div class="entry-gain">Starting point</div>
                     <div class="entry-total">Total KC ${formatNumber(entry.kills)}</div>`}
            </div>
        </div>
    `).join('');
}

function calculateDailyProgress(goal) {
    return goal.progressHistory.slice().reverse().map((entry, index, array) => {
        const prevEntry = array[index + 1];
        let gain;

        if (prevEntry) {
            // If there's a previous entry, calculate the gain from that entry
            gain = entry.kills - prevEntry.kills;
        } else if (index === array.length - 1 && goal.startKills !== undefined) {
            // If this is the first/oldest entry and we have a startKills, calculate from start
            gain = entry.kills - goal.startKills;
        } else {
            gain = undefined;
        }

        return {
            label: formatDate(entry.date),
            kills: entry.kills,
            gain: gain
        };
    });
}

function calculateWeeklyProgress(goal) {
    const weeklyData = {};

    goal.progressHistory.forEach(entry => {
        const date = new Date(entry.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!weeklyData[weekKey] || entry.kills > weeklyData[weekKey].kills) {
            weeklyData[weekKey] = { date: weekKey, kills: entry.kills };
        }
    });

    const weeks = Object.values(weeklyData).sort((a, b) => new Date(b.date) - new Date(a.date));

    return weeks.map((week, index) => {
        const prevWeek = weeks[index + 1];
        const gain = prevWeek ? week.kills - prevWeek.kills : 0;
        return {
            label: `Week of ${formatDate(week.date)}`,
            kills: week.kills,
            gain: index < weeks.length - 1 ? gain : undefined
        };
    });
}

function calculateMonthlyProgress(goal) {
    const monthlyData = {};

    goal.progressHistory.forEach(entry => {
        const date = new Date(entry.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey] || entry.kills > monthlyData[monthKey].kills) {
            monthlyData[monthKey] = { date: monthKey, kills: entry.kills };
        }
    });

    const months = Object.values(monthlyData).sort((a, b) => b.date.localeCompare(a.date));

    return months.map((month, index) => {
        const prevMonth = months[index + 1];
        const gain = prevMonth ? month.kills - prevMonth.kills : 0;
        const date = new Date(month.date + '-01');
        return {
            label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
            kills: month.kills,
            gain: index < months.length - 1 ? gain : undefined
        };
    });
}

function calculateGoalStatistics(goal) {
    // Calculate days active
    const endTime = goal.status === 'completed' ? goal.completedAt : Date.now();
    const daysActive = Math.max(1, Math.floor((endTime - goal.createdAt) / (1000 * 60 * 60 * 24)));

    // Calculate daily average
    const dailyAverage = (goal.killsGained / daysActive).toFixed(1);

    // Calculate weekly and monthly progress data
    const weeklyProgress = calculateWeeklyProgress(goal);
    const monthlyProgress = calculateMonthlyProgress(goal);

    // Calculate weekly average (excluding starting point)
    const weeklyGains = weeklyProgress.filter(w => w.gain !== undefined).map(w => w.gain);
    const weeklyAverage = weeklyGains.length > 0
        ? (weeklyGains.reduce((sum, gain) => sum + gain, 0) / weeklyGains.length).toFixed(1)
        : '0.0';

    // Calculate monthly average (excluding starting point)
    const monthlyGains = monthlyProgress.filter(m => m.gain !== undefined).map(m => m.gain);
    const monthlyAverage = monthlyGains.length > 0
        ? (monthlyGains.reduce((sum, gain) => sum + gain, 0) / monthlyGains.length).toFixed(1)
        : '0.0';

    // Find best day (most kills in a single day)
    const dailyProgress = calculateDailyProgress(goal);
    const dailyGains = dailyProgress.filter(d => d.gain !== undefined).map(d => d.gain);
    const bestDay = dailyGains.length > 0 ? Math.max(...dailyGains) : 0;

    // Count days with 0 kills
    const daysWithZeroKills = dailyGains.filter(gain => gain === 0).length;

    return {
        daysActive,
        dailyAverage,
        weeklyAverage,
        monthlyAverage,
        bestDay,
        daysWithZeroKills
    };
}

function handleBackToOverview() {
    goalDetailView.style.display = 'none';
    goalsOverview.style.display = 'block';
    renderGoalsOverview();
}

// Modal Functions
function openCreateGoalModal() {
    editingGoalId = null;
    modalTitle.textContent = 'Create New Goal';
    saveGoal.textContent = 'Create Goal';
    goalForm.reset();
    populateBossSelect();
    goalModal.style.display = 'flex';
}

function openEditGoalModal(goal) {
    editingGoalId = goal.id;
    modalTitle.textContent = 'Edit Goal';
    saveGoal.textContent = 'Save Changes';

    populateBossSelect();
    document.getElementById('goalBoss').value = goal.boss;
    document.getElementById('goalTarget').value = goal.targetKills;
    document.getElementById('goalMilestone').value = goal.milestoneInterval;

    goalModal.style.display = 'flex';
}

function closeGoalModal() {
    goalModal.style.display = 'none';
    editingGoalId = null;
    goalForm.reset();
}

function populateBossSelect() {
    const select = document.getElementById('goalBoss');
    select.innerHTML = '<option value="">Choose a boss...</option>';

    BOSS_ACTIVITIES.forEach(boss => {
        const option = document.createElement('option');
        option.value = boss;
        option.textContent = formatBossName(boss);
        select.appendChild(option);
    });
}

function handleGoalFormSubmit(e) {
    e.preventDefault();

    const formData = {
        boss: document.getElementById('goalBoss').value,
        targetKills: document.getElementById('goalTarget').value,
        milestoneInterval: document.getElementById('goalMilestone').value
    };

    if (editingGoalId) {
        // Edit existing goal
        const goal = currentGoals.find(g => g.id === editingGoalId);
        updateGoal(editingGoalId, {
            targetKills: parseInt(formData.targetKills),
            milestoneInterval: parseInt(formData.milestoneInterval)
        });

        // Recalculate progress
        updateGoalsProgress();

        // If we're in detail view, refresh it
        if (goalDetailView.style.display === 'block') {
            showGoalDetail(editingGoalId);
        } else {
            renderGoalsOverview();
        }
    } else {
        // Create new goal
        createGoal(formData);
        renderGoalsOverview();
    }

    closeGoalModal();
}

function showHiddenGoalsModal() {
    const hiddenGoals = currentGoals.filter(g => g.hidden);
    const list = document.getElementById('hiddenGoalsList');

    if (hiddenGoals.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No hidden goals.</p>';
    } else {
        list.innerHTML = hiddenGoals.map(goal => `
            <div class="hidden-goal-item">
                <div class="hidden-goal-info">
                    <h4>${goal.bossName}</h4>
                    <p>${formatNumber(goal.killsGained)} / ${formatNumber(goal.targetKills)} kills (${goal.progress.toFixed(1)}%)</p>
                </div>
                <button class="btn-primary unhide-goal" data-goal-id="${goal.id}">Unhide</button>
            </div>
        `).join('');

        // Add event listeners
        document.querySelectorAll('.unhide-goal').forEach(btn => {
            btn.addEventListener('click', () => {
                const goalId = btn.dataset.goalId;
                toggleGoalHidden(goalId, false);
                showHiddenGoalsModal(); // Refresh modal
                renderGoalsOverview();
            });
        });
    }

    hiddenGoalsModal.style.display = 'flex';
}

// Event Listeners
submitUsername.addEventListener('click', handleSubmitUsername);
changeUsername.addEventListener('click', handleChangeUsername);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSubmitUsername();
});

createGoalBtn.addEventListener('click', openCreateGoalModal);
closeModal.addEventListener('click', closeGoalModal);
cancelGoal.addEventListener('click', closeGoalModal);
goalForm.addEventListener('submit', handleGoalFormSubmit);
backToOverview.addEventListener('click', handleBackToOverview);
showHiddenGoals.addEventListener('click', showHiddenGoalsModal);
closeHiddenModal.addEventListener('click', () => {
    hiddenGoalsModal.style.display = 'none';
});


// Close modals on outside click
goalModal.addEventListener('click', (e) => {
    if (e.target === goalModal) closeGoalModal();
});

hiddenGoalsModal.addEventListener('click', (e) => {
    if (e.target === hiddenGoalsModal) {
        hiddenGoalsModal.style.display = 'none';
    }
});

// Boss KC Tab Functions
let bossKCData = []; // Store boss data globally to avoid re-fetching

function renderBossKC() {
    const bossKCList = document.getElementById('bossKCList');
    const searchInput = document.getElementById('bossKCSearch');

    if (!bossKCList || !currentPlayerData) return;

    const bosses = currentPlayerData.latestSnapshot.data.bosses;
    bossKCData = [];

    for (const [bossKey, data] of Object.entries(bosses)) {
        const kills = data.kills || 0;
        if (kills > 0) {
            const pointsPerKC = bossPointsData[bossKey]?.points_per_kc || 0;
            const totalXP = kills * pointsPerKC;
            bossKCData.push({
                key: bossKey,
                name: formatBossName(bossKey),
                kills,
                xp: totalXP
            });
        }
    }

    // Sort by kills descending
    bossKCData.sort((a, b) => b.kills - a.kills);

    // Display all bosses initially
    displayBossKC(bossKCData);

    // Set up search (remove old listeners first)
    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredBosses = bossKCData.filter(boss =>
                boss.name.toLowerCase().includes(searchTerm)
            );
            displayBossKC(filteredBosses);
        });
    }
}

function displayBossKC(bossesToDisplay) {
    const bossKCList = document.getElementById('bossKCList');
    if (!bossKCList) return;

    if (bossesToDisplay.length === 0) {
        bossKCList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No bosses found.</p>';
        return;
    }

    bossKCList.innerHTML = bossesToDisplay.map(boss => `
        <div class="boss-kc-item">
            <div>
                <div class="boss-kc-name">${boss.name}</div>
                <div class="boss-kc-xp">${formatNumber(boss.xp)} XP</div>
            </div>
            <div class="boss-kc-kills">${formatNumber(boss.kills)}</div>
        </div>
    `).join('');
}

// Titles Tab Functions
function renderTitles() {
    const titlesList = document.getElementById('titlesList');
    const currentTitleDisplay = document.getElementById('currentTitleDisplay');
    if (!titlesList || !titlesData.length) return;

    const totalXP = calculateTotalXP(currentPlayerData);
    const levelProgress = getLevelProgress(totalXP);
    const currentLevel = levelProgress.level;

    // Update current title display
    const selectedTitle = titlesData.find(t => t.id === currentTitleId);
    if (selectedTitle && currentTitleDisplay) {
        const formattedTitle = formatTitleWithUsername(selectedTitle, currentUsername).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        currentTitleDisplay.textContent = `Current: ${formattedTitle}`;
    }

    titlesList.innerHTML = titlesData.map(title => {
        const isUnlocked = currentLevel >= title.level;
        const isActive = title.id === currentTitleId;
        const statusClass = isActive ? 'active' : isUnlocked ? 'unlocked' : 'locked';

        return `
            <div class="title-item ${statusClass}">
                <div class="title-header">
                    <div class="title-name">${title.title}</div>
                    <div class="title-level-req">Level ${title.level}</div>
                </div>
                <div class="title-description">${title.description}</div>
                <div class="title-status ${statusClass}">
                    ${isActive ? '✓ Currently Equipped' : isUnlocked ? '✓ Unlocked' : '🔒 Locked'}
                </div>
                ${isUnlocked ? `
                    <div class="title-actions">
                        <button
                            class="btn-select-title"
                            onclick="selectTitle('${title.id}')"
                            ${isActive ? 'disabled' : ''}
                        >
                            ${isActive ? 'Equipped' : 'Equip Title'}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function selectTitle(titleId) {
    currentTitleId = titleId;
    saveSelectedTitle(currentUsername, titleId);

    // Update displays
    const totalXP = calculateTotalXP(currentPlayerData);
    const levelProgress = getLevelProgress(totalXP);
    renderLevelDisplay(levelProgress, totalXP);
    renderTitles();
}

// Make selectTitle available globally
window.selectTitle = selectTitle;

// Settings Modal Functions
function openSettingsModal() {
    dateFormatSelect.value = userSettings.dateFormat;
    document.getElementById('showLevel').checked = userSettings.showLevel;
    document.getElementById('showUsernameWithTitle').checked = userSettings.showUsernameWithTitle;
    settingsModal.style.display = 'flex';
}

function closeSettings() {
    settingsModal.style.display = 'none';
}

function handleSaveSettings() {
    userSettings.dateFormat = dateFormatSelect.value;
    userSettings.showLevel = document.getElementById('showLevel').checked;
    userSettings.showUsernameWithTitle = document.getElementById('showUsernameWithTitle').checked;
    saveSettings(userSettings);
    closeSettings();

    // Refresh level display with new settings
    const totalXP = calculateTotalXP(currentPlayerData);
    const levelProgress = getLevelProgress(totalXP);
    renderLevelDisplay(levelProgress, totalXP);

    // Refresh the current view to apply new date format
    if (goalDetailView.style.display === 'block') {
        const currentGoalId = currentGoals.find(g => true)?.id; // Get current goal if in detail view
        if (currentGoalId) {
            const goal = currentGoals.find(g => g.id === currentGoalId);
            if (goal) renderGoalDetail(goal);
        }
    } else {
        renderGoalsOverview();
    }
}

// Export/Import Functions
function exportGoals() {
    if (!currentUsername || currentGoals.length === 0) {
        showError('No goals to export. Create some goals first!');
        return;
    }

    // Create export data with metadata to prevent abuse
    const exportData = {
        version: '1.0',
        username: currentUsername,
        exportDate: new Date().toISOString(),
        goals: currentGoals.map(goal => ({
            ...goal,
            // Store the current actual KC from API at time of export
            exportKillCount: currentPlayerData?.latestSnapshot?.data?.bosses?.[goal.boss]?.kills || 0
        }))
    };

    // Create and download file
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `osrs-goals-${currentUsername}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showError('Goals exported successfully!', false);
    setTimeout(() => hideError(), 3000);
}

function importGoals() {
    if (!currentUsername) {
        showError('Please set your username first!');
        return;
    }

    document.getElementById('importFileInput').click();
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importData = JSON.parse(e.target.result);

            // Validate import data
            if (!importData.version || !importData.goals || !Array.isArray(importData.goals)) {
                showError('Invalid import file format!');
                return;
            }

            // Get current API data to check for abuse
            showLoading(true, 'Validating import data...');
            const freshPlayerData = await fetchPlayerData(currentUsername);
            currentPlayerData = freshPlayerData;
            currentPlayerType = freshPlayerData.type || 'regular';
            const currentBosses = currentPlayerData?.latestSnapshot?.data?.bosses || {};

            let importedCount = 0;
            let skippedCount = 0;
            let preventedAbuse = 0;

            for (const importedGoal of importData.goals) {
                // Check if goal already exists (by boss)
                const existingGoal = currentGoals.find(g => g.boss === importedGoal.boss);

                if (existingGoal) {
                    // Goal already exists, skip it
                    skippedCount++;
                } else {
                    // New goal - validate and import with preserved progress
                    const currentKC = currentBosses[importedGoal.boss]?.kills || 0;
                    const startKills = importedGoal.startKills || 0;

                    // Abuse check: if current KC is significantly less than when goal was started, reject it
                    // This prevents someone from creating a goal at 1000 KC, then importing it on an account with only 50 KC
                    if (currentKC < startKills - 10) { // Allow 10 KC tolerance for API delays/inconsistencies
                        preventedAbuse++;
                        continue;
                    }

                    // Calculate current progress based on actual KC
                    const killsGained = Math.max(0, currentKC - startKills);
                    const progress = importedGoal.targetKills > 0 ? (killsGained / importedGoal.targetKills) * 100 : 0;

                    // Calculate milestones
                    const currentMilestone = Math.floor(killsGained / importedGoal.milestoneInterval) * importedGoal.milestoneInterval;
                    const nextMilestone = currentMilestone + importedGoal.milestoneInterval;

                    // Recreate milestones array
                    const milestonesCompleted = [];
                    for (let i = importedGoal.milestoneInterval; i <= currentMilestone; i += importedGoal.milestoneInterval) {
                        milestonesCompleted.push({
                            kills: i,
                            date: new Date().toISOString(),
                            note: 'Milestone restored from import'
                        });
                    }

                    // Determine status
                    let status = importedGoal.status;
                    if (progress >= 100) {
                        status = 'completed';
                    }

                    // Create new goal with preserved progress
                    const newGoal = {
                        id: generateId(),
                        boss: importedGoal.boss,
                        bossName: importedGoal.bossName,
                        targetKills: importedGoal.targetKills,
                        milestoneInterval: importedGoal.milestoneInterval,
                        status: status,
                        hidden: importedGoal.hidden || false,
                        startKills: startKills, // Preserve original start KC
                        killsGained: killsGained, // Calculate based on current KC
                        progress: progress,
                        currentMilestone: currentMilestone,
                        nextMilestone: nextMilestone,
                        milestonesCompleted: milestonesCompleted,
                        history: [{
                            date: new Date().toISOString(),
                            kills: currentKC,
                            note: 'Goal imported'
                        }],
                        createdAt: importedGoal.createdAt || new Date().toISOString()
                    };

                    currentGoals.push(newGoal);
                    importedCount++;
                }
            }

            // Save and update
            saveGoalsToStorage(currentUsername, currentGoals);
            updateGoalsProgress();
            renderGoalsOverview();
            showLoading(false);

            // Show results
            let message = `Import complete! Imported: ${importedCount}`;
            if (skippedCount > 0) message += `, Skipped (duplicates): ${skippedCount}`;
            if (preventedAbuse > 0) message += `, Blocked (abuse detected): ${preventedAbuse}`;

            showError(message, false);
            setTimeout(() => hideError(), 5000);

        } catch (error) {
            console.error('Import error:', error);
            showError('Failed to import goals. Invalid file format!');
        }

        // Reset file input
        event.target.value = '';
    };

    reader.readAsText(file);
}

// Settings Event Listeners
settingsBtn.addEventListener('click', openSettingsModal);
closeSettingsModal.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', handleSaveSettings);

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
});

// Export/Import Event Listeners
document.getElementById('exportGoals').addEventListener('click', exportGoals);
document.getElementById('importGoals').addEventListener('click', importGoals);
document.getElementById('importFileInput').addEventListener('change', handleImportFile);

// Tab switching
document.querySelectorAll('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Update tab buttons
        document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });

        const targetContent = document.getElementById(`${tabName}TabContent`);
        if (targetContent) {
            targetContent.classList.add('active');
            targetContent.style.display = 'block';
        }

        // Render content for the selected tab
        if (tabName === 'bosskc') {
            renderBossKC();
        } else if (tabName === 'titles') {
            renderTitles();
        } else if (tabName === 'active' || tabName === 'paused' || tabName === 'completed') {
            // Goals are already rendered, just switching tabs
        }
    });
});

// Initialize app
window.addEventListener('DOMContentLoaded', async () => {
    // Load boss points data and titles
    await loadBossPoints();
    await loadTitles();

    // Load settings
    userSettings = loadSettings();

    const savedUsername = loadSavedUsername();
    if (savedUsername) {
        usernameInput.value = savedUsername;
        handleSubmitUsername();
    }
});
