// js/clients.js
class ClientManager {
    constructor() {
        this.clients = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.searchTerm = '';
        this.sortBy = 'created_at';
        this.sortOrder = 'desc';
        this.editingClient = null;
        this.init();
    }

    async init() {
        console.log('ClientManager init() llamado'); // Debug
        
        // Verificar autenticación
        if (!auth.isAuthenticated()) {
            console.log('No autenticado, redirigiendo...'); // Debug
            window.location.href = 'index.html';
            return;
        }

        console.log('Usuario autenticado, continuando...'); // Debug

        // DIAGNÓSTICO DE CONFIGURACIÓN
        await this.diagnoseConfiguration();

        try {
            await this.loadClients();
            console.log('Clientes cargados:', this.clients.length); // Debug
            
            this.renderClientsTable();
            console.log('Tabla renderizada'); // Debug
            
            this.setupEventListeners();
            console.log('Event listeners configurados'); // Debug
            
            this.setupModal();
            console.log('Modal configurado'); // Debug
            
            console.log('ClientManager inicializado correctamente'); // Debug
        } catch (error) {
            console.error('Error en init():', error);
            Utils.showError('Error inicializando la gestión de clientes');
        }
    }

    async diagnoseConfiguration() {
        console.log('=== DIAGNÓSTICO DE CONFIGURACIÓN ===');
        
        // Verificar Supabase
        console.log('Supabase disponible:', typeof supabase !== 'undefined');
        if (typeof supabase !== 'undefined') {
            console.log('Supabase URL:', supabase.supabaseUrl);
            console.log('Supabase Key configurada:', !!supabase.supabaseKey);
        }
        
        // Verificar Auth
        console.log('Auth disponible:', typeof auth !== 'undefined');
        if (typeof auth !== 'undefined' && auth.user) {
            console.log('Usuario ID:', auth.user.id);
            console.log('Usuario email:', auth.user.email);
        }
        
        // Probar conexión básica a Supabase
        if (typeof supabase !== 'undefined') {
            try {
                console.log('Probando conexión a Supabase...');
                const { data, error } = await supabase
                    .from('clients')
                    .select('count')
                    .limit(1);
                    
                if (error) {
                    console.error('Error conectando a Supabase:', error);
                    if (error.message.includes('relation "clients" does not exist')) {
                        Utils.showError('La tabla "clients" no existe. Necesitas configurar la base de datos primero.');
                    } else {
                        Utils.showError('Error de configuración: ' + error.message);
                    }
                } else {
                    console.log('✅ Conexión a Supabase exitosa');
                }
            } catch (error) {
                console.error('Error probando Supabase:', error);
                Utils.showError('Error de configuración de Supabase: ' + error.message);
            }
        }
        
        console.log('=== FIN DIAGNÓSTICO ===');
    }

