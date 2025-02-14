export function formatDate(date) {
    return date.toISOString();
}

export function validateEmail(email) {
    return email.includes('@');
}

export function validatePhone(phone) {
    return phone.match(/^\d{10}$/);
}

export const validatorState = {
    isValid: true
};
