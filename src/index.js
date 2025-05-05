// Import specific items from each module
import { appName, formatDate, config as utilsConfig } from './utils.js';
import add, { subtract, calculatorConfig } from './calculator.js';
import { validateEmail, validatePhone, validatorState, formatDate as formatDateISO } from './validator.js';
import {
    formatCurrency,
    formatPercent,
    formatterConfig
} from './formatter.js';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Starting application...');

    // Set app name and version
    document.getElementById('app-name').textContent = appName;
    document.getElementById('app-version').textContent = 'v' + utilsConfig.version;

    // Initialize date displays
    const date = new Date();
    document.getElementById('current-date').textContent = 'Today is ' + formatDate(date);
    document.getElementById('standard-date').textContent = formatDate(date);
    document.getElementById('iso-date').textContent = formatDateISO(date);

    // Calculator functionality
    document.getElementById('add-btn').addEventListener('click', () => {
        const num1 = parseFloat(document.getElementById('num1').value);
        const num2 = parseFloat(document.getElementById('num2').value);
        const result = add(num1, num2);
        document.getElementById('calc-result').textContent = `Result: ${result}`;
    });

    document.getElementById('subtract-btn').addEventListener('click', () => {
        const num1 = parseFloat(document.getElementById('num1').value);
        const num2 = parseFloat(document.getElementById('num2').value);
        const result = subtract(num1, num2);
        document.getElementById('calc-result').textContent = `Result: ${result}`;
    });

    // Formatter functionality
    document.getElementById('format-currency-btn').addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('amount').value);
        const formatted = formatCurrency(amount);
        document.getElementById('format-result').textContent = `Result: ${formatted}`;
    });

    document.getElementById('format-percent-btn').addEventListener('click', () => {
        const percent = parseFloat(document.getElementById('percent').value);
        const formatted = formatPercent(percent);
        document.getElementById('format-result').textContent = `Result: ${formatted}`;
    });

    // Validator functionality
    document.getElementById('validate-email-btn').addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const isValid = validateEmail(email);
        const resultEl = document.getElementById('validate-result');
        resultEl.textContent = isValid
            ? `Email is valid ✓`
            : `Email is invalid ✗`;
        resultEl.className = isValid ? 'result valid' : 'result invalid';
    });

    document.getElementById('validate-phone-btn').addEventListener('click', () => {
        const phone = document.getElementById('phone').value;
        const isValid = validatePhone(phone);
        const resultEl = document.getElementById('validate-result');
        resultEl.textContent = isValid
            ? `Phone is valid ✓`
            : `Phone is invalid ✗`;
        resultEl.className = isValid ? 'result valid' : 'result invalid';
    });

    // Log configuration values
    console.log('Configs:', {
        utils: utilsConfig,
        calculator: calculatorConfig,
        formatter: formatterConfig,
        validator: validatorState
    });

    // Trigger initial calculations to populate results
    document.getElementById('add-btn').click();
    document.getElementById('format-currency-btn').click();
    document.getElementById('validate-email-btn').click();
});
