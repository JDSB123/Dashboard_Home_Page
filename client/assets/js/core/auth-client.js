/**
 * User Authentication Client v1.0.0
 * Azure AD B2C / Easy Auth integration
 * Provides login/logout, profile management, and session handling
 */

(function() {
    'use strict';

    class AuthClient {
        constructor() {
            this.user = null;
            this.isAuthenticated = false;
            this.loginEndpoint = '/.auth/login/aad';
            this.logoutEndpoint = '/.auth/logout';
            this.meEndpoint = '/.auth/me';
            this.initialized = false;
        }

        /**
         * Initialize auth client
         */
        async init() {
            if (this.initialized) return;

            // Check if user is already logged in
            await this.checkAuthStatus();

            // Render auth UI if element exists
            this._renderAuthUI();

            // Listen for auth events
            window.addEventListener('auth:login', () => this.login());
            window.addEventListener('auth:logout', () => this.logout());

            this.initialized = true;
            console.log('🔐 Auth Client initialized', this.isAuthenticated ? '(logged in)' : '(anonymous)');
        }

        /**
         * Check current authentication status
         */
        async checkAuthStatus() {
            try {
                const response = await fetch(this.meEndpoint);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data && data.length > 0) {
                        this.user = this._parseUserFromClaims(data[0]);
                        this.isAuthenticated = true;
                        
                        window.dispatchEvent(new CustomEvent('auth:authenticated', { 
                            detail: this.user 
                        }));
                    }
                }
            } catch (error) {
                // Not authenticated or auth not configured
                console.log('Auth check:', error.message);
            }
        }

        /**
         * Parse user info from Azure AD claims
         */
        _parseUserFromClaims(authData) {
            const claims = authData.user_claims || [];
            const findClaim = (type) => claims.find(c => c.typ === type)?.val;

            return {
                id: authData.user_id,
                provider: authData.provider_name,
                name: findClaim('name') || findClaim('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'),
                email: findClaim('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress') 
                    || findClaim('emails') 
                    || authData.user_id,
                picture: findClaim('picture'),
                roles: authData.user_roles || [],
                claims: claims
            };
        }

        /**
         * Redirect to login
         */
        login(returnUrl = window.location.href) {
            const encodedReturn = encodeURIComponent(returnUrl);
            window.location.href = `${this.loginEndpoint}?post_login_redirect_uri=${encodedReturn}`;
        }

        /**
         * Logout user
         */
        logout(returnUrl = '/') {
            const encodedReturn = encodeURIComponent(returnUrl);
            window.location.href = `${this.logoutEndpoint}?post_logout_redirect_uri=${encodedReturn}`;
        }

        /**
         * Get current user
         */
        getUser() {
            return this.user;
        }

        /**
         * Check if user has specific role
         */
        hasRole(role) {
            return this.user?.roles?.includes(role) || false;
        }

        /**
         * Check if user is admin
         */
        isAdmin() {
            return this.hasRole('admin') || this.hasRole('Admin');
        }

        /**
         * Render auth UI elements
         */
        _renderAuthUI() {
            const authContainer = document.getElementById('auth-container') 
                || document.querySelector('.auth-container');
            
            if (!authContainer) return;

            if (this.isAuthenticated && this.user) {
                authContainer.innerHTML = `
                    <div class="user-profile">
                        ${this.user.picture ? `<img src="${this.user.picture}" alt="" class="user-avatar">` : ''}
                        <span class="user-name">${this.user.name || this.user.email}</span>
                        <button class="btn-logout" id="btn-logout">Sign Out</button>
                    </div>
                `;

                document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());
            } else {
                authContainer.innerHTML = `
                    <button class="btn-login" id="btn-login">Sign In</button>
                `;

                document.getElementById('btn-login')?.addEventListener('click', () => this.login());
            }
        }

        /**
         * Show login modal (for in-page login prompt)
         */
        showLoginPrompt(message = 'Please sign in to continue') {
            const existing = document.getElementById('auth-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'auth-modal';
            modal.className = 'auth-modal-overlay';
            modal.innerHTML = `
                <div class="auth-modal">
                    <div class="auth-modal-header">
                        <img src="/assets/Logo%208.5.png" alt="GBSV" class="auth-logo">
                        <h2>Welcome to GBSV</h2>
                    </div>
                    <div class="auth-modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="auth-modal-footer">
                        <button class="btn btn-secondary" id="auth-cancel">Cancel</button>
                        <button class="btn btn-primary" id="auth-login">Sign In</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('#auth-cancel').addEventListener('click', () => modal.remove());
            modal.querySelector('#auth-login').addEventListener('click', () => {
                modal.remove();
                this.login();
            });

            // Inject styles if needed
            this._injectAuthStyles();
        }

        /**
         * Inject auth-related styles
         */
        _injectAuthStyles() {
            if (document.getElementById('auth-styles')) return;

            const style = document.createElement('style');
            style.id = 'auth-styles';
            style.textContent = `
                .auth-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 20000;
                }

                .auth-modal {
                    background: linear-gradient(180deg, #0a1628 0%, #030b16 100%);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 400px;
                    text-align: center;
                    color: #fff;
                }

                .auth-modal-header {
                    margin-bottom: 20px;
                }

                .auth-logo {
                    height: 60px;
                    margin-bottom: 15px;
                }

                .auth-modal h2 {
                    margin: 0;
                    font-size: 24px;
                }

                .auth-modal-body {
                    margin-bottom: 25px;
                    color: rgba(255,255,255,0.7);
                }

                .auth-modal-footer {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                }

                .auth-modal .btn {
                    padding: 10px 25px;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    border: none;
                }

                .auth-modal .btn-primary {
                    background: #3b82f6;
                    color: #fff;
                }

                .auth-modal .btn-secondary {
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                }

                .user-profile {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .user-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                }

                .user-name {
                    color: #fff;
                    font-size: 14px;
                }

                .btn-logout, .btn-login {
                    padding: 6px 12px;
                    border-radius: 4px;
                    border: 1px solid rgba(255,255,255,0.2);
                    background: transparent;
                    color: #fff;
                    cursor: pointer;
                    font-size: 12px;
                }

                .btn-logout:hover, .btn-login:hover {
                    background: rgba(255,255,255,0.1);
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Create singleton
    window.AuthClient = new AuthClient();

    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.AuthClient.init());
    } else {
        window.AuthClient.init();
    }

})();
