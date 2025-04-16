document.addEventListener('DOMContentLoaded', function() {
    // Toggle password visibility
    const togglePasswordIcon = document.getElementById('toggle-password-icon');
    const passwordInput = document.getElementById('new-user-password');

    if (togglePasswordIcon && passwordInput) {
        togglePasswordIcon.addEventListener('click', function() {
            const isPasswordVisible = passwordInput.type === 'text';
            passwordInput.type = isPasswordVisible ? 'password' : 'text';
            togglePasswordIcon.src = isPasswordVisible 
                ? '/static/img/eye.svg' 
                : '/static/img/eye-off.svg';
        });
    }
    // Initial debug log
    console.log("DOM loaded - initializing dashboard...");
    
    // Navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');
    
    // Initialize all modals
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-modal');
    
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            modal.style.display = 'none';
        });
    });
    
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Set up password toggles for all password fields
    setupPasswordToggles();
    
    // Initialize tabs
    initializeTabs();
    
    // Load initial data immediately for dashboard
    try {
        // First hide the loader if it exists
        const pageLoader = document.getElementById('page-loader');
        if (pageLoader) {
            setTimeout(() => {
                pageLoader.classList.add('hidden');
                setTimeout(() => pageLoader.style.display = 'none', 300);
            }, 1000);
        }
        
        console.log("Loading initial dashboard data...");
        loadDashboardData();
        
        // Also load the users data for the first tab that might be visible
        loadUsers();
    } catch (e) {
        console.error("Error during initial data load:", e);
        showErrorMessage("Failed to load initial data. Please refresh the page.");
    }
    
    // Reset Password form setup
    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('reset-username').value;
            const password = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-new-password').value;
            const resultDiv = document.getElementById('reset-password-result');
            
            if (password !== confirmPassword) {
                resultDiv.textContent = 'Passwords do not match';
                resultDiv.className = 'message error';
                return;
            }
            
            resultDiv.textContent = 'Resetting password...';
            resultDiv.className = 'message';
            
            // Call API to reset password
            resetUserPassword(username, password, resultDiv);
        });
    }
    
    // Toggle User Status form setup
    const toggleUserForm = document.getElementById('toggle-user-form');
    if (toggleUserForm) {
        toggleUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('toggle-username').value;
            const action = document.querySelector('input[name="toggle-action"]:checked')?.value;
            const resultDiv = document.getElementById('toggle-user-result');
            
            if (!action) {
                resultDiv.textContent = 'Please select an action';
                resultDiv.className = 'message error';
                return;
            }
            
            resultDiv.textContent = `${action === 'enable' ? 'Enabling' : 'Disabling'} user...`;
            resultDiv.className = 'message';
            
            // Call API to toggle user status
            toggleUserStatus(username, action, resultDiv);
        });
    }
    
    // Load data when tab is clicked
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            if (tabId === 'users') {
                loadUsers();
            } else if (tabId === 'groups') {
                loadGroups();
            } else if (tabId === 'computers') {
                loadComputers();
            }
        });
    });
});

// Setup password toggle functionality
function setupPasswordToggles() {
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
}

// Initialize tab navigation
function initializeTabs() {
    const tabs = document.querySelectorAll('.sidebar-nav .nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
                
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Show corresponding content
                const tabId = this.getAttribute('data-tab');
                const content = document.getElementById(tabId + '-tab');
                if (content) {
                    content.classList.add('active');
                }
            }
        });
    });
}

