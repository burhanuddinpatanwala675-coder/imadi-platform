const form = document.querySelector('#login-form');
const status = document.querySelector('#status');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    status.textContent = 'Logging in...';

    try {
        const response = await fetch(
            '/api/admin/auth/login',
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    email: document.querySelector('#email').value,
                    password: document.querySelector('#password').value
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error?.message || 'Login failed'
            );
        }

        status.textContent = 'Login successful';

        window.location.href = 'dashboard.html';

    } catch (error) {
        status.textContent = error instanceof TypeError
            ? 'Cannot reach the API. Start the Imadi server and open the admin page at http://localhost:3000/admin/.'
            : error.message;
    }
});
