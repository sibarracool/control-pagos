// js/utils.js
// Funciones auxiliares globales para la aplicación

class Utils {
    
    // Formateo de moneda
    static formatCurrency(amount, currency = 'Q') {
        const numAmount = parseFloat(amount) || 0;
        return `${currency}${numAmount.toLocaleString('es-GT', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
    }

    // Formateo de fechas
    static formatDate(dateString, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        const formatOptions = { ...defaultOptions, ...options };
        
        try {
            return new Date(dateString).toLocaleDateString('es-GT', formatOptions);
        } catch (error) {
            return 'Fecha inválida';
        }
    }

    // Formateo de fecha y hora
    static formatDateTime(dateString) {
        try {
            return new Date(dateString).toLocaleString('es-GT', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Fecha inválida';
        }
    }

    // Formateo de mes
    static formatMonth(monthString) {
        try {
            const [year, month] = monthString.split('-');
            return new Date(year, month - 1).toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long'
            });
        } catch (error) {
            return 'Mes inválido';
        }
    }

    // Escape HTML
    static escapeHtml(text) {
        if (typeof text !== 'string') return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Validar email
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validar teléfono guatemalteco
    static isValidPhone(phone) {
        // Formatos aceptados: +502XXXXXXXX, 502XXXXXXXX, XXXXXXXX
        const phoneRegex = /^(\+?502)?[2-9]\d{7}$/;
        return phoneRegex.test(phone.replace(/\s|-/g, ''));
    }

    // Calcular diferencia en días
    static daysDifference(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = d2 - d1;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Obtener días hasta una fecha
    static daysUntil(dateString) {
        const today = new Date();
        const targetDate = new Date(dateString);
        const diffTime = targetDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Generar próxima fecha de pago
    static getNextPaymentDate(paymentDay, fromDate = null) {
        const baseDate = fromDate ? new Date(fromDate) : new Date();
        const currentMonth = baseDate.getMonth();
        const currentYear = baseDate.getFullYear();
        
        let nextPaymentDate = new Date(currentYear, currentMonth, paymentDay);
        
        // Si ya pasó el día de pago este mes, el siguiente pago es el próximo mes
        if (nextPaymentDate <= baseDate) {
            nextPaymentDate = new Date(currentYear, currentMonth + 1, paymentDay);
        }
        
        return nextPaymentDate.toISOString().split('T')[0];
    }

    // Calcular estado de pago
    static calculatePaymentStatus(expectedDate, actualDate) {
        const expected = new Date(expectedDate);
        const actual = new Date(actualDate);
        const diffTime = actual - expected;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) return { status: 'late', days: diffDays };
        if (diffDays === 0) return { status: 'ontime', days: 0 };
        return { status: 'early', days: Math.abs(diffDays) };
    }

    // Obtener clase CSS según estado
    static getStatusClass(status) {
        const classes = {
            'late': 'bg-red-100 text-red-800',
            'ontime': 'bg-green-100 text-green-800',
            'early': 'bg-blue-100 text-blue-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    }

    // Obtener texto del estado
    static getStatusText(statusInfo) {
        if (statusInfo.status === 'late') return `${statusInfo.days} días tarde`;
        if (statusInfo.status === 'ontime') return 'A tiempo';
        if (statusInfo.status === 'early') return `${statusInfo.days} días antes`;
        return 'Desconocido';
    }

    // Mostrar notificación de error
    static showError(message, duration = 5000) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 max-w-sm';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        if (duration > 0) {
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.remove();
                }
            }, duration);
        }
    }

    // Mostrar notificación de éxito
    static showSuccess(message, duration = 3000) {
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 max-w-sm';
        successDiv.innerHTML = `
            <div class="flex items-center">
                <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(successDiv);
        
        if (duration > 0) {
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.remove();
                }
            }, duration);
        }
    }

    // Mostrar notificación de información
    static showInfo(message, duration = 4000) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50 max-w-sm';
        infoDiv.innerHTML = `
            <div class="flex items-center">
                <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(infoDiv);
        
        if (duration > 0) {
            setTimeout(() => {
                if (infoDiv.parentNode) {
                    infoDiv.remove();
                }
            }, duration);
        }
    }

    // Confirmar acción
    static confirm(message, title = 'Confirmar') {
        return new Promise((resolve) => {
            const modalHtml = `
                <div id="confirm-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <h3 class="text-lg font-semibold text-gray-900 mb-4">${title}</h3>
                        <p class="text-gray-600 mb-6">${message}</p>
                        <div class="flex space-x-3">
                            <button id="confirm-yes" class="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700">
                                Sí, continuar
                            </button>
                            <button id="confirm-no" class="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            const modal = document.getElementById('confirm-modal');
            const yesBtn = document.getElementById('confirm-yes');
            const noBtn = document.getElementById('confirm-no');

            const cleanup = () => modal.remove();

            yesBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            noBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    // Debounce function
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    // Throttle function
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Generar ID único
    static generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    // Validar formulario
    static validateForm(formElement) {
        const errors = [];
        const formData = new FormData(formElement);
        
        // Obtener todas las validaciones de los campos
        const fields = formElement.querySelectorAll('[required], [data-validate]');
        
        fields.forEach(field => {
            const value = formData.get(field.name);
            const label = field.getAttribute('data-label') || field.name;
            
            // Campo requerido
            if (field.hasAttribute('required') && (!value || value.trim() === '')) {
                errors.push(`${label} es requerido`);
                field.classList.add('border-red-500');
            } else {
                field.classList.remove('border-red-500');
            }
            
            // Validaciones específicas
            const validateType = field.getAttribute('data-validate');
            if (value && validateType) {
                switch (validateType) {
                    case 'email':
                        if (!Utils.isValidEmail(value)) {
                            errors.push(`${label} no es un email válido`);
                            field.classList.add('border-red-500');
                        }
                        break;
                    case 'phone':
                        if (!Utils.isValidPhone(value)) {
                            errors.push(`${label} no es un teléfono válido`);
                            field.classList.add('border-red-500');
                        }
                        break;
                    case 'number':
                        if (isNaN(value) || parseFloat(value) <= 0) {
                            errors.push(`${label} debe ser un número válido mayor a 0`);
                            field.classList.add('border-red-500');
                        }
                        break;
                    case 'date':
                        if (isNaN(new Date(value).getTime())) {
                            errors.push(`${label} debe ser una fecha válida`);
                            field.classList.add('border-red-500');
                        }
                        break;
                }
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Exportar datos a CSV
    static exportToCSV(data, filename = 'export.csv') {
        if (!data || data.length === 0) {
            Utils.showError('No hay datos para exportar');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header] || '';
                    // Escapar comillas y envolver en comillas si contiene comas
                    return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                        ? `"${value.replace(/"/g, '""')}"` 
                        : value;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Copiar al portapapeles
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Utils.showSuccess('Copiado al portapapeles');
        } catch (err) {
            // Fallback para navegadores que no soportan clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Utils.showSuccess('Copiado al portapapeles');
        }
    }

    // Obtener información del dispositivo
    static getDeviceInfo() {
        return {
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            isTablet: /iPad|Android|webOS|BlackBerry|PlayBook|BB10/i.test(navigator.userAgent),
            isDesktop: !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
        };
    }

    // Formatear números grandes
    static formatLargeNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Calcular porcentaje
    static calculatePercentage(value, total) {
        if (total === 0) return 0;
        return ((value / total) * 100);
    }

    // Obtener color basado en porcentaje
    static getColorByPercentage(percentage) {
        if (percentage >= 80) return 'text-green-600';
        if (percentage >= 60) return 'text-yellow-600';
        if (percentage >= 40) return 'text-orange-600';
        return 'text-red-600';
    }

    // Limpiar objeto de propiedades vacías
    static cleanObject(obj) {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== null && value !== undefined && value !== '') {
                cleaned[key] = value;
            }
        }
        return cleaned;
    }

    // Generar reporte básico
    static generateReport(data, title = 'Reporte') {
        const reportWindow = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .date { color: #666; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${title}</h1>
                    <p class="date">Generado el: ${Utils.formatDateTime(new Date().toISOString())}</p>
                </div>
                ${Utils.arrayToTable(data)}
                <script>window.print();</script>
            </body>
            </html>
        `;
        
        reportWindow.document.write(html);
        reportWindow.document.close();
    }

    // Convertir array a tabla HTML
    static arrayToTable(data) {
        if (!data || data.length === 0) {
            return '<p>No hay datos disponibles</p>';
        }

        const headers = Object.keys(data[0]);
        const headerRow = headers.map(header => `<th>${Utils.escapeHtml(header)}</th>`).join('');
        const dataRows = data.map(row => 
            `<tr>${headers.map(header => `<td>${Utils.escapeHtml(row[header] || '')}</td>`).join('')}</tr>`
        ).join('');

        return `
            <table>
                <thead><tr>${headerRow}</tr></thead>
                <tbody>${dataRows}</tbody>
            </table>
        `;
    }

    // Inicializar tooltips
    static initTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'absolute bg-gray-900 text-white text-sm rounded py-1 px-2 z-50 pointer-events-none';
                tooltip.textContent = e.target.getAttribute('data-tooltip');
                tooltip.id = 'tooltip-' + Utils.generateId();
                
                document.body.appendChild(tooltip);
                
                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
            });
            
            element.addEventListener('mouseleave', () => {
                const tooltips = document.querySelectorAll('[id^="tooltip-"]');
                tooltips.forEach(tooltip => tooltip.remove());
            });
        });
    }

    // Manejar errores de Supabase
    static handleSupabaseError(error) {
        console.error('Supabase Error:', error);
        
        let message = 'Ha ocurrido un error inesperado';
        
        if (error.message) {
            if (error.message.includes('JWT')) {
                message = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
                // Redirigir al login después de un breve delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else if (error.message.includes('duplicate')) {
                message = 'Ya existe un registro con esta información';
            } else if (error.message.includes('foreign key')) {
                message = 'No se puede completar la operación debido a dependencias';
            } else if (error.message.includes('permission')) {
                message = 'No tienes permisos para realizar esta acción';
            } else {
                message = error.message;
            }
        }
        
        Utils.showError(message);
        return message;
    }
}

// Hacer Utils disponible globalmente
window.Utils = Utils;

// Inicializar funcionalidades cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar tooltips
    Utils.initTooltips();
    
    // Manejar errores globales
    window.addEventListener('error', (e) => {
        console.error('Error global:', e);
        Utils.showError('Ha ocurrido un error inesperado');
    });
    
    // Manejar errores de promesas no capturados
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Promise rejection:', e);
        if (e.reason && e.reason.message) {
            Utils.handleSupabaseError(e.reason);
        } else {
            Utils.showError('Ha ocurrido un error inesperado');
        }
    });
});