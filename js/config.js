// js/config.js
const supabaseConfig = {
    url: 'TU_SUPABASE_URL',  // Reemplazar con tu URL real de Supabase
    anonKey: 'TU_SUPABASE_ANON_KEY'  // Reemplazar con tu API Key real
};

// Inicializar Supabase
let supabase;
try {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(
            supabaseConfig.url, 
            supabaseConfig.anonKey
        );
        console.log('✅ Supabase inicializado');
        
        // Si las credenciales no están configuradas, mostrar advertencia
        if (supabaseConfig.url === 'TU_SUPABASE_URL' || supabaseConfig.anonKey === 'TU_SUPABASE_ANON_KEY') {
            console.warn('⚠️ Credenciales no configuradas en config.js, pero continuando...');
        }
    } else {
        console.error('❌ window.supabase no disponible');
    }
} catch (error) {
    console.error('Error inicializando Supabase:', error);
}

// Configuración de la aplicación
const appConfig = {
    name: 'Control de Pagos',
    version: '1.0.0',
    currency: 'Q',
    defaultPercentage: 5.00,
    itemsPerPage: 10
};

// Hacer configuración disponible globalmente para debugging
window.appConfig = appConfig;
window.supabaseConfig = supabaseConfig;