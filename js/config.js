// js/config.js
// js/config.js
const supabaseConfig = {
    url: 'https://irgghbimbmkwncukvnyq.supabase.co',  // Reemplazar con tu URL real de Supabase
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyZ2doYmltYm1rd25jdWt2bnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMjk1NjAsImV4cCI6MjA3MDgwNTU2MH0.SnaUHt3lfEw5fxx2FuMGQLQoc_NQG0dpbZ6pMtI_SlU'  // Reemplazar con tu API Key real
};

// Verificar si las credenciales están configuradas
if (supabaseConfig.url === 'TU_SUPABASE_URL' || supabaseConfig.anonKey === 'TU_SUPABASE_ANON_KEY') {
    console.warn('⚠️ SUPABASE NO CONFIGURADO: Las credenciales en config.js no han sido reemplazadas');
    console.warn('📋 PASOS PARA CONFIGURAR:');
    console.warn('1. Ve a https://supabase.com y crea un proyecto');
    console.warn('2. En Settings > API, copia la URL y la anon key');
    console.warn('3. Reemplaza TU_SUPABASE_URL y TU_SUPABASE_ANON_KEY en config.js');
    console.warn('4. Ejecuta el script SQL para crear las tablas');
}

// Inicializar Supabase solo si está configurado
let supabase;
try {
    if (typeof window.supabase !== 'undefined' && supabaseConfig.url !== 'TU_SUPABASE_URL') {
        supabase = window.supabase.createClient(
            supabaseConfig.url, 
            supabaseConfig.anonKey
        );
        console.log('✅ Supabase inicializado correctamente');
    } else {
        console.error('❌ Supabase no se pudo inicializar - verifica config.js');
        
        // Crear un mock de Supabase para evitar errores
        supabase = {
            auth: {
                signInWithPassword: () => Promise.reject(new Error('Supabase no configurado')),
                signUp: () => Promise.reject(new Error('Supabase no configurado')),
                signOut: () => Promise.reject(new Error('Supabase no configurado')),
                getUser: () => Promise.resolve({ data: { user: null } }),
                onAuthStateChange: () => {}
            },
            from: () => ({
                select: () => Promise.reject(new Error('Supabase no configurado - verifica config.js')),
                insert: () => Promise.reject(new Error('Supabase no configurado - verifica config.js')),
                update: () => Promise.reject(new Error('Supabase no configurado - verifica config.js')),
                delete: () => Promise.reject(new Error('Supabase no configurado - verifica config.js'))
            })
        };
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
    itemsPerPage: 10,
    supabaseConfigured: supabaseConfig.url !== 'TU_SUPABASE_URL' && supabaseConfig.anonKey !== 'TU_SUPABASE_ANON_KEY'
};

// Hacer configuración disponible globalmente para debugging
window.appConfig = appConfig;
window.supabaseConfig = supabaseConfig;