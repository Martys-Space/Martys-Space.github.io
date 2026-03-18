/* ===== game.js — Business system, interest, upgrades ===== */
const Game = (() => {
  let _businessDefs = [];
  let _state = null;
  let _countdownInterval = null;

  function init(businessDefs, state) {
    _businessDefs = businessDefs.businesses || [];
    _state = state;
    startCountdownUpdater();
  }

  function setState(state) {
    _state = state;
  }

  function getBusinessDef(defId) {
    return _businessDefs.find(b => b.id === defId);
  }

  function getOwnedBusiness(instanceId) {
    return _state.businesses.find(b => b.instanceId === instanceId);
  }

  function isBusinessOwned(defId) {
    return _state.businesses.some(b => b.defId === defId);
  }

  /* ===== GAME VIEW ===== */
  function renderGameView() {
    const list = document.getElementById('businesses-list');
    const playerLevel = getPlayerLevel(_state.xp);

    let html = '';

    for (const def of _businessDefs) {
      const owned = _state.businesses.find(b => b.defId === def.id);
      const unlocked = playerLevel >= def.unlockLevel;

      if (owned) {
        html += renderOwnedBusiness(owned, def, playerLevel);
      } else if (unlocked) {
        html += renderUnlockedBusiness(def);
      } else {
        html += renderLockedBusiness(def);
      }
    }

    list.innerHTML = html;
    bindBusinessEvents(list);
  }

  function renderLockedBusiness(def) {
    return `
      <div class="biz-card locked">
        <div class="biz-card-header">
          <div class="biz-icon">${def.icon}</div>
          <div class="biz-header-info">
            <div class="biz-name">${def.name}</div>
            <div class="biz-lock-info">Unlocks at Level ${def.unlockLevel}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderUnlockedBusiness(def) {
    const canAfford = _state.gold >= def.baseCost;
    return `
      <div class="biz-card">
        <div class="biz-card-header">
          <div class="biz-icon">${def.icon}</div>
          <div class="biz-header-info">
            <div class="biz-name">${def.name}</div>
            <div class="biz-level">Available to purchase</div>
          </div>
        </div>
        <div class="biz-stats">
          <div class="biz-stat">
            <span style="color:var(--accent-primary)">✦ ${def.baseXpPerCycle}</span>/cycle
          </div>
          <div class="biz-stat">
            <span style="color:var(--accent-purple)">💎 ${def.baseMoneyPerCycle}</span>/cycle
          </div>
        </div>
        <div style="text-align:center">
          <button class="btn-buy-biz" data-buy-def="${def.id}" ${canAfford ? '' : 'disabled'}>
            Buy for ${def.baseCost} 🪙
          </button>
          ${!canAfford ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Not enough gold</div>' : ''}
        </div>
      </div>
    `;
  }

  function renderOwnedBusiness(biz, def, playerLevel) {
    const cycles = getAvailableCycles(biz, def);
    const maxClaims = getEffectiveMaxClaims(biz, def);
    const yields = getPerCycleYields(biz, def);
    const bizLevel = getBusinessLevel(biz, def);
    const nextCycleMs = getNextCycleTime(biz, def);

    return `
      <div class="biz-card" data-biz-instance="${biz.instanceId}" data-biz-def="${def.id}">
        <div class="biz-card-header">
          <div class="biz-icon">${def.icon}</div>
          <div class="biz-header-info">
            <div class="biz-name">${def.name}</div>
            <div class="biz-level">Business Lv. ${bizLevel} &middot; 💎 ${biz.businessMoney}</div>
          </div>
        </div>
        <div class="biz-stats">
          <div class="biz-stat">
            <span style="color:var(--accent-primary)">✦ ${yields.xp}</span>/cycle
          </div>
          <div class="biz-stat">
            <span style="color:var(--accent-purple)">💎 ${yields.money}</span>/cycle
          </div>
        </div>
        <div class="biz-claims">
          <div>
            <div class="biz-claims-info">
              Claims: <span class="biz-claims-count">${cycles}/${maxClaims}</span>
            </div>
            <div class="biz-timer cycle-timer" data-next="${nextCycleMs}">
              ${cycles >= maxClaims ? 'Full!' : ''}
            </div>
          </div>
          <button class="btn-claim" data-claim-id="${biz.instanceId}" ${cycles === 0 ? 'disabled' : ''}>
            Claim ${cycles > 0 ? `(+${cycles * yields.money} 💎)` : ''}
          </button>
        </div>
      </div>
    `;
  }

  function bindBusinessEvents(container) {
    // Buy buttons
    container.querySelectorAll('.btn-buy-biz').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        purchaseBusiness(btn.dataset.buyDef);
      });
    });

    // Claim buttons
    container.querySelectorAll('.btn-claim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        claimInterest(btn.dataset.claimId);
      });
    });

    // Click on owned business card to show detail
    container.querySelectorAll('.biz-card[data-biz-instance]').forEach(card => {
      card.addEventListener('click', () => {
        openBusinessDetail(card.dataset.bizInstance);
      });
    });
  }

  /* ===== PURCHASE ===== */
  function purchaseBusiness(defId) {
    const def = getBusinessDef(defId);
    if (!def) return;
    if (isBusinessOwned(defId)) return;
    if (_state.gold < def.baseCost) return;

    _state.gold -= def.baseCost;
    _state.businesses.push({
      instanceId: generateId('biz'),
      defId: def.id,
      purchasedAt: Date.now(),
      goldInvested: def.baseCost,
      businessXp: 0,
      businessLevel: 0,
      businessMoney: 0,
      lastClaimAt: Date.now(),
      upgrades: {}
    });

    Storage.saveState(_state);
    App.renderTopbar();
    renderGameView();
    App.showToast(`Purchased ${def.name}!`, 'gold');
  }

  /* ===== INTEREST / CYCLES ===== */
  function getAvailableCycles(biz, def) {
    const cycleDuration = (def.cycleDurationHours || 8) * 3600 * 1000;
    const elapsed = Date.now() - biz.lastClaimAt;
    const rawCycles = Math.floor(elapsed / cycleDuration);
    const maxClaims = getEffectiveMaxClaims(biz, def);
    return Math.min(maxClaims, rawCycles);
  }

  function getNextCycleTime(biz, def) {
    const cycleDuration = (def.cycleDurationHours || 8) * 3600 * 1000;
    const elapsed = Date.now() - biz.lastClaimAt;
    const cyclesSoFar = Math.floor(elapsed / cycleDuration);
    const nextCycleAt = biz.lastClaimAt + (cyclesSoFar + 1) * cycleDuration;
    return nextCycleAt;
  }

  function getEffectiveMaxClaims(biz, def) {
    let max = def.baseMaxClaims || 5;
    for (const upg of (def.upgrades || [])) {
      if (upg.type === 'claim_storage' && biz.upgrades[upg.id]) {
        max += upg.claimStorageBonus * biz.upgrades[upg.id];
      }
    }
    return max;
  }

  function getPerCycleYields(biz, def) {
    let xpMult = 1;
    let moneyMult = 1;

    for (const upg of (def.upgrades || [])) {
      if (upg.type === 'boost' && biz.upgrades[upg.id]) {
        const level = biz.upgrades[upg.id];
        xpMult += (upg.xpBoostPerLevel || 0) * level;
        moneyMult += (upg.moneyBoostPerLevel || 0) * level;
      }
    }

    return {
      xp: Math.floor(def.baseXpPerCycle * xpMult),
      money: Math.floor(def.baseMoneyPerCycle * moneyMult)
    };
  }

  function claimInterest(instanceId) {
    const biz = getOwnedBusiness(instanceId);
    if (!biz) return;
    const def = getBusinessDef(biz.defId);
    if (!def) return;

    const cycles = getAvailableCycles(biz, def);
    if (cycles <= 0) return;

    const yields = getPerCycleYields(biz, def);
    const totalXp = cycles * yields.xp;
    const totalMoney = cycles * yields.money;

    biz.businessXp += totalXp;
    biz.businessMoney += totalMoney;
    biz.lastClaimAt = Date.now();

    // Update business level
    biz.businessLevel = getBusinessLevel(biz, def);

    Storage.saveState(_state);
    App.renderTopbar();
    renderGameView();
    App.showToast(`Claimed +${totalMoney} 💎  +${totalXp} Biz XP`, 'info');
  }

  function getBusinessLevel(biz, def) {
    return Math.floor(biz.businessXp / (def.xpPerBusinessLevel || 100));
  }

  /* ===== BUSINESS DETAIL MODAL ===== */
  function openBusinessDetail(instanceId) {
    const biz = getOwnedBusiness(instanceId);
    if (!biz) return;
    const def = getBusinessDef(biz.defId);
    if (!def) return;

    const playerLevel = getPlayerLevel(_state.xp);
    const bizLevel = getBusinessLevel(biz, def);
    const yields = getPerCycleYields(biz, def);
    const maxClaims = getEffectiveMaxClaims(biz, def);

    const titleEl = document.getElementById('business-modal-title');
    const bodyEl = document.getElementById('business-modal-body');

    titleEl.textContent = `${def.icon} ${def.name}`;

    let html = `
      <div class="biz-detail-stats">
        <div class="biz-detail-stat">
          <span class="biz-detail-stat-value" style="color:var(--accent-primary)">${bizLevel}</span>
          <span class="biz-detail-stat-label">Business Level</span>
        </div>
        <div class="biz-detail-stat">
          <span class="biz-detail-stat-value" style="color:var(--accent-purple)">${biz.businessMoney}</span>
          <span class="biz-detail-stat-label">Business Money</span>
        </div>
        <div class="biz-detail-stat">
          <span class="biz-detail-stat-value" style="color:var(--accent-primary)">${yields.xp}</span>
          <span class="biz-detail-stat-label">XP / cycle</span>
        </div>
        <div class="biz-detail-stat">
          <span class="biz-detail-stat-value" style="color:var(--accent-purple)">${yields.money}</span>
          <span class="biz-detail-stat-label">💎 / cycle</span>
        </div>
        <div class="biz-detail-stat">
          <span class="biz-detail-stat-value">${maxClaims}</span>
          <span class="biz-detail-stat-label">Max Claims</span>
        </div>
        <div class="biz-detail-stat">
          <span class="biz-detail-stat-value">${biz.businessXp}</span>
          <span class="biz-detail-stat-label">Total Biz XP</span>
        </div>
      </div>
    `;

    // Upgrades
    if (def.upgrades && def.upgrades.length > 0) {
      html += '<h3 style="margin-bottom:8px;font-size:14px;color:var(--text-secondary)">UPGRADES</h3>';
      html += '<div class="upgrade-list">';

      for (const upg of def.upgrades) {
        const currentLevel = biz.upgrades[upg.id] || 0;
        const maxed = currentLevel >= upg.maxLevel;
        const cost = maxed ? 0 : getUpgradeCost(upg, currentLevel);
        const canAfford = biz.businessMoney >= cost;
        const meetsLevelReq = playerLevel >= (upg.levelReqBase || 0);

        let effectText = '';
        if (upg.type === 'boost') {
          effectText = `+${Math.round((upg.moneyBoostPerLevel || 0) * 100)}% money, +${Math.round((upg.xpBoostPerLevel || 0) * 100)}% XP per level`;
        } else if (upg.type === 'claim_storage') {
          effectText = `+${upg.claimStorageBonus} max claims per level`;
        }

        let btnLabel = maxed ? 'Maxed' : `Upgrade (${cost} 💎)`;
        let btnDisabled = maxed || !canAfford || !meetsLevelReq;
        let reqNote = '';
        if (!meetsLevelReq && !maxed) {
          reqNote = `<div style="font-size:11px;color:var(--accent-orange);margin-top:2px">Requires Player Level ${upg.levelReqBase}</div>`;
        }

        html += `
          <div class="upgrade-card">
            <div class="upgrade-header">
              <span class="upgrade-name">${upg.name}</span>
              <span class="upgrade-level">Lv. ${currentLevel}/${upg.maxLevel}</span>
            </div>
            <div class="upgrade-desc">${upg.description} &middot; ${effectText}</div>
            ${reqNote}
            <button class="btn-upgrade" data-upgrade-biz="${instanceId}" data-upgrade-id="${upg.id}" ${btnDisabled ? 'disabled' : ''}>
              ${btnLabel}
            </button>
          </div>
        `;
      }

      html += '</div>';
    }

    bodyEl.innerHTML = html;

    // Bind upgrade buttons
    bodyEl.querySelectorAll('.btn-upgrade').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        purchaseUpgrade(btn.dataset.upgradeBiz, btn.dataset.upgradeId);
      });
    });

    App.showModal('modal-business');
  }

  /* ===== UPGRADES ===== */
  function getUpgradeCost(upgradeDef, currentLevel) {
    return Math.ceil(upgradeDef.baseCost * Math.pow(upgradeDef.costMultiplier, currentLevel));
  }

  function purchaseUpgrade(instanceId, upgradeId) {
    const biz = getOwnedBusiness(instanceId);
    if (!biz) return;
    const def = getBusinessDef(biz.defId);
    if (!def) return;

    const upg = def.upgrades.find(u => u.id === upgradeId);
    if (!upg) return;

    const currentLevel = biz.upgrades[upg.id] || 0;
    if (currentLevel >= upg.maxLevel) return;

    const cost = getUpgradeCost(upg, currentLevel);
    if (biz.businessMoney < cost) return;

    const playerLevel = getPlayerLevel(_state.xp);
    if (playerLevel < (upg.levelReqBase || 0)) return;

    biz.businessMoney -= cost;
    biz.upgrades[upg.id] = currentLevel + 1;

    Storage.saveState(_state);
    App.renderTopbar();

    // Re-open the detail modal to show updated info
    openBusinessDetail(instanceId);
    App.showToast(`${upg.name} upgraded to Lv. ${currentLevel + 1}!`, 'info');
  }

  /* ===== COUNTDOWN TIMER ===== */
  function startCountdownUpdater() {
    if (_countdownInterval) clearInterval(_countdownInterval);
    _countdownInterval = setInterval(() => {
      document.querySelectorAll('.cycle-timer').forEach(el => {
        const nextTs = Number(el.dataset.next);
        if (!nextTs) return;
        const diff = nextTs - Date.now();
        if (diff <= 0) {
          el.textContent = 'Ready!';
          return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `Next in ${h}h ${m}m ${s}s`;
      });
    }, 1000);
  }

  /* ===== UNLOCK CHECK ===== */
  function checkUnlocks(playerLevel) {
    const newUnlocks = [];
    for (const def of _businessDefs) {
      if (playerLevel >= def.unlockLevel && !isBusinessOwned(def.id)) {
        newUnlocks.push(def);
      }
    }
    return newUnlocks;
  }

  /* ===== GET TOTAL BUSINESS MONEY ===== */
  function getTotalBusinessMoney() {
    return _state.businesses.reduce((sum, b) => sum + b.businessMoney, 0);
  }

  return {
    init,
    setState,
    renderGameView,
    purchaseBusiness,
    claimInterest,
    purchaseUpgrade,
    checkUnlocks,
    getTotalBusinessMoney,
    getAvailableCycles,
    getEffectiveMaxClaims,
    getBusinessDef,
    startCountdownUpdater
  };
})();
