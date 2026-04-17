/**
 * difficulty.js — Difficulty badge + panel + admin controls
 * Handles both user-facing toggle and admin lock controls
 * Also contains the BFCache fix for all protected pages.
 */
(function () {
    'use strict';

    // ── BFCache Fix: runs on ALL pages that include this script ──
    // When user hits Back after logout, pageshow fires with persisted=true.
    // We ping /api/session-check; if 401, session is gone → redirect to login.
    window.addEventListener('pageshow', function (evt) {
        if (evt.persisted) {
            fetch('/api/session-check', { credentials: 'include', cache: 'no-store' })
                .then(r => { if (r.status === 401) window.location.replace('/auth/login'); })
                .catch(() => window.location.replace('/auth/login'));
        }
    });

    // ── Opt ALL protected pages out of BFCache ──
    // A bare 'unload' listener causes browsers to skip BFCache for this page.
    // Every Back/Forward navigation hits the server → session check runs server-side.
    window.addEventListener('unload', function () {});

    const VULN_MAP = {
        easy: {
            label: '🟢 Easy',
            desc: 'Basic attacks enabled',
            tags: ['SQLi', 'XSS', 'CSRF', 'IDOR', 'Mass Assignment', 'Cookie Theft']
        },
        medium: {
            label: '🟡 Medium',
            desc: 'Filters added — bypass required',
            tags: ['SQLi (--comment)', 'SVG XSS', 'CSRF Token Bypass', 'Base64 IDOR', 'Rate-Limit Bypass']
        },
        hard: {
            label: '🔴 Hard',
            desc: 'Advanced techniques needed',
            tags: ['JWT none-alg', 'Blind SQLi', 'UUID IDOR', 'SSRF', 'bcrypt bypass', 'Token Reuse']
        }
    };

    // ── Inject difficulty badge ──────────────────────────────
    function injectBadge(currentDifficulty, isLocked) {
        const existing = document.getElementById('diff-badge');
        if (existing) existing.remove();

        const badge = document.createElement('button');
        badge.id = 'diff-badge';
        badge.className = `difficulty-badge ${currentDifficulty}`;
        badge.setAttribute('aria-label', 'Toggle difficulty panel');
        badge.innerHTML = `
            <span class="badge-dot"></span>
            <span>${VULN_MAP[currentDifficulty].label}</span>
            ${isLocked ? '<span class="lock-icon">🔒</span>' : ''}
        `;
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel(currentDifficulty, isLocked);
        });
        document.body.appendChild(badge);
    }

    // ── Inject difficulty panel ──────────────────────────────
    function injectPanel(currentDifficulty, isLocked) {
        const existing = document.getElementById('diff-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'diff-panel';
        panel.className = 'difficulty-panel';

        const levels = ['easy', 'medium', 'hard'];
        const btnHtml = levels.map(lvl => `
            <button class="diff-btn ${currentDifficulty === lvl ? `active-${lvl}` : ''}"
                    data-level="${lvl}"
                    ${isLocked && currentDifficulty !== lvl ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}>
                <span class="diff-icon">${lvl === 'easy' ? '🟢' : lvl === 'medium' ? '🟡' : '🔴'}</span>
                <span class="diff-info">
                    <span class="diff-label">${lvl.charAt(0).toUpperCase() + lvl.slice(1)}</span>
                    <span class="diff-desc">${VULN_MAP[lvl].desc}</span>
                </span>
                <span class="diff-check">${currentDifficulty === lvl ? '✓' : ''}</span>
            </button>
        `).join('');

        const vulnInfo = VULN_MAP[currentDifficulty];
        const tagsHtml = vulnInfo.tags.map(t => `<span class="vuln-tag">${t}</span>`).join('');

        panel.innerHTML = `
            <h3>🎯 Attack Difficulty</h3>
            <div class="difficulty-options">${btnHtml}</div>
            ${isLocked ? `<div class="diff-locked-msg">🔒 Locked by administrator</div>` : ''}
            <div class="diff-vuln-info ${currentDifficulty}">
                <div class="vuln-title">Active Attack Surface</div>
                ${tagsHtml}
            </div>
        `;

        document.body.appendChild(panel);

        // Attach button handlers
        panel.querySelectorAll('.diff-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const level = btn.dataset.level;
                if (level === currentDifficulty) return;
                setDifficulty(level);
            });
        });
    }

    // ── Toggle panel visibility ──────────────────────────────
    function togglePanel(currentDifficulty, isLocked) {
        let panel = document.getElementById('diff-panel');
        if (!panel) {
            injectPanel(currentDifficulty, isLocked);
            panel = document.getElementById('diff-panel');
        }
        panel.classList.toggle('visible');
    }

    // ── Set difficulty via API ───────────────────────────────
    async function setDifficulty(level) {
        try {
            const response = await fetch('/auth/set-difficulty', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level })
            });
            const result = await response.json();
            if (result.success) {
                // Reload to apply new difficulty globally
                window.location.reload();
            } else {
                alert(result.error || 'Failed to change difficulty.');
            }
        } catch (e) {
            alert('Network error changing difficulty.');
        }
    }

    // ── Admin: Set difficulty + lock via admin route ─────────
    window.adminSetDifficulty = async function (level, lock) {
        try {
            const response = await fetch('/admin/set-difficulty', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, lock: lock ? 'true' : 'false' })
            });
            const result = await response.json();
            if (result.success) {
                window.location.reload();
            } else {
                alert(result.error || 'Failed to update difficulty.');
            }
        } catch (e) {
            alert('Network error.');
        }
    };

    // ── Close panel on outside click ─────────────────────────
    document.addEventListener('click', () => {
        const panel = document.getElementById('diff-panel');
        if (panel) panel.classList.remove('visible');
    });

    // ── Init from data attribute on body ─────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        const difficulty = document.body.dataset.difficulty || 'easy';
        const isLocked = document.body.dataset.locked === 'true';
        injectBadge(difficulty, isLocked);
    });
})();