// Reset user password
function resetUserPassword(username, password, resultDiv) {
    fetch(`/api/ad/user/${username}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'reset_password',
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            resultDiv.textContent = data.message || 'Password reset successfully';
            resultDiv.className = 'message success';
            
            // Close the modal after 2 seconds
            setTimeout(() => {
                document.getElementById('reset-password-modal').style.display = 'none';
            }, 2000);
        } else {
            resultDiv.textContent = data.message || 'Failed to reset password';
            resultDiv.className = 'message error';
        }
    })
    .catch(error => {
        resultDiv.textContent = 'An error occurred. Please try again.';
        resultDiv.className = 'message error';
        console.error('Error:', error);
    });
}

// Toggle user status (enable/disable)
function toggleUserStatus(username, action, resultDiv) {
    console.log(`Toggling user status: ${username}, action: ${action}`);
    
    resultDiv.textContent = `${action === 'enable' ? 'Enabling' : 'Disabling'} user...`;
    resultDiv.className = 'message';
    
    fetch(`/api/ad/user/${encodeURIComponent(username)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: action })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errData => {
                throw new Error(errData.message || `Server returned ${response.status}: ${response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            resultDiv.textContent = data.message || `User ${action === 'enable' ? 'enabled' : 'disabled'} successfully`;
            resultDiv.className = 'message success';
            setTimeout(() => {
                document.getElementById('toggle-user-modal').style.display = 'none';
                loadUsers();
            }, 2000);
        } else {
            resultDiv.textContent = data.message || `Failed to ${action} user`;
            resultDiv.className = 'message error';
        }
    })
    .catch(error => {
        console.error('Error toggling user status:', error);
        resultDiv.textContent = `Error: ${error.message}`;
        resultDiv.className = 'message error';
    });
}

// View group members
function viewGroupMembers(groupName) {
    console.log(`Loading members for group: ${groupName}`);
    const modal = document.getElementById('group-members-modal');
    const membersList = document.getElementById('members-list');
    const groupNameDisplay = document.getElementById('group-name-display');
    
    if (modal && membersList && groupNameDisplay) {
        groupNameDisplay.textContent = groupName;
        membersList.innerHTML = '<p class="loading-message">Loading members...</p>';
        modal.style.display = 'flex';
        
        fetch(`/api/ad/group/${encodeURIComponent(groupName)}/members`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errData => {
                        throw new Error(errData.message || `Server returned ${response.status}: ${response.statusText}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    if (data.members && data.members.length > 0) {
                        membersList.innerHTML = '';
                        data.members.forEach(memberDn => {
                            const memberItem = document.createElement('div');
                            memberItem.className = 'member-item';
                            const displayName = memberDn.match(/CN=([^,]+)/)?.[1] || memberDn;
                            memberItem.innerHTML = `
                                <span title="${memberDn}">${displayName}</span>
                                <span title="" data-dn="${memberDn}" data-group="${groupName}"></button>
                            `;
                            membersList.appendChild(memberItem);
                        });
                        document.querySelectorAll('#members-list .delete').forEach(button => {
                            button.addEventListener('click', function() {
                                const memberDn = this.getAttribute('data-dn');
                                const groupName = this.getAttribute('data-group');
                                removeGroupMember(memberDn, groupName, this);
                            });
                        });
                    } else {
                        membersList.innerHTML = '<p>No members found in this group.</p>';
                    }
                } else {
                    membersList.innerHTML = `<p class="error-message">${data.message || 'Failed to load group members'}</p>`;
                }
            })
            .catch(error => {
                console.error('Error loading group members:', error);
                membersList.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
            });
    }
}

// Remove user from group
function removeGroupMember(dn, groupName, button) {
    if (confirm(`Are you sure you want to remove ${dn} from ${groupName}?`)) {
        button.textContent = 'Removing...';
        button.disabled = true;
        
        fetch(`/api/ad/group/${encodeURIComponent(groupName)}/members`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dn: dn })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.message || `Server returned ${response.status}: ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const memberItem = button.closest('.member-item');
                memberItem.remove();
                if (document.querySelectorAll('.member-item').length === 0) {
                    document.getElementById('members-list').innerHTML = '<p>No members found in this group.</p>';
                }
                loadGroups();
            } else {
                button.textContent = 'Remove';
                button.disabled = false;
                alert(data.message || 'Failed to remove member from group');
            }
        })
        .catch(error => {
            console.error('Error removing group member:', error);
            button.textContent = 'Remove';
            button.disabled = false;
            alert(`Error: ${error.message}`);
        });
    }
}

// Load Users Data with improved error handling
function loadUsers() {
    console.log("Loading users data...");
    const tableBody = document.querySelector('#users-table tbody');
    if (!tableBody) {
        console.error("Users table body not found");
        return;
    }
    
    const loadingRow = document.createElement('tr');
    loadingRow.innerHTML = `<td colspan="5" class="loading-message">Loading users data...</td>`;
    tableBody.innerHTML = '';
    tableBody.appendChild(loadingRow);
    
    fetch('/api/ad/users')
        .then(response => {
            console.log("Users API response status:", response.status);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Received ${data.users ? data.users.length : 0} users from API`);
            tableBody.innerHTML = '';
            
            if (data.success && data.users && data.users.length > 0) {
                data.users.forEach(user => {
                    const row = document.createElement('tr');
                    
                    // Determine name - use cn, or combination of first/last name, or just username
                    const displayName = user.cn || 
                        (user.givenName && user.sn ? `${user.givenName} ${user.sn}` : user.sAMAccountName);
                    
                    row.innerHTML = `
                        <td>${displayName}</td>
                        <td>${user.sAMAccountName || ''}</td>
                        <td>${user.mail || ''}</td>
                        <td><span class="status-indicator ${user.enabled ? 'status-active' : 'status-disabled'}">
                            ${user.enabled ? 'Active' : 'Disabled'}
                        </span></td>
                        <td>
                            <button class="action-btn edit" data-username="${user.sAMAccountName}" data-action="reset">Reset Password</button>
                            <button class="action-btn ${user.enabled ? 'delete' : 'view'}" data-username="${user.sAMAccountName}" 
                                data-status="${user.enabled ? 'enabled' : 'disabled'}" data-action="${user.enabled ? 'disable' : 'enable'}">
                                ${user.enabled ? 'Disable' : 'Enable'}
                            </button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Set up action buttons
                console.log("Setting up user action buttons...");
                setupUserActionButtons();
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center">No users found or unable to retrieve user data.</td>
                    </tr>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading users:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center error">Error loading user data: ${error.message}</td>
                </tr>
            `;
        });
}

