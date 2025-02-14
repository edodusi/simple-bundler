// Import specific items from each module
import { appName, formatDate, config as utilsConfig } from './utils.js';
import add, { subtract, calculatorConfig } from './calculator.js';
import { validateEmail, validatorState, formatDate as formatDateISO } from './validator.js';
import {
    formatCurrency,
    formatPercent,
    formatterConfig
} from './formatter.js';

console.log('Starting application...');

// Now we have clear separation and no naming conflicts
console.log('App Name:', appName);

// Using date formatter
const date = new Date();
console.log('Formatted Date:', formatDate(date));
console.log('ISO Date:', formatDateISO(date));

// Using calculator functions
const sum = add(5, 3);
console.log('Sum:', sum);
console.log('Difference:', subtract(10, 4));

// Using validator
console.log('Email validation:', validateEmail('test@example.com'));
console.log('Validator state:', validatorState);

// Using formatter
console.log('Formatted currency:', formatCurrency(99.99));
console.log('Formatted percent:', formatPercent(0.156));

// All configs are now separate and clearly named
console.log('Configs:', {
    utils: utilsConfig,
    calculator: calculatorConfig,
    formatter: formatterConfig
});
