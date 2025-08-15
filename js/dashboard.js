// js/dashboard.js
class Dashboard {
    constructor() {
        this.clients = [];
        this.payments = [];
        this.charts = {};
        this.init();
    }

    async init() {
        // Verificar autenticación
        if (!auth.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }

        await this.loadData();
        this.renderMetrics();
        this.renderCharts();
        this.renderRecentPayments();
        this.renderUpcomingPayments();
        this.setupEventListeners();
    }

    async loadData() {
        try {
            // Cargar clientes
            const { data: clients, error: clientsError } = await supabase
                .from('clients')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (clientsError) throw clientsError;
            this.clients = clients || [];

            // Cargar pagos
            const { data: payments, error: paymentsError } = await supabase
                .from('payments')
                .select(`
                    *,
                    clients:client_id (
                        name,
                        principal_amount
                    )
                `)
                .order('actual_date', { ascending: false });

            if (paymentsError) throw paymentsError;
            this.payments = payments || [];

        } catch (error) {
            console.error('Error cargando datos:', error);
            this.showError('Error cargando datos del dashboard');
        }
    }

    renderMetrics() {
        const totalClients = this.clients.length;
        const totalCollected = this.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        const totalExpected = this.clients.reduce((sum, client) => 
            sum + (parseFloat(client.principal_amount) * parseFloat(client.monthly_percentage) / 100), 0);
        const totalPayments = this.payments.length;

        // Actualizar métricas en el DOM
        this.updateMetricCard('total-clients', totalClients);
        this.updateMetricCard('total-collected', this.formatCurrency(totalCollected));
        this.updateMetricCard('total-expected', this.formatCurrency(totalExpected));
        this.updateMetricCard('total-payments', totalPayments);

        // Calcular métricas adicionales
        const thisMonth = new Date().toISOString().slice(0, 7);
        const thisMonthPayments = this.payments.filter(p => 
            p.actual_date.startsWith(thisMonth)
        );
        const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
        this.updateMetricCard('month-collected', this.formatCurrency(thisMonthTotal));

        // Pagos pendientes (estimación simple)
        const latePayments = this.payments.filter(p => p.status === 'late').length;
        this.updateMetricCard('late-payments', latePayments);
    }