    async loadClients() {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select(`
                    *,
                    payments:payments(count)
                `)
                .eq('is_active', true)
                .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

            if (error) throw error;
            this.clients = data || [];
            
        } catch (error) {
            console.error('Error cargando clientes:', error);
            this.showError('Error cargando la lista de clientes');
        }
    }

    async createClient(clientData) {
        console.log('=== CREAR CLIENTE ==='); // Debug
        console.log('Datos a insertar:', clientData); // Debug
        
        try {
            console.log('Preparando datos para Supabase...'); // Debug
            
            const dataToInsert = {
                ...clientData,
                user_id: auth.user.id,
                monthly_percentage: clientData.monthly_percentage || 5.0
            };
            
            console.log('Datos finales para insertar:', dataToInsert); // Debug
            console.log('User ID:', auth.user.id); // Debug
            
            console.log('Ejecutando INSERT en Supabase...'); // Debug
            
            const { data, error } = await supabase
                .from('clients')
                .insert([dataToInsert])
                .select()
                .single();

            console.log('Respuesta de Supabase:'); // Debug
            console.log('Data:', data); // Debug
            console.log('Error:', error); // Debug

            if (error) {
                console.error('Error de Supabase:', error); // Debug
                throw error;
            }
            
            if (!data) {
                throw new Error('No se recibieron datos después de la inserción');
            }
            
            console.log('Cliente creado exitosamente:', data); // Debug
            
            await this.loadClients();
            this.renderClientsTable();
            this.showSuccess('Cliente agregado exitosamente');
            return data;
            
        } catch (error) {
            console.error('ERROR en createClient:', error); // Debug
            console.error('Error completo:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            }); // Debug
            
            let errorMessage = 'Error al crear el cliente';
            
            if (error.code === 'PGRST116') {
                errorMessage = 'Error: La tabla "clients" no existe. Verifica la configuración de la base de datos.';
            } else if (error.message && error.message.includes('relation "clients" does not exist')) {
                errorMessage = 'Error: La tabla "clients" no existe en la base de datos. Necesitas ejecutar el script SQL de configuración.';
            } else if (error.message && error.message.includes('JWT')) {
                errorMessage = 'Error de autenticación. Por favor, vuelve a iniciar sesión.';
            } else if (error.message && error.message.includes('Invalid API key')) {
                errorMessage = 'Error de configuración: Verifica las credenciales de Supabase en config.js';
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }
            
            throw new Error(errorMessage);
        }
    }

    async updateClient(id, clientData) {
        try {
            const { data, error } = await supabase
                .from('clients')
                .update(clientData)
                .eq('id', id)
                .eq('user_id', auth.user.id)
                .select()
                .single();

            if (error) throw error;
            
            await this.loadClients();
            this.renderClientsTable();
            this.showSuccess('Cliente actualizado exitosamente');
            return data;
            
        } catch (error) {
            console.error('Error actualizando cliente:', error);
            throw new Error('Error al actualizar el cliente: ' + error.message);
        }
    }

    async deleteClient(id) {
        try {
            // Primero verificar si tiene pagos
            const { data: payments } = await supabase
                .from('payments')
                .select('id')
                .eq('client_id', id);

            if (payments && payments.length > 0) {
                const confirmDelete = confirm(
                    `Este cliente tiene ${payments.length} pagos registrados. ` +
                    `¿Estás seguro de eliminarlo? Esta acción eliminará también todos sus pagos.`
                );
                
                if (!confirmDelete) return false;

                // Eliminar pagos primero
                await supabase
                    .from('payments')
                    .delete()
                    .eq('client_id', id)
                    .eq('user_id', auth.user.id);
            }

            // Eliminar cliente (soft delete)
            const { error } = await supabase
                .from('clients')
                .update({ is_active: false })
                .eq('id', id)
                .eq('user_id', auth.user.id);

            if (error) throw error;
            
            await this.loadClients();
            this.renderClientsTable();
            this.showSuccess('Cliente eliminado exitosamente');
            return true;
            
        } catch (error) {
            console.error('Error eliminando cliente:', error);
            this.showError('Error al eliminar el cliente');
            return false;
        }
    }

    renderClientsTable() {
        const filteredClients = this.getFilteredClients();
        const paginatedClients = this.getPaginatedClients(filteredClients);
        
        this.renderTable(paginatedClients);
        this.renderPagination(filteredClients.length);
        this.renderStats();
    }

    getFilteredClients() {
        let filtered = [...this.clients];
        
        // Aplicar búsqueda
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(client => 
                client.name.toLowerCase().includes(term) ||
                client.email?.toLowerCase().includes(term) ||
                client.phone?.includes(term)
            );
        }
        
        return filtered;
    }

    getPaginatedClients(clients) {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return clients.slice(start, end);
    }

    renderTable(clients) {
        const tbody = document.getElementById('clients-table-body');
        if (!tbody) return;

        if (clients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                        ${this.searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                    </td>
                </tr>
            `;
            return;
        }

        const html = clients.map(client => {
            const monthlyAmount = (client.principal_amount * client.monthly_percentage / 100);
            const paymentCount = client.payments?.[0]?.count || 0;
            const nextPayment = this.getNextPaymentDate(client);
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                        <div>
                            <div class="text-sm font-medium text-gray-900">${this.escapeHtml(client.name)}</div>
                            <div class="text-sm text-gray-500">${this.escapeHtml(client.email || '')}</div>
                            ${client.phone ? `<div class="text-sm text-gray-400">${this.escapeHtml(client.phone)}</div>` : ''}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                        ${this.formatCurrency(client.principal_amount)}
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-green-600">
                        ${this.formatCurrency(monthlyAmount)}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                        Día ${client.payment_day}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                        ${this.formatDate(nextPayment)}
                        <div class="text-xs text-gray-400">${paymentCount} pagos</div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                        <div class="flex space-x-2">
                            <button onclick="clientManager.editClient('${client.id}')" 
                                    class="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                                    title="Editar cliente">
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                </svg>
                            </button>
                            <button onclick="clientManager.deleteClientConfirm('${client.id}')" 
                                    class="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                    title="Eliminar cliente">
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                            <button onclick="clientManager.viewClientDetails('${client.id}')" 
                                    class="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50"
                                    title="Ver detalles">
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    }

    renderPagination(totalItems) {
        const container = document.getElementById('pagination-container');
        if (!container) return;

        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        const html = `
            <div class="flex items-center justify-between">
                <div class="text-sm text-gray-700">
                    Mostrando ${(this.currentPage - 1) * this.itemsPerPage + 1} a 
                    ${Math.min(this.currentPage * this.itemsPerPage, totalItems)} de 
                    ${totalItems} clientes
                </div>
                <div class="flex space-x-2">
                    <button onclick="clientManager.goToPage(${this.currentPage - 1})" 
                            ${this.currentPage === 1 ? 'disabled' : ''}
                            class="px-3 py-1 text-sm border rounded ${this.currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}">
                        Anterior
                    </button>
                    
                    ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                        const page = i + Math.max(1, this.currentPage - 2);
                        if (page > totalPages) return '';
                        
                        return `
                            <button onclick="clientManager.goToPage(${page})" 
                                    class="px-3 py-1 text-sm border rounded ${page === this.currentPage ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}">
                                ${page}
                            </button>
                        `;
                    }).join('')}
                    
                    <button onclick="clientManager.goToPage(${this.currentPage + 1})" 
                            ${this.currentPage === totalPages ? 'disabled' : ''}
                            class="px-3 py-1 text-sm border rounded ${this.currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}">
                        Siguiente
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    renderStats() {
        const totalClients = this.clients.length;
        const totalAmount = this.clients.reduce((sum, client) => sum + parseFloat(client.principal_amount), 0);
        const monthlyExpected = this.clients.reduce((sum, client) => 
            sum + (parseFloat(client.principal_amount) * parseFloat(client.monthly_percentage) / 100), 0);

        const statsContainer = document.getElementById('clients-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="bg-blue-50 rounded-lg p-4">
                        