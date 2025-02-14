const createTerserPlugin = require('./plugins/terser');

module.exports = {
    entry: 'src/index.js',
    output: 'dist/bundle.js',
    plugins: [
        createTerserPlugin({
            compress: {
                dead_code: true,
                drop_console: false,
            }
        }),
    ],
};
