// js/auth.js
class AuthManager {
    constructor() {
        this.user = null;
        this.initialized = false;
        this.init();
    }

    async init() {
        try {
            console.log('Inicializando AuthManager...');
            
            // Verificar sesión existente primero
            const { data: { user }, error } = await supabase.auth.getUser();
            
            if (error) {
                console.error('Error obteniendo usuario:', error);
            } else {
                this.user = user;
                console.log('Usuario encontrado:', user ? 'Sí' : 'No');
            }
            
            // Configurar listener para cambios de estado
            supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state change:', event, session?.user ? 'User present' : 'No user');
                this.user = session?.user || null;
                this.handleAuthChange(event, session);
            });

            this.initialized = true;
            console.log('AuthManager inicializado');
            
        } catch (error) {
            console.error('Error inicializando auth:', error);
            this.initialized = true; // Marcamos como inicializado para evitar bloqueos
        }
    }

    // Función para esperar a que auth esté listo
    async waitForAuth() {
        let attempts = 0;
        while (!this.initialized && attempts < 50) { // 5 segundos máximo
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        return this.initialized;
    }

    async login(email, password) {
        try {
            console.log('Intentando login...');
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Error en login:', error);
                throw error;
            }
            
            console.log('Login exitoso:', data.user ? 'Usuario autenticado' : 'Sin usuario');
            this.user = data.user;
            
            // Pequeña espera para asegurar que la sesión se establezca
            await new Promise(resolve => setTimeout(resolve, 500));
            
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
            console.log('Cerrando sesión...');
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            this.user = null;
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }

    isAuthenticated() {
        const authenticated = this.user !== null;
        console.log('Verificando autenticación:', authenticated ? 'Autenticado' : 'No autenticado');
        return authenticated;
    }

    async checkAuth() {
        // Función mejorada para verificar autenticación
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            
            if (error) {
                console.error('Error verificando auth:', error);
                return false;
            }
            
            this.user = user;
            return user !== null;
        } catch (error) {
            console.error('Error en checkAuth:', error);
            return false;
        }
    }

    protectPage() {
        const publicPages = ['index.html', ''];
        const currentPage = window.location.pathname.split('/').pop();
        
        console.log('Protegiendo página:', currentPage);
        console.log('Es página pública:', publicPages.includes(currentPage));
        console.log('Usuario autenticado:', this.isAuthenticated());
        
        if (!publicPages.includes(currentPage) && !this.isAuthenticated()) {
            console.log('Redirigiendo a login...');
            window.location.href = 'index.html';
        }
    }

    handleAuthChange(event, session) {
        console.log('Manejando cambio de auth:', event);
        
        if (event === 'SIGNED_OUT') {
            this.user = null;
            // Solo redirigir si no estamos ya en la página de login
            const currentPage = window.location.pathname.split('/').pop();
            if (!['index.html', ''].includes(currentPage)) {
                window.location.href = 'index.html';
            }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            this.user = session?.user || null;
        }
    }
}

// Crear instancia global
const auth = new AuthManager();