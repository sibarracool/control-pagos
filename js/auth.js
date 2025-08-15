// js/auth.js
class AuthManager {
    constructor() {
        this.user = null;
        this.init();
    }

    async init() {
        // Verificar sesión existente
        const { data: { user } } = await supabase.auth.getUser();
        this.user = user;
        
        // Manejar cambios de estado de autenticación
        supabase.auth.onAuthStateChange((event, session) => {
            this.user = session?.user || null;
            this.handleAuthChange(event, session);
        });

        // Proteger páginas que requieren autenticación
        this.protectPage();
    }

    async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            
            // Redirigir al dashboard
            window.location.href = 'dashboard.html';
            return data;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async register(email, password) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });

            if (error) throw error;
            return data;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }

    isAuthenticated() {
        return this.user !== null;
    }

    protectPage() {
        const publicPages = ['index.html', ''];
        const currentPage = window.location.pathname.split('/').pop();
        
        if (!publicPages.includes(currentPage) && !this.isAuthenticated()) {
            window.location.href = 'index.html';
        }
    }

    handleAuthChange(event, session) {
        if (event === 'SIGNED_OUT') {
            window.location.href = 'index.html';
        }
    }
}

// Inicializar gestor de autenticación
const auth = new AuthManager();