// Setup user action buttons
function setupUserActionButtons() {
    // Reset Password buttons
    document.querySelectorAll('#users-table .action-btn.edit[data-action="reset"]').forEach(button => {
        button.addEventListener('click', function() {
            const username = this.getAttribute('data-username');
            const resetModal = document.getElementById('reset-password-modal');
            
            if (resetModal) {
                document.getElementById('reset-username').value = username;
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-new-password').value = '';
                document.getElementById('reset-password-result').textContent = '';
                document.getElementById('reset-password-result').className = 'message';
                
                resetModal.style.display = 'flex';
                document.getElementById('new-password').focus();
            }
        });
    });
    
    // Enable/Disable buttons
    document.querySelectorAll('#users-table .action-btn[data-action="enable"], #users-table .action-btn[data-action="disable"]').forEach(button => {
        button.addEventListener('click', function() {
            const username = this.getAttribute('data-username');
            const currentStatus = this.getAttribute('data-status');
            const action = this.getAttribute('data-action');
            
            const toggleModal = document.getElementById('toggle-user-modal');
            
            if (toggleModal) {
                document.getElementById('toggle-username').value = username;
                document.getElementById('current-status').textContent = currentStatus === 'enabled' ? 'Active' : 'Disabled';
                document.getElementById('current-status').className = currentStatus === 'enabled' ? 'status-active' : 'status-disabled';
                
                // Select the appropriate radio button
                if (action === 'enable') {
                    document.getElementById('enable-user').checked = true;
                } else {
                    document.getElementById('disable-user').checked = true;
                }
                
                document.getElementById('toggle-user-result').textContent = '';
                document.getElementById('toggle-user-result').className = 'message';
                
                toggleModal.style.display = 'flex';
            } else {
                // Fallback if modal not available
                if (confirm(`Are you sure you want to ${action} the user ${username}?`)) {
                    toggleUserStatus(username, action);
                }
            }
        });
    });
}

// Load Groups Data with improved error handling
function loadGroups() {
    console.log("Loading groups data...");
    const tableBody = document.querySelector('#groups-table tbody');
    if (!tableBody) {
        console.error("Groups table body not found");
        return;
    }
    
    const loadingRow = document.createElement('tr');
    loadingRow.innerHTML = `<td colspan="4" class="loading-message">Loading groups data...</td>`;
    tableBody.innerHTML = '';
    tableBody.appendChild(loadingRow);
    
    fetch('/api/ad/groups')
        .then(response => {
            console.log("Groups API response status:", response.status);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Received ${data.groups ? data.groups.length : 0} groups from API`);
            tableBody.innerHTML = '';
            
            if (data.success && data.groups && data.groups.length > 0) {
                data.groups.forEach(group => {
                    const row = document.createElement('tr');
                    
                    // Calculate member count (handle different response formats)
                    const memberCount = group.member_count || 
                        (Array.isArray(group.member) ? group.member.length : 
                         (group.member ? 1 : 0));
                    
                    row.innerHTML = `
                        <td>${group.cn || ''}</td>
                        <td>${group.description || ''}</td>
                        <td>${memberCount}</td>
                        <td>
                            <button class="action-btn view" data-group="${group.cn}">View Members</button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Add event listeners to view members buttons
                console.log("Setting up group view buttons...");
                document.querySelectorAll('#groups-table .action-btn.view').forEach(button => {
                    button.addEventListener('click', function() {
                        const groupName = this.getAttribute('data-group');
                        viewGroupMembers(groupName);
                    });
                });
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center">No groups found or unable to retrieve group data.</td>
                    </tr>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading groups:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center error">Error loading group data: ${error.message}</td>
                </tr>
            `;
        });
}

// Load Computers Data
function loadComputers() {
    const tableBody = document.querySelector('#computers-table tbody');
    const loadingMessage = document.querySelector('#computers-table .loading-message');
    
    if (loadingMessage) {
        loadingMessage.style.display = 'table-row';
    }
    
    fetch('/api/dashboard-data')
        .then(response => response.json())
        .then(data => {
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }
            
            if (data.computerDetails && data.computerDetails.length > 0) {
                tableBody.innerHTML = '';
                
                data.computerDetails.forEach(computer => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${computer['Computer Name'] || ''}</td>
                        <td>${computer['IP Address'] || ''}</td>
                        <td><span class="status-indicator 
                            ${computer['Status'] === 'Online' ? 'status-online' : 'status-offline'}">
                            ${computer['Status'] || 'Unknown'}
                        </span></td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center">No computers found or unable to retrieve computer data.</td>
                    </tr>
                `;
            }
        })
        .catch(error => {
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }
            
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center error">Error loading computer data. Please try again.</td>
                </tr>
            `;
            console.error('Error:', error);
        });
}

// Load Dashboard Data
function loadDashboardData() {
    console.log("Fetching dashboard data from API...");
    
    // Make preview tables show loading state
    updatePreviewTableLoading('users-preview', true);
    updatePreviewTableLoading('groups-preview', true);
    updatePreviewTableLoading('computers-preview', true);
    
    fetch('/api/dashboard-data')
        .then(response => {
            console.log("Dashboard API response status:", response.status);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Dashboard data received:", data);
            
            // Update stats
            updateElementText('user-count', data.users || 0);
            updateElementText('group-count', data.groups || 0);
            updateElementText('computer-count', data.computers || 0);
            updateElementText('domain-controller-count', data.domainControllers || 0);
            
            // Update timestamp
            if (data.metadata && data.metadata.timestamp) {
                updateLastUpdateTime(data.metadata.timestamp);
            }
            
            // Update preview tables
            updatePreviewTable('users-preview', data.userDetails || []);
            updatePreviewTable('groups-preview', data.groupDetails || []);
            updatePreviewTable('computers-preview', data.computerDetails || []);
        })
        .catch(error => {
            console.error('Error fetching dashboard data:', error);
            
            // Show error in preview tables
            updatePreviewTableError('users-preview', 'Failed to load data');
            updatePreviewTableError('groups-preview', 'Failed to load data');
            updatePreviewTableError('computers-preview', 'Failed to load data');
            
            // Set counts to error state
            updateElementWithError('user-count', 'Error');
            updateElementWithError('group-count', 'Error');
            updateElementWithError('computer-count', 'Error');
            updateElementWithError('domain-controller-count', 'Error');
            
            // Update timestamp to show error
            updateLastUpdateTime('Failed to fetch data');
        })
        .finally(() => {
            // Remove loading state from tables
            updatePreviewTableLoading('users-preview', false);
            updatePreviewTableLoading('groups-preview', false);
            updatePreviewTableLoading('computers-preview', false);
        });
}

// Update element text content
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`Element with id '${elementId}' not found`);
    }
}

// Update element with error state
function updateElementWithError(elementId, errorText) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = errorText;
        element.style.color = '#dc3545';
    }
}

// Update preview table
function updatePreviewTable(tableId, data) {
    console.log(`Updating preview table '${tableId}' with ${data.length} items`);
    const tableContainer = document.getElementById(tableId);
    if (!tableContainer) {
        console.warn(`Table container '${tableId}' not found`);
        return;
    }
    
    const tableBody = tableContainer.querySelector('tbody');
    if (!tableBody) {
        console.warn(`Table body not found in '${tableId}'`);
        return;
    }
    
    // Clear loading messages or previous data
    tableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center">No data available</td></tr>`;
        return;
    }
    
    data.forEach(item => {
        const row = document.createElement('tr');
        
        Object.values(item).forEach(value => {
            const cell = document.createElement('td');
            
            // Add status indicators for status fields
            if (value === 'Active' || value === 'Online') {
                cell.innerHTML = `<span class="status-indicator status-active">${value}</span>`;
            } else if (value === 'Disabled' || value === 'Offline') {
                cell.innerHTML = `<span class="status-indicator status-disabled">${value}</span>`;
            } else {
                cell.textContent = value;
            }
            
            row.appendChild(cell);
        });
        
        tableBody.appendChild(row);
    });
}

