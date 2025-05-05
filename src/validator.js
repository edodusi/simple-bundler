export function formatDate(date) {
    return date.toISOString().substring(0, 10);
}

export function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

export function validatePhone(phone) {
    return phone.match(/^\d{10}$/) !== null;
}

export const validatorState = {
    isValid: true,
    lastChecked: new Date()
};
