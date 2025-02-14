export function formatCurrency(amount) {
    return `$${amount.toFixed(2)}`;
}

export function formatPercent(number) {
    return `${(number * 100).toFixed(1)}%`;
}

export const formatterConfig = {
    currency: 'USD',
    locale: 'en-US'
};