// Set loading state for preview tables
function updatePreviewTableLoading(tableId, isLoading) {
    const tableContainer = document.getElementById(tableId);
    if (!tableContainer) return;
    
    const tableBody = tableContainer.querySelector('tbody');
    if (!tableBody) return;
    
    if (isLoading) {
        tableBody.innerHTML = `<tr><td colspan="5" class="loading-message">Loading data...</td></tr>`;
    }
}

// Show error message in preview tables
function updatePreviewTableError(tableId, errorMessage) {
    const tableContainer = document.getElementById(tableId);
    if (!tableContainer) return;
    
    const tableBody = tableContainer.querySelector('tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = `<tr><td colspan="5" class="error-message">${errorMessage}</td></tr>`;
}

// Update last update time
function updateLastUpdateTime(timestamp) {
    const element = document.getElementById('last-update-time');
    if (element) {
        try {
            const date = new Date(timestamp);
            element.textContent = date.toLocaleString();
        } catch (e) {
            element.textContent = timestamp;
        }
    }
}

// Add a global error handler to show messages to the user
function showErrorMessage(message) {
    // Check if we already have an error element
    let errorElement = document.getElementById('global-error-message');
    
    if (!errorElement) {
        // Create error element if it doesn't exist
        errorElement = document.createElement('div');
        errorElement.id = 'global-error-message';
        errorElement.style.position = 'fixed';
        errorElement.style.top = '20px';
        errorElement.style.right = '20px';
        errorElement.style.backgroundColor = '#dc3545';
        errorElement.style.color = 'white';
        errorElement.style.padding = '15px 20px';
        errorElement.style.borderRadius = '5px';
        errorElement.style.zIndex = '10000';
        errorElement.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';
        document.body.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
        }
    }, 5000);
}document.addEventListener('DOMContentLoaded', function() {
    // Toggle password visibility
    const togglePasswordIcon = document.getElementById('toggle-password-icon');
    const passwordInput = document.getElementById('new-user-password');

    if (togglePasswordIcon && passwordInput) {
        togglePasswordIcon.addEventListener('click', function() {
            const isPasswordVisible = passwordInput.type === 'text';
            passwordInput.type = isPasswordVisible ? 'password' : 'text';
            togglePasswordIcon.src = isPasswordVisible 
                ? '/static/img/eye.svg' 
                : '/static/img/eye-off.svg';
        });
    }
    // Initial debug log
    console.log("DOM loaded - initializing dashboard...");
    
    // Navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');
    
    // Initialize all modals
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-modal');
    
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            modal.style.display = 'none';
        });
    });
    
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Set up password toggles for all password fields
    setupPasswordToggles();
    
    // Initialize tabs
    initializeTabs();
    
    // Load initial data immediately for dashboard
    try {
        // First hide the loader if it exists
        const pageLoader = document.getElementById('page-loader');
        if (pageLoader) {
            setTimeout(() => {
                pageLoader.classList.add('hidden');
                setTimeout(() => pageLoader.style.display = 'none', 300);
            }, 1000);
        }
        
        console.log("Loading initial dashboard data...");
        loadDashboardData();
        
        // Also load the users data for the first tab that might be visible
        loadUsers();
    } catch (e) {
        console.error("Error during initial data load:", e);
        showErrorMessage("Failed to load initial data. Please refresh the page.");
    }
    
    // Reset Password form setup
    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('reset-username').value;
            const password = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-new-password').value;
            const resultDiv = document.getElementById('reset-password-result');
            
            if (password !== confirmPassword) {
                resultDiv.textContent = 'Passwords do not match';
                resultDiv.className = 'message error';
                return;
            }
            
            resultDiv.textContent = 'Resetting password...';
            resultDiv.className = 'message';
            
            // Call API to reset password
            resetUserPassword(username, password, resultDiv);
        });
    }
    
    // Toggle User Status form setup
    const toggleUserForm = document.getElementById('toggle-user-form');
    if (toggleUserForm) {
        toggleUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('toggle-username').value;
            const action = document.querySelector('input[name="toggle-action"]:checked')?.value;
            const resultDiv = document.getElementById('toggle-user-result');
            
            if (!action) {
                resultDiv.textContent = 'Please select an action';
                resultDiv.className = 'message error';
                return;
            }
            
            resultDiv.textContent = `${action === 'enable' ? 'Enabling' : 'Disabling'} user...`;
            resultDiv.className = 'message';
            
            // Call API to toggle user status
            toggleUserStatus(username, action, resultDiv);
        });
    }
    
    // Load data when tab is clicked
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            if (tabId === 'users') {
                loadUsers();
            } else if (tabId === 'groups') {
                loadGroups();
            } else if (tabId === 'computers') {
                loadComputers();
            }
        });
    });
});

