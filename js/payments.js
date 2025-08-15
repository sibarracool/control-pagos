// js/payments.js
class PaymentManager {
    constructor() {
        this.payments = [];
        this.clients = [];
        this.currentPage = 1;
        this.itemsPerPage = 15;
        this.searchTerm = '';
        this.filterStatus = 'all';
        this.filterClient = 'all';
        this.sortBy = 'actual_date';
        this.sortOrder = 'desc';
        this.editingPayment = null;
        this.init();
    }

    async init() {
        // Verificar autenticación
        if (!auth.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }

        await this.loadData();
        this.renderPaymentsTable();
        this.setupEventListeners();
        this.setupModal();
        this.populateClientFilter();
    }

    async loadData() {
        try {
            // Cargar clientes
            const { data: clients, error: clientsError } = await supabase
                .from('clients')
                .select('id, name, principal_amount, monthly_percentage, payment_day')
                .eq('is_active', true)
                .order('name');

            if (clientsError) throw clientsError;
            this.clients = clients || [];

            // Cargar pagos con información del cliente
            const { data: payments, error: paymentsError } = await supabase
                .from('payments')
                .select(`
                    *,
                    clients:client_id (
                        name,
                        principal_amount,
                        monthly_percentage
                    )
                `)
                .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

            if (paymentsError) throw paymentsError;
            
            // Calcular status y días de diferencia para cada pago
            this.payments = (payments || []).map(payment => {
                const status = this.calculatePaymentStatus(payment.expected_date, payment.actual_date);
                return {
                    ...payment,
                    status: status.status,
                    days_difference: status.days
                };
            });

        } catch (error) {
            console.error('Error cargando datos:', error);
            this.showError('Error cargando datos de pagos');
        }
    }

    async createPayment(paymentData) {
        try {
            // Calcular status y días de diferencia
            const status = this.calculatePaymentStatus(paymentData.expected_date, paymentData.actual_date);
            
            const { data, error } = await supabase
                .from('payments')
                .insert([{
                    ...paymentData,
                    user_id: auth.user.id,
                    status: status.status,
                    days_difference: status.days
                }])
                .select(`
                    *,
                    clients:client_id (
                        name,
                        principal_amount,
                        monthly_percentage
                    )
                `)
                .single();

            if (error) throw error;
            
            await this.loadData();
            this.renderPaymentsTable();
            this.showSuccess('Pago registrado exitosamente');
            return data;
            
        } catch (error) {
            console.error('Error creando pago:', error);
            throw new Error('Error al registrar el pago: ' + error.message);
        }
    }

    async updatePayment(id, paymentData) {
        try {
            const status = this.calculatePaymentStatus(paymentData.expected_date, paymentData.actual_date);
            
            const { data, error } = await supabase
                .from('payments')
                .update({
                    ...paymentData,
                    status: status.status,
                    days_difference: status.days
                })
                .eq('id', id)
                .eq('user_id', auth.user.id)
                .select(`
                    *,
                    clients:client_id (
                        name,
                        principal_amount,
                        monthly_percentage
                    )
                `)
                .single();

            if (error) throw error;
            
            await this.loadData();
            this.renderPaymentsTable();
            this.showSuccess('Pago actualizado exitosamente');
            return data;
            
        } catch (error) {
            console.error('Error actualizando pago:', error);
            throw new Error('Error al actualizar el pago: ' + error.message);
        }
    }

    async deletePayment(id) {
        try {
            const { error } = await supabase
                .from('payments')
                .delete()
                .eq('id', id)
                .eq('user_id', auth.user.id);

            if (error) throw error;
            
            await this.loadData();
            this.renderPaymentsTable();
            this.showSuccess('Pago eliminado exitosamente');
            return true;
            
        } catch (error) {
            console.error('Error eliminando pago:', error);
            this.showError('Error al eliminar el pago');
            return false;
        }
    }

    renderPaymentsTable() {
        const filteredPayments = this.getFilteredPayments();
        const paginatedPayments = this.getPaginatedPayments(filteredPayments);
        
        this.renderTable(paginatedPayments);
        this.renderPagination(filteredPayments.length);
        this.renderStats();
    }

