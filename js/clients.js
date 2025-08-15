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
        console.log('ClientManager init() llamado');
        
        // Esperar a que auth esté listo
        await auth.waitForAuth();
        
        // Verificar autenticación de forma más robusta
        const isAuth = await auth.checkAuth();
        console.log('Verificación de auth:', isAuth);
        
        if (!isAuth) {
            console.log('No autenticado, redirigiendo...');
            window.location.href = 'index.html';
            return;
        }

        console.log('Usuario autenticado, continuando...');

        try {
            await this.loadClients();
            console.log('Clientes cargados:', this.clients.length);
            
            this.renderClientsTable();
            console.log('Tabla renderizada');
            
            this.setupEventListeners();
            console.log('Event listeners configurados');
            
            this.setupModal();
            console.log('Modal configurado');
            
            console.log('ClientManager inicializado correctamente');
        } catch (error) {
            console.error('Error en init():', error);
            Utils.showError('Error inicializando la gestión de clientes');
        }
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
        console.log('=== CREAR CLIENTE ===');
        console.log('Datos a insertar:', clientData);
        
        try {
            const dataToInsert = {
                ...clientData,
                user_id: auth.user.id,
                monthly_percentage: clientData.monthly_percentage || 5.0
            };
            
            console.log('Datos finales para insertar:', dataToInsert);
            
            const { data, error } = await supabase
                .from('clients')
                .insert([dataToInsert])
                .select()
                .single();

            console.log('Respuesta de Supabase:', { data, error });

            if (error) {
                console.error('Error de Supabase:', error);
                throw error;
            }
            
            if (!data) {
                throw new Error('No se recibieron datos después de la inserción');
            }
            
            console.log('Cliente creado exitosamente:', data);
            
            await this.loadClients();
            this.renderClientsTable();
            this.showSuccess('Cliente agregado exitosamente');
            return data;
            
        } catch (error) {
            console.error('ERROR en createClient:', error);
            let errorMessage = 'Error al crear el cliente';
            
            if (error.message) {
                if (error.message.includes('relation "clients" does not exist')) {
                    errorMessage = 'Error: La tabla "clients" no existe en la base de datos.';
                } else if (error.message.includes('JWT')) {
                    errorMessage = 'Error de autenticación. Por favor, vuelve a iniciar sesión.';
                } else {
                    errorMessage = `Error: ${error.message}`;
                }
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

                await supabase
                    .from('payments')
                    .delete()
                    .eq('client_id', id)
                    .eq('user_id', auth.user.id);
            }

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
                        Q${client.principal_amount.toLocaleString()}
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-green-600">
                        Q${monthlyAmount.toLocaleString()}
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
                        <div class="text-2xl font-bold text-blue-900">${totalClients}</div>
                        <div class="text-blue-700">Total Clientes</div>
                    </div>
                    <div class="bg-green-50 rounded-lg p-4">
                        <div class="text-2xl font-bold text-green-900">Q${totalAmount.toLocaleString()}</div>
                        <div class="text-green-700">Capital Total</div>
                    </div>
                    <div class="bg-purple-50 rounded-lg p-4">
                        <div class="text-2xl font-bold text-purple-900">Q${monthlyExpected.toLocaleString()}</div>
                        <div class="text-purple-700">Ingresos Esperados/Mes</div>
                    </div>
                </div>
            `;
        }
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        const searchInput = document.getElementById('client-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.currentPage = 1;
                this.renderClientsTable();
            });
        }

        const addButton = document.getElementById('add-client-btn');
        if (addButton) {
            addButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('¡Botón agregar cliente presionado!');
                this.showClientModal();
            });
            console.log('Event listener agregado al botón agregar');
        }

        const itemsSelect = document.getElementById('items-per-page');
        if (itemsSelect) {
            itemsSelect.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.renderClientsTable();
            });
        }
    }

    setupModal() {
        console.log('Configurando modal...');
        
        const form = document.getElementById('client-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Formulario enviado');
                await this.handleFormSubmit(e);
            });
        }

        const closeButtons = document.querySelectorAll('[data-modal-close]');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideClientModal();
            });
        });

        const modal = document.getElementById('client-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideClientModal();
                }
            });
        }

        this.setupFormValidation();
    }

    setupFormValidation() {
        const amountInput = document.getElementById('principal_amount');
        const percentageInput = document.getElementById('monthly_percentage');
        const previewElement = document.getElementById('monthly-preview');

        const updatePreview = () => {
            const amount = parseFloat(amountInput?.value || 0);
            const percentage = parseFloat(percentageInput?.value || 5);
            const monthly = amount * percentage / 100;

            if (previewElement && amount > 0) {
                previewElement.innerHTML = `
                    <div class="bg-blue-50 p-3 rounded-md">
                        <p class="text-sm text-blue-700">
                            Pago mensual esperado: <span class="font-semibold">Q${monthly.toLocaleString()}</span>
                        </p>
                        <p class="text-xs text-blue-600 mt-1">
                            Fecha de pago: Día ${document.getElementById('payment_day')?.value || 1} de cada mes
                        </p>
                    </div>
                `;
            } else if (previewElement) {
                previewElement.innerHTML = '';
            }
        };

        if (amountInput) amountInput.addEventListener('input', updatePreview);
        if (percentageInput) percentageInput.addEventListener('input', updatePreview);
    }

    async handleFormSubmit(e) {
        console.log('=== INICIO ENVÍO FORMULARIO ===');
        
        const formData = new FormData(e.target);
        const clientData = {
            name: formData.get('name').trim(),
            email: formData.get('email')?.trim() || null,
            phone: formData.get('phone')?.trim() || null,
            principal_amount: parseFloat(formData.get('principal_amount')),
            monthly_percentage: parseFloat(formData.get('monthly_percentage') || 5),
            payment_day: parseInt(formData.get('payment_day'))
        };

        console.log('Datos del formulario:', clientData);

        // Validaciones
        if (!clientData.name) {
            this.showError('El nombre es requerido');
            return;
        }

        if (!clientData.principal_amount || clientData.principal_amount <= 0) {
            this.showError('El monto principal debe ser mayor a 0');
            return;
        }

        if (clientData.payment_day < 1 || clientData.payment_day > 31) {
            this.showError('El día de pago debe estar entre 1 y 31');
            return;
        }

        try {
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Guardando...';

            if (this.editingClient) {
                await this.updateClient(this.editingClient.id, clientData);
            } else {
                await this.createClient(clientData);
            }

            this.hideClientModal();
            
        } catch (error) {
            console.error('ERROR en handleFormSubmit:', error);
            this.showError(error.message);
        } finally {
            const submitButton = e.target.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = this.editingClient ? 'Actualizar Cliente' : 'Agregar Cliente';
            }
        }
    }

    showClientModal(client = null) {
        console.log('showClientModal llamado', client);
        
        this.editingClient = client;
        const modal = document.getElementById('client-modal');
        const form = document.getElementById('client-form');
        const title = document.getElementById('modal-title');

        if (!modal || !form || !title) {
            console.error('Elementos del modal no encontrados');
            return;
        }

        title.textContent = client ? 'Editar Cliente' : 'Agregar Nuevo Cliente';

        if (client) {
            form.elements.name.value = client.name;
            form.elements.email.value = client.email || '';
            form.elements.phone.value = client.phone || '';
            form.elements.principal_amount.value = client.principal_amount;
            form.elements.monthly_percentage.value = client.monthly_percentage;
            form.elements.payment_day.value = client.payment_day;
        } else {
            form.reset();
            form.elements.monthly_percentage.value = 5;
            form.elements.payment_day.value = 1;
        }

        modal.classList.remove('hidden');
        setTimeout(() => {
            if (form.elements.name) form.elements.name.focus();
        }, 100);
    }

    hideClientModal() {
        const modal = document.getElementById('client-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.editingClient = null;
    }

    editClient(id) {
        const client = this.clients.find(c => c.id === id);
        if (client) {
            this.showClientModal(client);
        }
    }

    deleteClientConfirm(id) {
        const client = this.clients.find(c => c.id === id);
        if (client) {
            const confirmed = confirm(`¿Estás seguro de eliminar al cliente "${client.name}"?`);
            if (confirmed) {
                this.deleteClient(id);
            }
        }
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.getFilteredClients().length / this.itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderClientsTable();
        }
    }

    getNextPaymentDate(client) {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        let nextPaymentDate = new Date(currentYear, currentMonth, client.payment_day);
        
        if (nextPaymentDate <= today) {
            nextPaymentDate = new Date(currentYear, currentMonth + 1, client.payment_day);
        }
        
        return nextPaymentDate.toISOString().split('T')[0];
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-GT', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
}

// Inicializar gestor de clientes
let clientManager;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Clients page');
    
    if (typeof auth === 'undefined') {
        console.error('Auth no está definido');
        return;
    }
    
    if (typeof supabase === 'undefined') {
        console.error('Supabase no está definido');
        return;
    }
    
    console.log('Scripts cargados correctamente');
    
    try {
        // Esperar a que auth esté completamente inicializado
        console.log('Esperando inicialización de auth...');
        await auth.waitForAuth();
        
        // Verificar autenticación
        const isAuthenticated = await auth.checkAuth();
        console.log('Estado de autenticación:', isAuthenticated);
        
        if (isAuthenticated) {
            console.log('Usuario autenticado, iniciando ClientManager');
            clientManager = new ClientManager();
        } else {
            console.log('Usuario no autenticado, redirigiendo...');
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error en inicialización:', error);
        // En caso de error, redirigir a login
        window.location.href = 'index.html';
    }
});