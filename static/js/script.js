document.addEventListener('DOMContentLoaded', function() {
    // Password toggle functionality
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const passwordInput = this.parentElement.querySelector('input');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.querySelector('img').style.opacity = '1';
            } else {
                passwordInput.type = 'password';
                this.querySelector('img').style.opacity = '0.5';
            }
        });
    });

    // Form animations
    const formInputs = document.querySelectorAll('.form-group input');
    formInputs.forEach(input => {
        // Add focus animation
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
            animateFormField(this, true);
        });

        // Remove focus animation
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
            animateFormField(this, false);
        });

        // Check if input has value on load
        if (input.value) {
            input.parentElement.classList.add('focused');
        }
    });

    // Animate form fields on focus/blur
    function animateFormField(element, isFocused) {
        if (isFocused) {
            element.style.transform = 'translateY(-3px)';
            setTimeout(() => {
                element.style.transform = 'translateY(0)';
            }, 200);
        }
    }

    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const messageDiv = document.getElementById('message');
            
            // Clear previous messages
            messageDiv.textContent = '';
            messageDiv.className = 'message';
            
            // Send login request
            fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    messageDiv.textContent = 'Login successful! Redirecting...';
                    messageDiv.classList.add('success');
                    messageDiv.style.display = 'block';
                    
                    // Redirect to dashboard
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1500);
                } else {
                    // Show error message
                    messageDiv.textContent = data.message || 'Login failed. Please check your credentials.';
                    messageDiv.classList.add('error');
                    messageDiv.style.display = 'block';
                    
                    // Shake animation for error
                    loginForm.classList.add('shake');
                    setTimeout(() => {
                        loginForm.classList.remove('shake');
                    }, 500);
                }
            })
            .catch(error => {
                messageDiv.textContent = 'An error occurred. Please try again.';
                messageDiv.classList.add('error');
                messageDiv.style.display = 'block';
                console.error('Error:', error);
            });
        });
    }

    // Register form submission
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm_password').value;
            const messageDiv = document.getElementById('message');
            
            // Clear previous messages
            messageDiv.textContent = '';
            messageDiv.className = 'message';
            
            // Validate passwords match
            if (password !== confirmPassword) {
                messageDiv.textContent = 'Passwords do not match.';
                messageDiv.classList.add('error');
                messageDiv.style.display = 'block';
                return;
            }
            
            // Send registration request
            fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    messageDiv.textContent = 'Registration successful! Redirecting to login...';
                    messageDiv.classList.add('success');
                    messageDiv.style.display = 'block';
                    
                    // Redirect to login page
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                } else {
                    // Show error message
                    messageDiv.textContent = data.message || 'Registration failed. Please try again.';
                    messageDiv.classList.add('error');
                    messageDiv.style.display = 'block';
                }
            })
            .catch(error => {
                messageDiv.textContent = 'An error occurred. Please try again.';
                messageDiv.classList.add('error');
                messageDiv.style.display = 'block';
                console.error('Error:', error);
            });
        });
    }

    // Add entrance animations
    document.querySelector('.login-card').classList.add('animated');
});

// Add CSS animation class
document.addEventListener('DOMContentLoaded', function() {
    // Add shake animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .shake {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
    `;
    document.head.appendChild(style);
});
