document.addEventListener('DOMContentLoaded', function() {

    // Button hover effects
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
        });

        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });

        button.addEventListener('click', function() {
            this.style.transform = 'translateY(2px)';
            setTimeout(() => {
                this.style.transform = 'translateY(0)';
            }, 200);
        });
    });

});

