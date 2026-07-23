'use strict';

// ── Storage key ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'everyone-is-john-v1';

// ── State ─────────────────────────────────────────────────────────────────
let state = {
    voices: [],
    session: {
        johnState: 'awake',   // 'awake' | 'asleep'
        activeVoiceId: null
    }
};

// ── Persistence ───────────────────────────────────────────────────────────
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            // Shallow merge so future schema additions survive
            if (parsed.voices)  state.voices  = parsed.voices;
            if (parsed.session) state.session = { ...state.session, ...parsed.session };
        }
    } catch (e) {
        console.warn('Failed to load state:', e);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save state:', e);
    }
}

// ── Utilities ─────────────────────────────────────────────────────────────
function genId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

let toastTimer = null;
function showToast(msg, ms = 2800) {
    const el = document.getElementById('toast');
    document.getElementById('toast-message').textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── Voice Operations ──────────────────────────────────────────────────────
function addVoice(data) {
    const startWP = parseInt(data.startWillpower, 10);
    state.voices.push({
        id:               genId(),
        name:             data.name,
        willpower:        startWP,
        startWillpower:   startWP,
        skills:           data.skills.filter(s => s.trim() !== ''),
        obsessionLevel:   parseInt(data.obsessionLevel, 10),
        obsessionText:    data.obsessionText,
        obsessionRevealed: false,
        completions:      0
    });
    saveState();
    renderVoices();
}

function updateVoice(id, data) {
    const v = state.voices.find(v => v.id === id);
    if (!v) return;
    v.name           = data.name;
    v.startWillpower = parseInt(data.startWillpower, 10);
    v.skills         = data.skills.filter(s => s.trim() !== '');
    v.obsessionLevel = parseInt(data.obsessionLevel, 10);
    v.obsessionText  = data.obsessionText;
    saveState();
    renderVoices();
}

function deleteVoice(id) {
    if (!confirm('Delete this Voice permanently?')) return;
    state.voices = state.voices.filter(v => v.id !== id);
    if (state.session.activeVoiceId === id) state.session.activeVoiceId = null;
    saveState();
    render();
}

function adjustWillpower(id, delta) {
    const v = state.voices.find(v => v.id === id);
    if (!v) return;
    v.willpower = Math.max(0, Math.min(v.startWillpower, v.willpower + delta));
    saveState();
    renderVoices();
    renderJohnStatus();

    // Check all-zero condition
    if (delta < 0 && state.voices.length > 0 && state.voices.every(v => v.willpower === 0)) {
        showToast('💀 All Voices at 0 Willpower — session is over!', 4000);
        setTimeout(openEndSessionModal, 2200);
    }
}

function adjustCompletions(id, delta) {
    const v = state.voices.find(v => v.id === id);
    if (!v) return;
    v.completions = Math.max(0, v.completions + delta);
    saveState();
    renderVoices();
}

function toggleObsessionReveal(id) {
    const v = state.voices.find(v => v.id === id);
    if (!v) return;
    v.obsessionRevealed = !v.obsessionRevealed;
    saveState();
    renderVoices();
}

function setActiveVoice(id) {
    state.session.activeVoiceId = id;
    saveState();
    render();
}

function clearActiveVoice() {
    state.session.activeVoiceId = null;
    saveState();
    render();
}

function setJohnState(johnState) {
    state.session.johnState = johnState;
    saveState();
    renderJohnStatus();
}

function johnSleeps() {
    state.voices.forEach(v => {
        v.willpower = Math.min(v.startWillpower, v.willpower + 1);
    });
    setJohnState('asleep');
    saveState();
    render();
    showToast('💤 John sleeps. All Voices gain 1 Willpower!');
}

// ── Rendering ─────────────────────────────────────────────────────────────
function render() {
    renderJohnStatus();
    renderVoices();
}

function renderJohnStatus() {
    document.getElementById('btn-john-awake').classList.toggle('active', state.session.johnState === 'awake');
    document.getElementById('btn-john-asleep').classList.toggle('active', state.session.johnState === 'asleep');

    const active = state.voices.find(v => v.id === state.session.activeVoiceId);
    document.getElementById('active-voice-display').textContent = active ? active.name : 'Nobody';
}

function renderVoices() {
    const container = document.getElementById('voices-container');
    const emptyState = document.getElementById('empty-state');

    // Remove old cards but keep empty-state node
    container.querySelectorAll('.voice-card').forEach(el => el.remove());

    if (state.voices.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    state.voices.forEach(voice => {
        container.insertBefore(buildVoiceCard(voice), emptyState);
    });
}

function buildVoiceCard(voice) {
    const isActive = voice.id === state.session.activeVoiceId;
    const score    = voice.completions * voice.obsessionLevel;

    const card = document.createElement('div');
    card.className = 'voice-card' + (isActive ? ' is-active' : '');
    card.dataset.id = voice.id;

    const skillsHtml = voice.skills.length
        ? '<ul>' + voice.skills.map(s => `<li>${escapeHtml(s)}</li>`).join('') + '</ul>'
        : '<span class="no-content">No skills defined.</span>';

    const controlBtn = isActive
        ? `<button class="btn-control is-active" data-action="relinquish" data-id="${voice.id}">✓ In Control</button>`
        : `<button class="btn-control" data-action="make-active" data-id="${voice.id}">Take Control</button>`;

    card.innerHTML = `
        <div class="card-header">
            <h2 class="voice-name">${escapeHtml(voice.name)}</h2>
            ${isActive ? '<span class="active-badge">🧠 In Control</span>' : ''}
        </div>

        <div class="willpower-section">
            <span class="wp-label">Willpower</span>
            <div class="wp-controls">
                <button class="wp-btn" data-action="wp-down" data-id="${voice.id}"
                    ${voice.willpower <= 0 ? 'disabled' : ''} aria-label="Decrease willpower">−</button>
                <span class="wp-value${voice.willpower === 0 ? ' wp-zero' : ''}">${voice.willpower}</span>
                <button class="wp-btn" data-action="wp-up" data-id="${voice.id}"
                    ${voice.willpower >= voice.startWillpower ? 'disabled' : ''} aria-label="Increase willpower">+</button>
            </div>
            <span class="wp-max">/ ${voice.startWillpower}</span>
        </div>

        <div class="skills-section">
            <span class="section-label">Skills</span>
            ${skillsHtml}
        </div>

        <div class="obsession-section">
            <div class="obsession-header">
                <span class="section-label" style="margin:0">Obsession (Lvl ${voice.obsessionLevel})</span>
                <button class="btn-reveal" data-action="toggle-obsession" data-id="${voice.id}">
                    ${voice.obsessionRevealed ? '🙈 Hide' : '👁 Reveal'}
                </button>
            </div>
            <div class="obsession-text${voice.obsessionRevealed ? '' : ' blurred'}">
                ${escapeHtml(voice.obsessionText)}
            </div>
        </div>

        <div class="completions-section">
            <span class="comp-label">Completions</span>
            <div class="comp-controls">
                <button class="comp-btn" data-action="comp-down" data-id="${voice.id}"
                    ${voice.completions <= 0 ? 'disabled' : ''} aria-label="Decrease completions">−</button>
                <span class="comp-value">${voice.completions}</span>
                <button class="comp-btn" data-action="comp-up" data-id="${voice.id}" aria-label="Increase completions">+</button>
            </div>
            <span class="score-display">Score: <strong>${score}</strong></span>
        </div>

        <div class="card-actions">
            ${controlBtn}
            <button class="btn-edit" data-action="edit" data-id="${voice.id}">✏️ Edit</button>
            <button class="btn-delete" data-action="delete" data-id="${voice.id}">🗑️ Delete</button>
        </div>
    `;

    return card;
}

// ── Voice Modal ───────────────────────────────────────────────────────────
function openAddVoiceModal() {
    document.getElementById('voice-modal-title').textContent = 'Add Voice';
    document.getElementById('edit-voice-id').value = '';
    document.getElementById('voice-form').reset();
    document.getElementById('skill-3-row').classList.add('hidden');
    openModal('voice-modal');
    document.getElementById('input-name').focus();
}

function openEditVoiceModal(id) {
    const v = state.voices.find(v => v.id === id);
    if (!v) return;

    document.getElementById('voice-modal-title').textContent = 'Edit Voice';
    document.getElementById('edit-voice-id').value = id;
    document.getElementById('input-name').value = v.name;
    document.getElementById('input-start-wp').value = v.startWillpower;
    document.getElementById('skill-1').value = v.skills[0] || '';
    document.getElementById('skill-2').value = v.skills[1] || '';
    document.getElementById('skill-3').value = v.skills[2] || '';
    document.getElementById('skill-3-row').classList.toggle('hidden', v.startWillpower !== 7);
    document.getElementById('input-obsession-level').value = v.obsessionLevel;
    document.getElementById('input-obsession-text').value = v.obsessionText;

    openModal('voice-modal');
    document.getElementById('input-name').focus();
}

function handleVoiceFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('input-name').value.trim();
    if (!name) { document.getElementById('input-name').focus(); return; }

    const obsessionText = document.getElementById('input-obsession-text').value.trim();
    if (!obsessionText) { document.getElementById('input-obsession-text').focus(); return; }

    const startWP = parseInt(document.getElementById('input-start-wp').value, 10);
    const skills  = [
        document.getElementById('skill-1').value.trim(),
        document.getElementById('skill-2').value.trim()
    ];
    if (startWP === 7) skills.push(document.getElementById('skill-3').value.trim());

    const data = {
        name,
        startWillpower: startWP,
        skills,
        obsessionLevel: document.getElementById('input-obsession-level').value,
        obsessionText
    };

    const id = document.getElementById('edit-voice-id').value;
    if (id) updateVoice(id, data);
    else    addVoice(data);

    closeModal('voice-modal');
}

function handleStartWPChange(e) {
    document.getElementById('skill-3-row').classList.toggle('hidden', parseInt(e.target.value, 10) !== 7);
}

// ── Bid Modal ─────────────────────────────────────────────────────────────
let bidState = null;

function openBidModal() {
    if (state.voices.length < 2) {
        showToast('Need at least 2 Voices to bid!');
        return;
    }
    bidState = { step: 'collecting', voiceIndex: 0, bids: {} };
    renderBidModal();
    openModal('bid-modal');
}

function renderBidModal() {
    const content = document.getElementById('bid-content');

    if (bidState.step === 'collecting') {
        const voice = state.voices[bidState.voiceIndex];
        const total = state.voices.length;

        content.innerHTML = `
            <div class="bid-phase-prompt">
                <h3>🤲 ${escapeHtml(voice.name)}'s Bid</h3>
                <p>Everyone else look away!<br>
                   <small>Current WP: <strong>${voice.willpower}</strong> &nbsp;·&nbsp; Player ${bidState.voiceIndex + 1} of ${total}</small></p>
                <input type="number" id="bid-input" class="bid-secret-input"
                    min="0" max="${voice.willpower}" placeholder="0"
                    autocomplete="off" inputmode="numeric">
                <p class="bid-peek-note">✋ What you type is hidden — others can't see it.</p>
            </div>
            <div class="bid-actions">
                <button id="btn-bid-submit" class="btn btn-primary">Submit →</button>
                <button id="btn-bid-pass"   class="btn btn-secondary">Pass (bid 0)</button>
            </div>
        `;

        const input = document.getElementById('bid-input');
        setTimeout(() => input.focus(), 80);

        document.getElementById('btn-bid-submit').addEventListener('click', commitBid);
        document.getElementById('btn-bid-pass').addEventListener('click', () => recordBid(0));
        input.addEventListener('keydown', e => { if (e.key === 'Enter') commitBid(); });

    } else if (bidState.step === 'reveal') {
        const sorted = [...state.voices]
            .filter(v => bidState.bids[v.id] !== undefined)
            .sort((a, b) => bidState.bids[b.id] - bidState.bids[a.id]);

        if (sorted.length === 0) {
            content.innerHTML = '<p style="text-align:center;padding:16px">No bids to show.</p>';
            return;
        }

        const maxBid   = bidState.bids[sorted[0].id];
        const winners  = sorted.filter(v => bidState.bids[v.id] === maxBid);
        const isTie    = winners.length > 1;

        const winnerMsg = isTie
            ? `🎲 Tie! ${winners.map(v => escapeHtml(v.name)).join(' &amp; ')} must roll off!`
            : `🧠 ${escapeHtml(winners[0].name)} takes control! (−${maxBid} WP)`;

        const rowsHtml = sorted.map(v => `
            <div class="bid-result-row${bidState.bids[v.id] === maxBid ? ' winner' : ''}">
                <span class="voice-bid-name">${escapeHtml(v.name)}</span>
                <span class="voice-bid-amount">${bidState.bids[v.id]} WP</span>
            </div>
        `).join('');

        const applyBtn = !isTie
            ? `<button id="btn-apply-win" class="btn btn-primary">✓ Apply Result</button>`
            : '';

        content.innerHTML = `
            <div class="bid-winner-banner">${winnerMsg}</div>
            <div class="bid-results">${rowsHtml}</div>
            <p class="bid-footer-note">Winner loses their bid. Others keep theirs.</p>
            <div class="bid-actions" style="flex-wrap:wrap;gap:8px;">
                ${applyBtn}
                <button id="btn-bid-redo"   class="btn btn-secondary">Redo Bid</button>
                <button id="btn-bid-cancel" class="btn btn-secondary">Cancel</button>
            </div>
        `;

        document.getElementById('btn-apply-win')?.addEventListener('click', () => {
            const winner = winners[0];
            winner.willpower = Math.max(0, winner.willpower - maxBid);
            state.session.activeVoiceId = winner.id;
            saveState();
            render();
            closeModal('bid-modal');
            showToast(`🧠 ${winner.name} takes control of John!`);
        });

        document.getElementById('btn-bid-redo').addEventListener('click', () => {
            bidState = { step: 'collecting', voiceIndex: 0, bids: {} };
            renderBidModal();
        });

        document.getElementById('btn-bid-cancel').addEventListener('click', () => closeModal('bid-modal'));
    }
}

function commitBid() {
    const input  = document.getElementById('bid-input');
    const voice  = state.voices[bidState.voiceIndex];
    let amount   = parseInt(input.value, 10);
    if (isNaN(amount) || amount < 0) amount = 0;
    if (amount > voice.willpower)    amount = voice.willpower;
    recordBid(amount);
}

function recordBid(amount) {
    const voice = state.voices[bidState.voiceIndex];
    bidState.bids[voice.id] = amount;
    bidState.voiceIndex++;

    if (bidState.voiceIndex >= state.voices.length) {
        bidState.step = 'reveal';
    }

    renderBidModal();
}

// ── End Session Modal ─────────────────────────────────────────────────────
function openEndSessionModal() {
    const sorted = [...state.voices].sort((a, b) =>
        (b.completions * b.obsessionLevel) - (a.completions * a.obsessionLevel)
    );

    const maxScore = sorted.length ? sorted[0].completions * sorted[0].obsessionLevel : 0;

    const rowsHtml = sorted.map(v => {
        const score     = v.completions * v.obsessionLevel;
        const isWinner  = score === maxScore && score > 0;
        return `
            <div class="score-row${isWinner ? ' winner' : ''}">
                <div class="score-voice-info">
                    <span class="score-voice-name">${isWinner ? '🏆 ' : ''}${escapeHtml(v.name)}</span>
                    <span class="score-voice-obsession">
                        Lvl ${v.obsessionLevel}: ${escapeHtml(v.obsessionText)}
                        (×${v.completions})
                    </span>
                </div>
                <span class="score-points">${score}</span>
            </div>
        `;
    }).join('');

    document.getElementById('end-content').innerHTML =
        rowsHtml || '<p style="text-align:center;padding:16px;color:var(--text-muted)">No Voices to show.</p>';

    openModal('end-modal');
}

function startNewSession() {
    if (!confirm('Start a new session? This resets all Willpower and completion counts.')) return;
    state.voices.forEach(v => {
        v.willpower        = v.startWillpower;
        v.completions      = 0;
        v.obsessionRevealed = false;
    });
    state.session.activeVoiceId = null;
    state.session.johnState     = 'awake';
    saveState();
    render();
    closeModal('end-modal');
    showToast('🧠 New session started! Good luck, Voices.');
}

// ── d6 Roll ───────────────────────────────────────────────────────────────
function rollD6() {
    const result = Math.ceil(Math.random() * 6);
    const emoji  = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][result];
    showToast(`🎲 Rolled a ${result} ${emoji}`, 2500);
}