// Setup password toggle functionality
function setupPasswordToggles() {
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
}

// Initialize tab navigation
function initializeTabs() {
    const tabs = document.querySelectorAll('.sidebar-nav .nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
                
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Show corresponding content
                const tabId = this.getAttribute('data-tab');
                const content = document.getElementById(tabId + '-tab');
                if (content) {
                    content.classList.add('active');
                }
            }
        });
    });
}

// Reset user password
function resetUserPassword(username, password, resultDiv) {
    fetch(`/api/ad/user/${username}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'reset_password',
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            resultDiv.textContent = data.message || 'Password reset successfully';
            resultDiv.className = 'message success';
            
            // Close the modal after 2 seconds
            setTimeout(() => {
                document.getElementById('reset-password-modal').style.display = 'none';
            }, 2000);
        } else {
            resultDiv.textContent = data.message || 'Failed to reset password';
            resultDiv.className = 'message error';
        }
    })
    .catch(error => {
        resultDiv.textContent = 'An error occurred. Please try again.';
        resultDiv.className = 'message error';
        console.error('Error:', error);
    });
}

// Toggle user status (enable/disable)
function toggleUserStatus(username, action, resultDiv) {
    console.log(`Toggling user status: ${username}, action: ${action}`);
    
    resultDiv.textContent = `${action === 'enable' ? 'Enabling' : 'Disabling'} user...`;
    resultDiv.className = 'message';
    
    fetch(`/api/ad/user/${encodeURIComponent(username)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: action })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errData => {
                throw new Error(errData.message || `Server returned ${response.status}: ${response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            resultDiv.textContent = data.message || `User ${action === 'enable' ? 'enabled' : 'disabled'} successfully`;
            resultDiv.className = 'message success';
            setTimeout(() => {
                document.getElementById('toggle-user-modal').style.display = 'none';
                loadUsers();
            }, 2000);
        } else {
            resultDiv.textContent = data.message || `Failed to ${action} user`;
            resultDiv.className = 'message error';
        }
    })
    .catch(error => {
        console.error('Error toggling user status:', error);
        resultDiv.textContent = `Error: ${error.message}`;
        resultDiv.className = 'message error';
    });
}

// View group members
function viewGroupMembers(groupName) {
    console.log(`Loading members for group: ${groupName}`);
    const modal = document.getElementById('group-members-modal');
    const membersList = document.getElementById('members-list');
    const groupNameDisplay = document.getElementById('group-name-display');
    
    if (modal && membersList && groupNameDisplay) {
        groupNameDisplay.textContent = groupName;
        membersList.innerHTML = '<p class="loading-message">Loading members...</p>';
        modal.style.display = 'flex';
        
        fetch(`/api/ad/group/${encodeURIComponent(groupName)}/members`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errData => {
                        throw new Error(errData.message || `Server returned ${response.status}: ${response.statusText}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    if (data.members && data.members.length > 0) {
                        membersList.innerHTML = '';
                        data.members.forEach(memberDn => {
                            const memberItem = document.createElement('div');
                            memberItem.className = 'member-item';
                            const displayName = memberDn.match(/CN=([^,]+)/)?.[1] || memberDn;
                            memberItem.innerHTML = `
                                <span title="${memberDn}">${displayName}</span>
                                <span title="" data-dn="${memberDn}" data-group="${groupName}"></button>
                            `;
                            membersList.appendChild(memberItem);
                        });
                        document.querySelectorAll('#members-list .delete').forEach(button => {
                            button.addEventListener('click', function() {
                                const memberDn = this.getAttribute('data-dn');
                                const groupName = this.getAttribute('data-group');
                                removeGroupMember(memberDn, groupName, this);
                            });
                        });
                    } else {
                        membersList.innerHTML = '<p>No members found in this group.</p>';
                    }
                } else {
                    membersList.innerHTML = `<p class="error-message">${data.message || 'Failed to load group members'}</p>`;
                }
            })
            .catch(error => {
                console.error('Error loading group members:', error);
                membersList.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
            });
    }
}

