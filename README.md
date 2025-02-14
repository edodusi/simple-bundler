<img src="docs/simple-bundler-logo.png" alt="Simple Bundler Logo" />

# Simple Bundler

A lightweight JavaScript module bundler created for learning purposes. This bundler demonstrates the core concepts of how modern bundlers work, including module resolution, dependency graph creation, and code transformation.

## Features

- ES Modules support (import/export)
- Support for both default and named exports
- Dependency graph generation
- Plugin system
- Configuration file support
- Built-in Terser minification plugin
- Relative path resolution
- Command-line interface

## Installation

```bash
npm install
```

## Usage

1. Create a configuration file (`bundler.config.js`):

```javascript
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
```

2. Run the bundler:

```bash
npm run build
```

Or with a custom config file:

```bash
node bundler.js my-config.js
```

## How It Works

The bundler performs these main steps:

1. Reads the entry file and parses its dependencies
2. Builds a dependency graph by recursively analyzing imports
3. Transforms ES Module syntax to CommonJS
4. Applies plugins (e.g., minification)
5. Generates a single bundle file

## Plugin System

Plugins can hook into different phases of the bundling process:

- `preTransform`: Before module transformation
- `postTransform`: After module transformation
- `bundle`: Final bundle transformation

Example plugin:

```javascript
function createMyPlugin() {
    return {
        name: 'my-plugin',
        async bundle(content) {
            // Transform the content
            return transformedContent;
        }
    };
}
```

## Limitations

This is a learning project and has some limitations:

- Uses regex for parsing (instead of proper AST parsing)
- Limited support for complex module scenarios
- No source maps
- No code splitting
- No tree shaking
- No support for non-JavaScript assets

## Contributing

This project is meant for learning purposes. Feel free to fork it and experiment with additional features or improvements.

## License

MIT
