// API Service for z-task
class ApiService {
    constructor() {
        this.baseURL = window.location.origin;
        this.token = localStorage.getItem('authToken');
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    // Get authentication headers
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Make API request
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Authentication methods
    async register(username, email, password) {
        const response = await this.makeRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });

        if (response.token) {
            this.setToken(response.token);
        }

        return response;
    }

    async login(email, password) {
        const response = await this.makeRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (response.token) {
            this.setToken(response.token);
        }

        return response;
    }

    logout() {
        this.setToken(null);
    }

    // Data methods
    async getUserData() {
        return await this.makeRequest('/api/user/data');
    }

    async saveUserData(data) {
        return await this.makeRequest('/api/user/data', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Health check
    async healthCheck() {
        return await this.makeRequest('/api/health');
    }

    // Invitation methods
    async inviteUserToProject(projectId, email, permissions = 'view,edit') {
        return await this.makeRequest(`/api/projects/${projectId}/invite`, {
            method: 'POST',
            body: JSON.stringify({ email, permissions })
        });
    }

    async acceptInvitation(token) {
        return await this.makeRequest(`/api/invitations/${token}/accept`, {
            method: 'POST'
        });
    }

    async declineInvitation(token) {
        return await this.makeRequest(`/api/invitations/${token}/decline`, {
            method: 'POST'
        });
    }

    async getInvitationDetails(token) {
        return await this.makeRequest(`/api/invitations/${token}`);
    }

    // Notification methods
    async getNotifications() {
        return await this.makeRequest('/api/notifications');
    }

    async markNotificationAsRead(notificationId) {
        return await this.makeRequest(`/api/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token;
    }

    // Get current user info from token (basic implementation)
    getCurrentUser() {
        if (!this.token) return null;
        
        try {
            // Decode JWT token (client-side, not secure for sensitive data)
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return {
                id: payload.userId,
                username: payload.username,
                email: payload.email
            };
        } catch (error) {
            console.error('Error decoding token:', error);
            return null;
        }
    }
}

// Create global API service instance
window.apiService = new ApiService();