// Remove user from group
function removeGroupMember(dn, groupName, button) {
    if (confirm(`Are you sure you want to remove ${dn} from ${groupName}?`)) {
        button.textContent = 'Removing...';
        button.disabled = true;
        
        fetch(`/api/ad/group/${encodeURIComponent(groupName)}/members`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dn: dn })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.message || `Server returned ${response.status}: ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const memberItem = button.closest('.member-item');
                memberItem.remove();
                if (document.querySelectorAll('.member-item').length === 0) {
                    document.getElementById('members-list').innerHTML = '<p>No members found in this group.</p>';
                }
                loadGroups();
            } else {
                button.textContent = 'Remove';
                button.disabled = false;
                alert(data.message || 'Failed to remove member from group');
            }
        })
        .catch(error => {
            console.error('Error removing group member:', error);
            button.textContent = 'Remove';
            button.disabled = false;
            alert(`Error: ${error.message}`);
        });
    }
}

// Load Users Data with improved error handling
function loadUsers() {
    console.log("Loading users data...");
    const tableBody = document.querySelector('#users-table tbody');
    if (!tableBody) {
        console.error("Users table body not found");
        return;
    }
    
    const loadingRow = document.createElement('tr');
    loadingRow.innerHTML = `<td colspan="5" class="loading-message">Loading users data...</td>`;
    tableBody.innerHTML = '';
    tableBody.appendChild(loadingRow);
    
    fetch('/api/ad/users')
        .then(response => {
            console.log("Users API response status:", response.status);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Received ${data.users ? data.users.length : 0} users from API`);
            tableBody.innerHTML = '';
            
            if (data.success && data.users && data.users.length > 0) {
                data.users.forEach(user => {
                    const row = document.createElement('tr');
                    
                    // Determine name - use cn, or combination of first/last name, or just username
                    const displayName = user.cn || 
                        (user.givenName && user.sn ? `${user.givenName} ${user.sn}` : user.sAMAccountName);
                    
                    row.innerHTML = `
                        <td>${displayName}</td>
                        <td>${user.sAMAccountName || ''}</td>
                        <td>${user.mail || ''}</td>
                        <td><span class="status-indicator ${user.enabled ? 'status-active' : 'status-disabled'}">
                            ${user.enabled ? 'Active' : 'Disabled'}
                        </span></td>
                        <td>
                            <button class="action-btn edit" data-username="${user.sAMAccountName}" data-action="reset">Reset Password</button>
                            <button class="action-btn ${user.enabled ? 'delete' : 'view'}" data-username="${user.sAMAccountName}" 
                                data-status="${user.enabled ? 'enabled' : 'disabled'}" data-action="${user.enabled ? 'disable' : 'enable'}">
                                ${user.enabled ? 'Disable' : 'Enable'}
                            </button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Set up action buttons
                console.log("Setting up user action buttons...");
                setupUserActionButtons();
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center">No users found or unable to retrieve user data.</td>
                    </tr>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading users:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center error">Error loading user data: ${error.message}</td>
                </tr>
            `;
        });
}

// Setup user action buttons
function setupUserActionButtons() {
    // Reset Password buttons
    document.querySelectorAll('#users-table .action-btn.edit[data-action="reset"]').forEach(button => {
        button.addEventListener('click', function() {
            const username = this.getAttribute('data-username');
            const resetModal = document.getElementById('reset-password-modal');
            
            if (resetModal) {
                document.getElementById('reset-username').value = username;
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-new-password').value = '';
                document.getElementById('reset-password-result').textContent = '';
                document.getElementById('reset-password-result').className = 'message';
                
                resetModal.style.display = 'flex';
                document.getElementById('new-password').focus();
            }
        });
    });
    
    // Enable/Disable buttons
    document.querySelectorAll('#users-table .action-btn[data-action="enable"], #users-table .action-btn[data-action="disable"]').forEach(button => {
        button.addEventListener('click', function() {
            const username = this.getAttribute('data-username');
            const currentStatus = this.getAttribute('data-status');
            const action = this.getAttribute('data-action');
            
            const toggleModal = document.getElementById('toggle-user-modal');
            
            if (toggleModal) {
                document.getElementById('toggle-username').value = username;
                document.getElementById('current-status').textContent = currentStatus === 'enabled' ? 'Active' : 'Disabled';
                document.getElementById('current-status').className = currentStatus === 'enabled' ? 'status-active' : 'status-disabled';
                
                // Select the appropriate radio button
                if (action === 'enable') {
                    document.getElementById('enable-user').checked = true;
                } else {
                    document.getElementById('disable-user').checked = true;
                }
                
                document.getElementById('toggle-user-result').textContent = '';
                document.getElementById('toggle-user-result').className = 'message';
                
                toggleModal.style.display = 'flex';
            } else {
                // Fallback if modal not available
                if (confirm(`Are you sure you want to ${action} the user ${username}?`)) {
                    toggleUserStatus(username, action);
                }
            }
        });
    });
}