// ── Event Binding ─────────────────────────────────────────────────────────
function bindEvents() {
    // Header
    document.getElementById('btn-roll-d6').addEventListener('click', rollD6);
    document.getElementById('btn-rules').addEventListener('click', () => openModal('rules-modal'));

    // John state toggles
    document.getElementById('btn-john-awake').addEventListener('click',  () => setJohnState('awake'));
    document.getElementById('btn-john-asleep').addEventListener('click', () => setJohnState('asleep'));

    // Main control buttons
    document.getElementById('btn-add-voice').addEventListener('click',   openAddVoiceModal);
    document.getElementById('btn-bid').addEventListener('click',          openBidModal);
    document.getElementById('btn-john-sleeps').addEventListener('click', johnSleeps);
    document.getElementById('btn-end-session').addEventListener('click', openEndSessionModal);

    // Empty state "add first" button
    document.getElementById('btn-add-first').addEventListener('click', openAddVoiceModal);

    // Voice modal
    document.getElementById('btn-close-voice-modal').addEventListener('click', () => closeModal('voice-modal'));
    document.getElementById('btn-cancel-voice').addEventListener('click',       () => closeModal('voice-modal'));
    document.getElementById('input-start-wp').addEventListener('change', handleStartWPChange);
    document.getElementById('voice-form').addEventListener('submit', handleVoiceFormSubmit);

    // Bid modal close
    document.getElementById('btn-close-bid-modal').addEventListener('click', () => closeModal('bid-modal'));

    // End session modal
    document.getElementById('btn-close-end-modal').addEventListener('click', () => closeModal('end-modal'));
    document.getElementById('btn-new-session').addEventListener('click',     startNewSession);
    document.getElementById('btn-close-end').addEventListener('click',       () => closeModal('end-modal'));

    // Rules modal
    document.getElementById('btn-close-rules').addEventListener('click',  () => closeModal('rules-modal'));
    document.getElementById('btn-close-rules-2').addEventListener('click', () => closeModal('rules-modal'));

    // ── Delegated card events ──
    document.getElementById('voices-container').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;
        switch (action) {
            case 'wp-up':            adjustWillpower(id, +1);    break;
            case 'wp-down':          adjustWillpower(id, -1);    break;
            case 'comp-up':          adjustCompletions(id, +1);  break;
            case 'comp-down':        adjustCompletions(id, -1);  break;
            case 'toggle-obsession': toggleObsessionReveal(id);  break;
            case 'make-active':      setActiveVoice(id);         break;
            case 'relinquish':       clearActiveVoice();         break;
            case 'edit':             openEditVoiceModal(id);     break;
            case 'delete':           deleteVoice(id);            break;
        }
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    });

    // Close modals on Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
        }
    });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
loadState();
bindEvents();
render();

