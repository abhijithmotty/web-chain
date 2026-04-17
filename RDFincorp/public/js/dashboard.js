/* ─── BFCache Fix: Redirect to login if page shown from cache ─── */
/* This fires when the browser restores a page from the Back/Forward Cache.  */
/* It verifies the session is still valid; if not (post-logout), it redirects. */
window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
        // Page was restored from BFCache — verify session is still live
        fetch('/api/session-check', { credentials: 'include', cache: 'no-store' })
            .then(r => {
                if (r.status === 401) window.location.replace('/auth/login');
            })
            .catch(() => {
                window.location.replace('/auth/login');
            });
    }
});

/* ─── Opt this page OUT of BFCache entirely ─── */
/* A bare 'unload' listener tells the browser not to cache this page in     */
/* the Back/Forward Cache. Every nav hits the server → auth check runs.     */
window.addEventListener('unload', function () {});

/* ─── Dashboard JS — Fixed transfer + added rich feedback ─── */

document.addEventListener('DOMContentLoaded', () => {

    /* ── Transfer Form ─────────────────────────────────────── */
    const transferForm = document.getElementById('transferForm');
    const transferMessage = document.getElementById('transferMessage');
    const transferBtn = transferForm ? transferForm.querySelector('.btn-transfer') : null;

    if (transferForm) {
        transferForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(transferForm);
            const data = {
                from_user_id: formData.get('from_user_id'),
                to_account:   formData.get('to_account'),
                amount:       formData.get('amount'),
                notes:        formData.get('notes')
            };

            if (!data.to_account || !data.amount || parseFloat(data.amount) <= 0) {
                showMessage('error', '⚠️ Please fill in all required fields with valid values.');
                return;
            }

            if (transferBtn) {
                transferBtn.disabled = true;
                transferBtn.textContent = 'Processing...';
            }

            try {
                const response = await fetch('/api/transfer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (result.success) {
                    showMessage('success', `✅ ${result.message}`);
                    transferForm.reset();
                    // Reload page after 2s to reflect updated balance
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    showMessage('error', `❌ ${result.error || 'Transfer failed. Please try again.'}`);
                }
            } catch (err) {
                showMessage('error', `❌ Network error: ${err.message}`);
            } finally {
                if (transferBtn) {
                    transferBtn.disabled = false;
                    transferBtn.textContent = 'Transfer Now';
                }
            }
        });
    }

    function showMessage(type, text) {
        if (!transferMessage) return;
        transferMessage.innerHTML = `<div class="transfer-msg ${type}">${text}</div>`;
        setTimeout(() => { transferMessage.innerHTML = ''; }, 4000);
    }

    /* ── Animate balance number on load ───────────────────── */
    const balanceEl = document.querySelector('.balance-amount');
    if (balanceEl) {
        const raw = balanceEl.textContent.replace(/[$,]/g, '').trim();
        const target = parseFloat(raw);
        if (!isNaN(target)) {
            let start = 0;
            const duration = 1000;
            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = Math.min((timestamp - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                balanceEl.textContent = '$' + (eased * target).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }
    }
});
