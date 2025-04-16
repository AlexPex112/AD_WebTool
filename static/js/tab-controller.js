document.addEventListener('DOMContentLoaded', function() {
    // Get all sidebar navigation items and content tabs
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Add click event listeners to each navigation item
    navItems.forEach(item => {
        if (item.getAttribute('href') === '#') {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Get the tab name from data-tab attribute
                const tabName = this.getAttribute('data-tab');
                
                // Exit if this is not a tab nav item
                if (!tabName) return;
                
                console.log(`Tab clicked: ${tabName}`);
                
                // Remove active class from all nav items
                navItems.forEach(navItem => {
                    navItem.classList.remove('active');
                });
                
                // Add active class to current nav item
                this.classList.add('active');
                
                // Hide all tab contents
                tabContents.forEach(content => {
                    content.style.display = 'none';
                    content.classList.remove('active');
                });
                
                // Show the corresponding tab content
                const targetTabId = `${tabName}-tab`;
                const targetTab = document.getElementById(targetTabId);
                
                if (targetTab) {
                    console.log(`Activating tab: ${targetTabId}`);
                    targetTab.style.display = 'block';
                    targetTab.classList.add('active');
                    
                    // Load data if needed
                    if (tabName === 'users' && 
                        document.querySelector('#users-table tbody tr td.loading-message')) {
                        console.log('Loading users data');
                        if (typeof loadUsers === 'function') {
                            loadUsers();
                        }
                    }
                    
                    if (tabName === 'groups' && 
                        document.querySelector('#groups-table tbody tr td.loading-message')) {
                        console.log('Loading groups data');
                        if (typeof loadGroups === 'function') {
                            loadGroups();
                        }
                    }
                } else {
                    console.error(`Tab content not found: ${targetTabId}`);
                }
            });
        }
    });
    
    // Also initialize the data preview tabs
    const dataTabs = document.querySelectorAll('.data-tab');
    const dataPanels = document.querySelectorAll('.data-panel');
    
    dataTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active from all tabs and panels
            dataTabs.forEach(t => t.classList.remove('active'));
            dataPanels.forEach(p => p.classList.remove('active'));
            
            // Add active to current tab and panel
            this.classList.add('active');
            const targetPanelId = this.getAttribute('data-target');
            const targetPanel = document.getElementById(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
    
    // Set initial state - ensure the dashboard tab is active by default
    const defaultTab = document.querySelector('.sidebar-nav .nav-item.active');
    if (defaultTab) {
        // Trigger click to set up the initial state
        defaultTab.click();
    }
});
