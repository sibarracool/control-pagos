// js/config.js
const supabaseConfig = {
    url: 'https://irgghbimbmkwncukvnyq.supabase.co',  // Reemplazar con tu URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyZ2doYmltYm1rd25jdWt2bnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMjk1NjAsImV4cCI6MjA3MDgwNTU2MH0.SnaUHt3lfEw5fxx2FuMGQLQoc_NQG0dpbZ6pMtI_SlU'  // Reemplazar con tu API Key
};

// Inicializar Supabase
const supabase = window.supabase.createClient(
    supabaseConfig.url, 
    supabaseConfig.anonKey
);

// Configuración de la aplicación
const appConfig = {
    name: 'Control de Pagos',
    version: '1.0.0',
    currency: 'Q',
    defaultPercentage: 5.00,
    itemsPerPage: 10
};