    getFilteredPayments() {
        let filtered = [...this.payments];
        
        // Aplicar búsqueda
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(payment => 
                payment.clients?.name.toLowerCase().includes(term) ||
                payment.notes?.toLowerCase().includes(term) ||
                payment.amount.toString().includes(term)
            );
        }
        
        // Aplicar filtro de estado
        if (this.filterStatus !== 'all') {
            filtered = filtered.filter(payment => payment.status === this.filterStatus);
        }
        
        // Aplicar filtro de cliente
        if (this.filterClient !== 'all') {
            filtered = filtered.filter(payment => payment.client_id === this.filterClient);
        }
        
        return filtered;
    }

    getPaginatedPayments(payments) {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return payments.slice(start, end);
    }

    renderTable(payments) {
        const tbody = document.getElementById('payments-table-body');
        if (!tbody) return;

        if (payments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                        ${this.searchTerm || this.filterStatus !== 'all' || this.filterClient !== 'all' 
                            ? 'No se encontraron pagos con los filtros aplicados' 
                            : 'No hay pagos registrados'}
                    </td>
                </tr>
            `;
            return;
        }

        const html = payments.map(payment => {
            const statusClass = this.getStatusClass(payment.status);
            const statusText = this.getStatusText(payment);
            const clientName = payment.clients?.name || 'Cliente Desconocido';
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                        <div>
                            <div class="text-sm font-medium text-gray-900">${this.escapeHtml(clientName)}</div>
                            <div class="text-sm text-gray-500">
                                Esperado: ${this.formatDate(payment.expected_date)}
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                        ${this.formatDate(payment.actual_date)}
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-green-600">
                        ${this.formatCurrency(payment.amount)}
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 max-w-xs">
                        <div class="truncate" title="${this.escapeHtml(payment.notes || '')}">
                            ${this.escapeHtml(payment.notes || '-')}
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-400">
                        ${this.formatDate(payment.created_at)}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                        <div class="flex space-x-2">
                            <button onclick="paymentManager.editPayment('${payment.id}')" 
                                    class="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                                    title="Editar pago">
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                </svg>
                            </button>
                            <button onclick="paymentManager.deletePaymentConfirm('${payment.id}')" 
                                    class="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                    title="Eliminar pago">
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                            <button onclick="paymentManager.duplicatePayment('${payment.id}')" 
                                    class="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                                    title="Duplicar pago">
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
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
                    ${totalItems} pagos
                </div>
                <div class="flex space-x-2">
                    <button onclick="paymentManager.goToPage(${this.currentPage - 1})" 
                            ${this.currentPage === 1 ? 'disabled' : ''}
                            class="px-3 py-1 text-sm border rounded ${this.currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}">
                        Anterior
                    </button>
                    
                    ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                        const page = i + Math.max(1, this.currentPage - 2);
                        if (page > totalPages) return '';
                        
                        return `
                            <button onclick="paymentManager.goToPage(${page})" 
                                    class="px-3 py-1 text-sm border rounded ${page === this.currentPage ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}">
                                ${page}
                            </button>
                        `;
                    }).join('')}
                    
                    <button onclick="paymentManager.goToPage(${this.currentPage + 1})" 
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
        const totalPayments = this.payments.length;
        const totalAmount = this.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        const onTimePayments = this.payments.filter(p => p.status === 'ontime').length;
        const latePayments = this.payments.filter(p => p.status === 'late').length;
        const earlyPayments = this.payments.filter(p => p.status === 'early').length;

        // Calcular promedio de días de retraso
        const latePaymentsWithDays = this.payments.filter(p => p.status === 'late');
        const avgDelay = latePaymentsWithDays.length > 0 ? 
            latePaymentsWithDays.reduce((sum, p) => sum + p.days_difference, 0) / latePaymentsWithDays.length : 0;

        // Pagos del mes actual
        const thisMonth = new Date().toISOString().slice(0, 7);
        const thisMonthPayments = this.payments.filter(p => p.actual_date.startsWith(thisMonth));
        const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        const statsContainer = document.getElementById('payments-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    <div class="bg-blue-50 rounded-lg p-4">
                        <div class="text-2xl font-bold text-blue-900">${totalPayments}</div>
                        <div class="text-blue-700 text-sm">Total Pagos</div>
                    </div>
                    <div class="bg-green-50 rounded-lg p-4">
                        <div class="text-2xl font-bold text-green-900">${this.formatCurrency(totalAmount)}</div>
                        <div class="text-green-700 text-sm">Total Recaudado</div>
                    </div>
                    <div class="bg-emerald-50 rounded-lg p-4">
                        <div class="text-2xl font-bold text-emerald-900">${onTimePayments}</div>
                        <div class="text-emerald-700 text-sm">A Tiempo</div>
                    </div>
                    <div class="bg-red-50 rounded-lg p-4">
                        <div class="text-2xl font-bold text-red-900">${latePayments}</div>
                        <div class="text-red-700 text-sm">Tardíos</div>
                    </div>
                    <div class="bg-cyan-50 rounded-lg p-4">
                        <div class="text-2xl font-bold text-cyan-900">${earlyPayments}</div>
                        <div class="text-cyan-700 text-sm">Anticipados</div>
                    </div>
                    <div class="bg-purple-50 rounded-lg p-4">
                        <div class="text-2xl font-bold text-purple-900">${this.formatCurrency(thisMonthTotal)}</div>
                        <div class="text-purple-700 text-sm">Este Mes</div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="bg-yellow-50 rounded-lg p-4">
                        <div class="text-lg font-bold text-yellow-900">
                            ${avgDelay > 0 ? `${avgDelay.toFixed(1)} días` : 'N/A'}
                        </div>
                        <div class="text-yellow-700 text-sm">Promedio Retraso</div>
                    </div>
                    <div class="bg-indigo-50 rounded-lg p-4">
                        <div class="text-lg font-bold text-indigo-900">
                            ${totalPayments > 0 ? ((onTimePayments / totalPayments) * 100).toFixed(1) : 0}%
                        </div>
                        <div class="text-indigo-700 text-sm">Puntualidad</div>
                    </div>
                </div>
            `;
        }
    }

    populateClientFilter() {
        const select = document.getElementById('filter-client');
        if (!select) return;

        const html = `
            <option value="all">Todos los clientes</option>
            ${this.clients.map(client => 
                `<option value="${client.id}">${this.escapeHtml(client.name)}</option>`
            ).join('')}
        `;

        select.innerHTML = html;
    }

    setupEventListeners() {
        // Búsqueda
        const searchInput = document.getElementById('payment-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.currentPage = 1;
                this.renderPaymentsTable();
            });
        }

        // Filtros
        const statusFilter = document.getElementById('filter-status');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filterStatus = e.target.value;
                this.currentPage = 1;
                this.renderPaymentsTable();
            });
        }

        const clientFilter = document.getElementById('filter-client');
        if (clientFilter) {
            clientFilter.addEventListener('change', (e) => {
                this.filterClient = e.target.value;
                this.currentPage = 1;
                this.renderPaymentsTable();
            });
        }

        // Botón agregar pago
        const addButton = document.getElementById('add-payment-btn');
        if (addButton) {
            addButton.addEventListener('click', () => {
                this.showPaymentModal();
            });
        }

        // Ordenamiento
        const sortButtons = document.querySelectorAll('[data-sort]');
        sortButtons.forEach(button => {
            button.addEventListener('click', () => {
                const sortBy = button.dataset.sort;
                if (this.sortBy === sortBy) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortBy = sortBy;
                    this.sortOrder = 'asc';
                }
                this.loadData().then(() => this.renderPaymentsTable());
            });
        });

        // Items per page
        const itemsSelect = document.getElementById('items-per-page');
        if (itemsSelect) {
            itemsSelect.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.renderPaymentsTable();
            });
        }

        // Limpiar filtros
        const clearFiltersBtn = document.getElementById('clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.searchTerm = '';
                this.filterStatus = 'all';
                this.filterClient = 'all';
                this.currentPage = 1;
                
                // Resetear controles
                if (searchInput) searchInput.value = '';
                if (statusFilter) statusFilter.value = 'all';
                if (clientFilter) clientFilter.value = 'all';
                
                this.renderPaymentsTable();
            });
        }
    }

    setupModal() {
        // Formulario del modal
        const form = document.getElementById('payment-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleFormSubmit(e);
            });
        }

        // Cerrar modal
        const closeButtons = document.querySelectorAll('[data-modal-close]');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.hidePaymentModal();
            });
        });

        // Cerrar modal al hacer clic fuera
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hidePaymentModal();
                }
            });
        }

        // Validación en tiempo real
        this.setupFormValidation();
    }

    setupFormValidation() {
        const clientSelect = document.getElementById('client_id');
        const expectedDateInput = document.getElementById('expected_date');
        const actualDateInput = document.getElementById('actual_date');
        const amountInput = document.getElementById('amount');
        const statusPreview = document.getElementById('status-preview');

        const updatePreview = () => {
            const clientId = clientSelect?.value;
            const expectedDate = expectedDateInput?.value;
            const actualDate = actualDateInput?.value;
            const amount = parseFloat(amountInput?.value || 0);

            if (statusPreview) {
                let html = '';

                // Mostrar pago esperado del cliente
                if (clientId) {
                    const client = this.clients.find(c => c.id === clientId);
                    if (client) {
                        const expectedAmount = client.principal_amount * client.monthly_percentage / 100;
                        html += `
                            <div class="bg-blue-50 p-3 rounded-md mb-2">
                                <p class="text-sm text-blue-700">
                                    Pago esperado: <span class="font-semibold">${this.formatCurrency(expectedAmount)}</span>
                                </p>
                            </div>
                        `;

                        // Auto-llenar el monto si está vacío
                        if (!amountInput.value) {
                            amountInput.value = expectedAmount;
                        }

                        // Auto-llenar fecha esperada si está vacía
                        if (!expectedDateInput.value) {
                            const nextPayment = this.getNextPaymentDate(client);
                            expectedDateInput.value = nextPayment;
                        }
                    }
                }

                // Mostrar estado del pago
                if (expectedDate && actualDate) {
                    const status = this.calculatePaymentStatus(expectedDate, actualDate);
                    const statusClass = this.getStatusClass(status.status);
                    const statusText = this.getStatusText(status);
                    
                    html += `
                        <div class="p-3 rounded-md ${statusClass.replace('text-', 'bg-').replace('-800', '-50').replace('-100', '-50')}">
                            <p class="text-sm font-medium ${statusClass}">
                                ${statusText}
                            </p>
                        </div>
                    `;
                }

                statusPreview.innerHTML = html;
            }
        };

        // Escuchar cambios en los campos
        if (clientSelect) clientSelect.addEventListener('change', updatePreview);
        if (expectedDateInput) expectedDateInput.addEventListener('change', updatePreview);
        if (actualDateInput) actualDateInput.addEventListener('change', updatePreview);
        if (amountInput) amountInput.addEventListener('input', updatePreview);
    }

    async handleFormSubmit(e) {
        const formData = new FormData(e.target);
        const paymentData = {
            client_id: formData.get('client_id'),
            expected_date: formData.get('expected_date'),
            actual_date: formData.get('actual_date'),
            amount: parseFloat(formData.get('amount')),
            notes: formData.get('notes')?.trim() || null
        };

        // Validaciones
        if (!paymentData.client_id) {
            this.showError('Debe seleccionar un cliente');
            return;
        }

        if (!paymentData.expected_date) {
            this.showError('La fecha esperada es requerida');
            return;
        }

        if (!paymentData.actual_date) {
            this.showError('La fecha real es requerida');
            return;
        }

        if (!paymentData.amount || paymentData.amount <= 0) {
            this.showError('El monto debe ser mayor a 0');
            return;
        }

        try {
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Guardando...';

            if (this.editingPayment) {
                await this.updatePayment(this.editingPayment.id, paymentData);
            } else {
                await this.createPayment(paymentData);
            }

            this.hidePaymentModal();
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = false;
            submitButton.textContent = this.editingPayment ? 'Actualizar Pago' : 'Registrar Pago';
        }
    }

    showPaymentModal(payment = null) {
        this.editingPayment = payment;
        const modal = document.getElementById('payment-modal');
        const form = document.getElementById('payment-form');
        const title = document.getElementById('modal-title');

        if (!modal || !form || !title) return;

        // Configurar título
        title.textContent = payment ? 'Editar Pago' : 'Registrar Nuevo Pago';

        // Poblar select de clientes
        const clientSelect = form.elements.client_id;
        if (clientSelect) {
            const html = `
                <option value="">Seleccionar cliente</option>
                ${this.clients.map(client => {
                    const expectedAmount = client.principal_amount * client.monthly_percentage / 100;
                    return `<option value="${client.id}">${this.escapeHtml(client.name)} - ${this.formatCurrency(expectedAmount)} (Día ${client.payment_day})</option>`;
                }).join('')}
            `;
            clientSelect.innerHTML = html;
        }

        // Limpiar o llenar formulario
        if (payment) {
            form.elements.client_id.value = payment.client_id;
            form.elements.expected_date.value = payment.expected_date;
            form.elements.actual_date.value = payment.actual_date;
            form.elements.amount.value = payment.amount;
            form.elements.notes.value = payment.notes || '';
        } else {
            form.reset();
            form.elements.actual_date.value = new Date().toISOString().split('T')[0];
        }

        // Actualizar preview
        setTimeout(() => {
            const event = new Event('change');
            form.elements.client_id.dispatchEvent(event);
        }, 100);

        // Mostrar modal
        modal.classList.remove('hidden');
        form.elements.client_id.focus();
    }

    hidePaymentModal() {
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.editingPayment = null;
    }

    editPayment(id) {
        const payment = this.payments.find(p => p.id === id);
        if (payment) {
            this.showPaymentModal(payment);
        }
    }

    deletePaymentConfirm(id) {
        const payment = this.payments.find(p => p.id === id);
        if (payment) {
            const clientName = payment.clients?.name || 'Cliente';
            const confirmed = confirm(`¿Estás seguro de eliminar el pago de ${clientName} del ${this.formatDate(payment.actual_date)}?`);
            if (confirmed) {
                this.deletePayment(id);
            }
        }
    }

    duplicatePayment(id) {
        const payment = this.payments.find(p => p.id === id);
        if (payment) {
            // Crear una copia del pago con nueva fecha
            const duplicatedPayment = {
                ...payment,
                actual_date: new Date().toISOString().split('T')[0],
                expected_date: this.getNextPaymentDate(this.clients.find(c => c.id === payment.client_id))
            };
            
            this.showPaymentModal(duplicatedPayment);
        }
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.getFilteredPayments().length / this.itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderPaymentsTable();
        }
    }

    // Métodos auxiliares
    calculatePaymentStatus(expectedDate, actualDate) {
        const expected = new Date(expectedDate);
        const actual = new Date(actualDate);
        const diffTime = actual - expected;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) return { status: 'late', days: diffDays };
        if (diffDays === 0) return { status: 'ontime', days: 0 };
        return { status: 'early', days: Math.abs(diffDays) };
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

    getStatusClass(status) {
        const classes = {
            'late': 'bg-red-100 text-red-800',
            'ontime': 'bg-green-100 text-green-800',
            'early': 'bg-blue-100 text-blue-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    }

    getStatusText(payment) {
        if (payment.status === 'late') return `${payment.days_difference} días tarde`;
        if (payment.status === 'ontime') return 'A tiempo';
        if (payment.status === 'early') return `${payment.days_difference} días antes`;
        return 'Desconocido';
    }

    formatCurrency(amount) {
        return `Q${parseFloat(amount).toLocaleString('es-GT', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
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

// Inicializar gestor de pagos
let paymentManager;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (auth.isAuthenticated()) {
            paymentManager = new PaymentManager();
        }
    }, 100);
});