// Load Groups Data with improved error handling
function loadGroups() {
    console.log("Loading groups data...");
    const tableBody = document.querySelector('#groups-table tbody');
    if (!tableBody) {
        console.error("Groups table body not found");
        return;
    }
    
    const loadingRow = document.createElement('tr');
    loadingRow.innerHTML = `<td colspan="4" class="loading-message">Loading groups data...</td>`;
    tableBody.innerHTML = '';
    tableBody.appendChild(loadingRow);
    
    fetch('/api/ad/groups')
        .then(response => {
            console.log("Groups API response status:", response.status);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Received ${data.groups ? data.groups.length : 0} groups from API`);
            tableBody.innerHTML = '';
            
            if (data.success && data.groups && data.groups.length > 0) {
                data.groups.forEach(group => {
                    const row = document.createElement('tr');
                    
                    // Calculate member count (handle different response formats)
                    const memberCount = group.member_count || 
                        (Array.isArray(group.member) ? group.member.length : 
                         (group.member ? 1 : 0));
                    
                    row.innerHTML = `
                        <td>${group.cn || ''}</td>
                        <td>${group.description || ''}</td>
                        <td>${memberCount}</td>
                        <td>
                            <button class="action-btn view" data-group="${group.cn}">View Members</button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Add event listeners to view members buttons
                console.log("Setting up group view buttons...");
                document.querySelectorAll('#groups-table .action-btn.view').forEach(button => {
                    button.addEventListener('click', function() {
                        const groupName = this.getAttribute('data-group');
                        viewGroupMembers(groupName);
                    });
                });
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center">No groups found or unable to retrieve group data.</td>
                    </tr>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading groups:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center error">Error loading group data: ${error.message}</td>
                </tr>
            `;
        });
}

// Load Computers Data
function loadComputers() {
    const tableBody = document.querySelector('#computers-table tbody');
    const loadingMessage = document.querySelector('#computers-table .loading-message');
    
    if (loadingMessage) {
        loadingMessage.style.display = 'table-row';
    }
    
    fetch('/api/dashboard-data')
        .then(response => response.json())
        .then(data => {
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }
            
            if (data.computerDetails && data.computerDetails.length > 0) {
                tableBody.innerHTML = '';
                
                data.computerDetails.forEach(computer => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${computer['Computer Name'] || ''}</td>
                        <td>${computer['IP Address'] || ''}</td>
                        <td><span class="status-indicator 
                            ${computer['Status'] === 'Online' ? 'status-online' : 'status-offline'}">
                            ${computer['Status'] || 'Unknown'}
                        </span></td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center">No computers found or unable to retrieve computer data.</td>
                    </tr>
                `;
            }
        })
        .catch(error => {
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }
            
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center error">Error loading computer data. Please try again.</td>
                </tr>
            `;
            console.error('Error:', error);
        });
}

// Load Dashboard Data
function loadDashboardData() {
    console.log("Fetching dashboard data from API...");
    
    // Make preview tables show loading state
    updatePreviewTableLoading('users-preview', true);
    updatePreviewTableLoading('groups-preview', true);
    updatePreviewTableLoading('computers-preview', true);
    
    fetch('/api/dashboard-data')
        .then(response => {
            console.log("Dashboard API response status:", response.status);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Dashboard data received:", data);
            
            // Update stats
            updateElementText('user-count', data.users || 0);
            updateElementText('group-count', data.groups || 0);
            updateElementText('computer-count', data.computers || 0);
            updateElementText('domain-controller-count', data.domainControllers || 0);
            
            // Update timestamp
            if (data.metadata && data.metadata.timestamp) {
                updateLastUpdateTime(data.metadata.timestamp);
            }
            
            // Update preview tables
            updatePreviewTable('users-preview', data.userDetails || []);
            updatePreviewTable('groups-preview', data.groupDetails || []);
            updatePreviewTable('computers-preview', data.computerDetails || []);
        })
        .catch(error => {
            console.error('Error fetching dashboard data:', error);
            
            // Show error in preview tables
            updatePreviewTableError('users-preview', 'Failed to load data');
            updatePreviewTableError('groups-preview', 'Failed to load data');
            updatePreviewTableError('computers-preview', 'Failed to load data');
            
            // Set counts to error state
            updateElementWithError('user-count', 'Error');
            updateElementWithError('group-count', 'Error');
            updateElementWithError('computer-count', 'Error');
            updateElementWithError('domain-controller-count', 'Error');
            
            // Update timestamp to show error
            updateLastUpdateTime('Failed to fetch data');
        })
        .finally(() => {
            // Remove loading state from tables
            updatePreviewTableLoading('users-preview', false);
            updatePreviewTableLoading('groups-preview', false);
            updatePreviewTableLoading('computers-preview', false);
        });
}

// Update element text content
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`Element with id '${elementId}' not found`);
    }
}

// Update element with error state
function updateElementWithError(elementId, errorText) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = errorText;
        element.style.color = '#dc3545';
    }
}

// Update preview table
function updatePreviewTable(tableId, data) {
    console.log(`Updating preview table '${tableId}' with ${data.length} items`);
    const tableContainer = document.getElementById(tableId);
    if (!tableContainer) {
        console.warn(`Table container '${tableId}' not found`);
        return;
    }
    
    const tableBody = tableContainer.querySelector('tbody');
    if (!tableBody) {
        console.warn(`Table body not found in '${tableId}'`);
        return;
    }
    
    // Clear loading messages or previous data
    tableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center">No data available</td></tr>`;
        return;
    }
    
    data.forEach(item => {
        const row = document.createElement('tr');
        
        // Create cells in specific order
        const orderedValues = [
            item['Name'] || '',
            item['Username'] || '',
            item['Email'] || '',
            item['Status'] || ''
        ];
        
        orderedValues.forEach((value, index) => {
            const cell = document.createElement('td');
            
            // Add status indicators for the Status column (index 3)
            if (index === 3 && (value === 'Active' || value === 'Online' || value === 'Disabled' || value === 'Offline')) {
                const statusClass = (value === 'Active' || value === 'Online') ? 'status-active' : 'status-disabled';
                cell.innerHTML = `<span class="status-indicator ${statusClass}">${value}</span>`;
            } else {
                cell.textContent = value;
            }
            
            row.appendChild(cell);
        });
        
        tableBody.appendChild(row);
    });
}

