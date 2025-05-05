const terser = require('./plugins/terser');

module.exports = {
    entry: 'src/index.js',
    output: 'dist/bundle.js',
    plugins: [
        terser({
            compress: {
                dead_code: true,
                drop_console: false,
            }
        }),
    ],
};
