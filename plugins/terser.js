const { minify } = require('terser');

function terser(options = {}) {
    return {
        name: 'terser',
        // Implement the bundle hook
        async bundle(content) {
            try {
                const result = await minify(content, options);
                return result.code;
            } catch (error) {
                console.error('Terser plugin error:', error);
                return content;
            }
        }
    };
}

module.exports = terser;
