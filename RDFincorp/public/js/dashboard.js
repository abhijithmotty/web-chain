// Dashboard JavaScript functionality

document.addEventListener('DOMContentLoaded', function () {
    // Transfer form handling
    const transferForm = document.getElementById('transferForm');
    const transferMessage = document.getElementById('transferMessage');

    if (transferForm) {
        transferForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(transferForm);
            const data = {
                from_user_id: formData.get('from_user_id'),
                to_account: formData.get('to_account'),
                amount: parseFloat(formData.get('amount')),
                notes: formData.get('notes')
            };

            try {
                const response = await fetch('/api/transfer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    transferMessage.className = 'success';
                    transferMessage.textContent = 'Transfer successful! Reloading...';
                    transferForm.reset();
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    transferMessage.className = 'error';
                    transferMessage.textContent = result.error || 'Transfer failed';
                }
            } catch (error) {
                transferMessage.className = 'error';
                transferMessage.textContent = 'Network error occurred';
            }
        });
    }

    // Add smooth animations
    const cards = document.querySelectorAll('.credit-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
});