// Set loading state for preview tables
function updatePreviewTableLoading(tableId, isLoading) {
    const tableContainer = document.getElementById(tableId);
    if (!tableContainer) return;
    
    const tableBody = tableContainer.querySelector('tbody');
    if (!tableBody) return;
    
    if (isLoading) {
        tableBody.innerHTML = `<tr><td colspan="5" class="loading-message">Loading data...</td></tr>`;
    }
}

// Show error message in preview tables
function updatePreviewTableError(tableId, errorMessage) {
    const tableContainer = document.getElementById(tableId);
    if (!tableContainer) return;
    
    const tableBody = tableContainer.querySelector('tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = `<tr><td colspan="5" class="error-message">${errorMessage}</td></tr>`;
}

// Update last update time
function updateLastUpdateTime(timestamp) {
    const element = document.getElementById('last-update-time');
    if (element) {
        try {
            const date = new Date(timestamp);
            element.textContent = date.toLocaleString();
        } catch (e) {
            element.textContent = timestamp;
        }
    }
}

// Add a global error handler to show messages to the user
function showErrorMessage(message) {
    // Check if we already have an error element
    let errorElement = document.getElementById('global-error-message');
    
    if (!errorElement) {
        // Create error element if it doesn't exist
        errorElement = document.createElement('div');
        errorElement.id = 'global-error-message';
        errorElement.style.position = 'fixed';
        errorElement.style.top = '20px';
        errorElement.style.right = '20px';
        errorElement.style.backgroundColor = '#dc3545';
        errorElement.style.color = 'white';
        errorElement.style.padding = '15px 20px';
        errorElement.style.borderRadius = '5px';
        errorElement.style.zIndex = '10000';
        errorElement.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';
        document.body.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
        }
    }, 5000);
}

// Helper function for direct API testing
function testApiEndpoint(endpoint) {
    console.log(`Testing API endpoint: ${endpoint}`);
    fetch(endpoint)
        .then(response => {
            console.log(`Response status: ${response.status}`);
            return response.text();
        })
        .then(text => {
            console.log(`Response body (first 100 chars): ${text.substring(0, 100)}`);
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("Response is not valid JSON:", e);
                return { error: "Invalid JSON" };
            }
        })
        .then(data => {
            console.log("Parsed data:", data);
        })
        .catch(error => {
            console.error(`API test failed: ${error.message}`);
        });
}

// Initialize API test on page load
setTimeout(() => {
    console.log("Running API endpoint tests...");
    testApiEndpoint('/api/dashboard-data');
}, 2000);


// Helper function for direct API testing
function testApiEndpoint(endpoint) {
    console.log(`Testing API endpoint: ${endpoint}`);
    fetch(endpoint)
        .then(response => {
            console.log(`Response status: ${response.status}`);
            return response.text();
        })
        .then(text => {
            console.log(`Response body (first 100 chars): ${text.substring(0, 100)}`);
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("Response is not valid JSON:", e);
                return { error: "Invalid JSON" };
            }
        })
        .then(data => {
            console.log("Parsed data:", data);
        })
        .catch(error => {
            console.error(`API test failed: ${error.message}`);
        });
}

// Initialize API test on page load
setTimeout(() => {
    console.log("Running API endpoint tests...");
    testApiEndpoint('/api/dashboard-data');
}, 2000);