    updateMetricCard(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    renderCharts() {
        this.renderMonthlyChart();
        this.renderClientChart();
    }

    renderMonthlyChart() {
        const monthlyData = this.getMonthlyData();
        const ctx = document.getElementById('monthlyChart');
        
        if (!ctx) return;

        // Destruir gráfica existente si existe
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.map(d => d.formatted),
                datasets: [{
                    label: 'Ingresos Mensuales',
                    data: monthlyData.map(d => d.total),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Ingresos: ${this.formatCurrency(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    renderClientChart() {
        const clientData = this.getClientData();
        const ctx = document.getElementById('clientChart');
        
        if (!ctx) return;

        // Destruir gráfica existente si existe
        if (this.charts.client) {
            this.charts.client.destroy();
        }

        this.charts.client = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: clientData.map(d => d.name),
                datasets: [{
                    label: 'Total Pagado',
                    data: clientData.map(d => d.total),
                    backgroundColor: '#10B981',
                    borderColor: '#059669',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Total: ${this.formatCurrency(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    getMonthlyData() {
        const monthlyData = {};
        
        this.payments.forEach(payment => {
            const month = payment.actual_date.substring(0, 7); // YYYY-MM
            if (!monthlyData[month]) {
                monthlyData[month] = 0;
            }
            monthlyData[month] += parseFloat(payment.amount);
        });

        return Object.entries(monthlyData)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, total]) => ({
                month: month,
                total: total,
                formatted: this.formatMonth(month)
            }));
    }

    getClientData() {
        const clientData = {};
        
        this.payments.forEach(payment => {
            const clientName = payment.clients?.name || 'Cliente Desconocido';
            if (!clientData[clientName]) {
                clientData[clientName] = 0;
            }
            clientData[clientName] += parseFloat(payment.amount);
        });

        return Object.entries(clientData)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10); // Top 10 clientes
    }

    renderRecentPayments() {
        const container = document.getElementById('recent-payments');
        if (!container) return;

        const recentPayments = this.payments.slice(0, 5);
        
        if (recentPayments.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay pagos registrados</p>';
            return;
        }

        const html = recentPayments.map(payment => {
            const status = this.getPaymentStatus(payment.expected_date, payment.actual_date);
            const statusClass = this.getStatusClass(status.status);
            const statusText = this.getStatusText(status);
            
            return `
                <div class="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0">
                    <div class="flex-1">
                        <p class="font-medium text-gray-900">${payment.clients?.name || 'Cliente'}</p>
                        <p class="text-sm text-gray-500">${this.formatDate(payment.actual_date)}</p>
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                    <div class="text-right">
                        <p class="font-semibold text-green-600">${this.formatCurrency(payment.amount)}</p>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    renderUpcomingPayments() {
        const container = document.getElementById('upcoming-payments');
        if (!container) return;

        const upcomingPayments = this.getUpcomingPayments();
        
        if (upcomingPayments.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay pagos próximos</p>';
            return;
        }

        const html = upcomingPayments.map(client => {
            const nextPaymentDate = this.getNextPaymentDate(client);
            const daysUntil = this.getDaysUntil(nextPaymentDate);
            const urgencyClass = daysUntil <= 3 ? 'text-red-600' : daysUntil <= 7 ? 'text-yellow-600' : 'text-green-600';
            
            return `
                <div class="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0">
                    <div class="flex-1">
                        <p class="font-medium text-gray-900">${client.name}</p>
                        <p class="text-sm text-gray-500">${this.formatDate(nextPaymentDate)}</p>
                        <span class="text-xs ${urgencyClass}">
                            ${daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañana' : `En ${daysUntil} días`}
                        </span>
                    </div>
                    <div class="text-right">
                        <p class="font-semibold text-blue-600">
                            ${this.formatCurrency(client.principal_amount * client.monthly_percentage / 100)}
                        </p>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    getUpcomingPayments() {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        
        return this.clients
            .map(client => {
                const nextPayment = this.getNextPaymentDate(client);
                return {
                    ...client,
                    nextPaymentDate: nextPayment,
                    daysUntil: this.getDaysUntil(nextPayment)
                };
            })
            .filter(client => client.daysUntil >= 0 && client.daysUntil <= 30)
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .slice(0, 5);
    }

    getNextPaymentDate(client) {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        let nextPaymentDate = new Date(currentYear, currentMonth, client.payment_day);
        
        // Si ya pasó el día de pago este mes, el siguiente pago es el próximo mes
        if (nextPaymentDate <= today) {
            nextPaymentDate = new Date(currentYear, currentMonth + 1, client.payment_day);
        }
        
        return nextPaymentDate.toISOString().split('T')[0];
    }

    getDaysUntil(dateString) {
        const today = new Date();
        const targetDate = new Date(dateString);
        const diffTime = targetDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getPaymentStatus(expectedDate, actualDate) {
        const expected = new Date(expectedDate);
        const actual = new Date(actualDate);
        const diffTime = actual - expected;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) return { status: 'late', days: diffDays };
        if (diffDays === 0) return { status: 'ontime', days: 0 };
        return { status: 'early', days: Math.abs(diffDays) };
    }

    getStatusClass(status) {
        const classes = {
            'late': 'bg-red-100 text-red-800',
            'ontime': 'bg-green-100 text-green-800',
            'early': 'bg-blue-100 text-blue-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    }

    getStatusText(status) {
        if (status.status === 'late') return `${status.days} días tarde`;
        if (status.status === 'ontime') return 'A tiempo';
        if (status.status === 'early') return `${status.days} días antes`;
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

    formatMonth(monthString) {
        const [year, month] = monthString.split('-');
        return new Date(year, month - 1).toLocaleDateString('es-GT', {
            year: 'numeric',
            month: 'long'
        });
    }

    setupEventListeners() {
        // Botón de actualizar
        const refreshBtn = document.getElementById('refresh-dashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadData().then(() => {
                    this.renderMetrics();
                    this.renderCharts();
                    this.renderRecentPayments();
                    this.renderUpcomingPayments();
                });
            });
        }

        // Auto-actualizar cada 5 minutos
        setInterval(() => {
            this.loadData().then(() => {
                this.renderMetrics();
                this.renderRecentPayments();
                this.renderUpcomingPayments();
            });
        }, 5 * 60 * 1000);
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

// Inicializar dashboard cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que auth esté listo
    setTimeout(() => {
        if (auth.isAuthenticated()) {
            new Dashboard();
        }
    }, 100);
});