let result = 0;

export default function add(a, b) {
    result = a + b;
    return result;
}

export function subtract(a, b) {
    result = a - b;
    return result;
}

export const calculatorConfig = {
    precision: 2
};
