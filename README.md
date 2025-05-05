<img src="docs/simple-bundler-logo.png" alt="Simple Bundler Logo" />

# Simple Bundler

A lightweight JavaScript module bundler created for learning purposes. This bundler demonstrates the core concepts of how modern bundlers work, including module resolution, dependency graph creation, and code transformation.

## Features

- ES Modules support (import/export)
- AST-based parsing and transformation using Acorn
- Support for both default and named exports
- Dependency graph generation
- Plugin system
- Configuration file support
- Built-in Terser minification plugin
- Proper path resolution
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

1. Parses code into an Abstract Syntax Tree (AST) using Acorn
2. Analyzes the AST to extract imports and exports
3. Builds a dependency graph by recursively following imports
4. Transforms ES Module syntax to CommonJS through AST-based transformations
5. Applies plugins (e.g., minification)
6. Generates a single bundle file with a module loader

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

Even though this is a functional bundler, it has some limitations:

- No source maps support
- Limited handling of node_modules resolution
- No code splitting
- No tree shaking
- No support for non-JavaScript assets
- Limited handling of complex module patterns

## Contributing

This project is meant for learning purposes. Feel free to fork it and experiment with additional features or improvements.

## License

MIT
