/**
 * Simple JavaScript Module Bundler
 *
 * This is an educational implementation of a JavaScript module bundler that:
 * 1. Parses ES modules using an AST (Abstract Syntax Tree)
 * 2. Builds a dependency graph by following import statements
 * 3. Transforms ES modules into CommonJS format
 * 4. Packages everything into a self-contained bundle
 *
 * Created for learning purposes to understand how bundlers like webpack work.
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

class SimpleBundler {
    constructor(config) {
        this.config = this.normalizeConfig(config);
        this.entryFile = this.config.entry;
        this.modules = new Map();
        this.moduleId = 0;
        this.plugins = this.config.plugins || [];
    }

    /**
     * Normalize and resolve paths in the config
     */
    normalizeConfig(config) {
        return {
            entry: path.resolve(process.cwd(), config.entry),
            output: path.resolve(process.cwd(), config.output || 'dist/bundle.js'),
            plugins: config.plugins || [],
        };
    }

    /**
     * Apply plugins at different bundle phases
     * Allows for code transformation, optimization, or analysis
     */
    async applyPlugins(phase, content, moduleInfo = {}) {
        let result = content;
        for (const plugin of this.plugins) {
            if (plugin[phase]) {
                result = await plugin[phase](result, moduleInfo);
            }
        }
        return result;
    }

    /**
     * Main entry point to bundle the project
     */
    async bundle(outputFile) {
        // 1. Build the dependency graph starting from the entry file
        this.buildDependencyGraph(this.entryFile);

        // 2. Generate the bundle with all modules
        const bundleContent = await this.generateBundle();

        // 3. Apply bundle-level plugins (e.g., minification)
        const finalContent = await this.applyPlugins('bundle', bundleContent);

        // 4. Write to output file if specified
        if (outputFile) {
            fs.writeFileSync(outputFile, finalContent);
        }

        return finalContent;
    }

    /**
     * Build a dependency graph by recursively following imports
     */
    buildDependencyGraph(filePath) {
        // Skip if module already processed
        if (this.modules.has(filePath)) return;

        try {
            // Parse and analyze the module
            const module = this.readModule(filePath);
            this.modules.set(filePath, module);

            // Process each dependency recursively
            for (const dependency of module.dependencies) {
                // Skip empty dependencies or non-local modules
                if (!dependency || !this.isLocalModule(dependency)) continue;

                try {
                    // Resolve the absolute path to this dependency
                    const absolutePath = this.resolveDependencyPath(filePath, dependency);

                    // Process this dependency if not already processed
                    if (!this.modules.has(absolutePath)) {
                        this.buildDependencyGraph(absolutePath);
                    }
                } catch (err) {
                    console.warn(`Warning: Could not resolve dependency '${dependency}' from ${filePath}`);
                }
            }
        } catch (err) {
            console.error(`Error processing module ${filePath}: ${err.message}`);
            throw err;
        }
    }

    /**
     * Check if a module is a local file (not a built-in or node_module)
     */
    isLocalModule(modulePath) {
        return modulePath.startsWith('./') ||
               modulePath.startsWith('../') ||
               modulePath.startsWith('/');
    }

    /**
     * Resolve a dependency path relative to the importing file
     */
    resolveDependencyPath(importerPath, dependencyPath) {
        return path.resolve(
            path.dirname(importerPath),
            dependencyPath.endsWith('.js') ? dependencyPath : dependencyPath + '.js'
        );
    }

    /**
     * Read and parse a module file, extracting its AST and metadata
     */
    readModule(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse file content into an AST
        const ast = acorn.parse(content, {
            ecmaVersion: 2020,
            sourceType: 'module',
            locations: true
        });

        // Analyze the AST to extract dependencies and prepare transformations
        const moduleInfo = this.analyzeModule(ast, content, filePath);

        return {
            id: this.moduleId++,
            filePath,
            content,
            ast,
            ...moduleInfo
        };
    }

    /**
     * Analyze a module's AST to extract imports, exports, and prepare for transformation
     */
    analyzeModule(ast, content, filePath) {
        // Initialize module information
        const dependencies = [];
        const imports = [];
        const exports = { named: [], default: null };
        const transformations = [];
        const additionalExports = [];
        const processedExports = new Set();

        // Walk the AST to analyze imports and exports
        walk.simple(ast, {
            // Import declarations: import x from 'module'
            ImportDeclaration: (node) => {
                this.processImport(node, content, filePath, dependencies, imports, transformations);
            },

            // Named exports: export const x = 1 or export { x }
            ExportNamedDeclaration: (node) => {
                this.processNamedExport(
                    node, content, filePath, dependencies, exports,
                    transformations, additionalExports, processedExports
                );
            },

            // Default exports: export default x
            ExportDefaultDeclaration: (node) => {
                this.processDefaultExport(
                    node, content, exports, transformations, additionalExports
                );
            }
        });

        return {
            dependencies,
            imports,
            exports,
            transformations,
            additionalExports,
            processedExports
        };
    }

    /**
     * Process import declarations and create transformations
     */
    processImport(node, content, filePath, dependencies, imports, transformations) {
        // Skip invalid imports
        if (!node.source || typeof node.source.value !== 'string') return;

        const sourceValue = node.source.value;
        dependencies.push(sourceValue);

        // Handle external modules differently
        if (!this.isLocalModule(sourceValue)) {
            this.processExternalImport(node, content, transformations);
            return;
        }

        try {
            // Resolve module path
            const absolutePath = this.resolveDependencyPath(filePath, sourceValue);
            const relativePath = './' + path.relative(process.cwd(), absolutePath);
            const originalText = content.substring(node.start, node.end);

            // Build import info
            const importInfo = {
                named: [],
                default: null,
                path: sourceValue,
                originalText,
                resolvedPath: relativePath
            };

            // Process different import types
            const { replacement, importData } = this.buildImportReplacement(node, relativePath);
            Object.assign(importInfo, importData);

            imports.push(importInfo);

            // Create transformation
            transformations.push({
                start: node.start,
                end: node.end,
                replacement
            });
        } catch (err) {
            console.warn(`Warning: Error processing import '${sourceValue}' in ${filePath}: ${err.message}`);
        }
    }

    /**
     * Handle imports from external/npm modules
     */
    processExternalImport(node, content, transformations) {
        const originalText = content.substring(node.start, node.end);

        // Simple transform of ES import to CommonJS require
        transformations.push({
            start: node.start,
            end: node.end,
            replacement: originalText
                .replace('import', 'const')
                .replace('from', '=')
                .replace(/['"]([^'"]+)['"]/g, 'require("$1")')
                .replace(/;?$/, ';')
        });
    }

    /**
     * Build replacement code for import statements
     */
    buildImportReplacement(node, modulePath) {
        // Collect information about the imports
        const namedImports = [];
        let hasDefaultImport = false;
        let defaultImportName = null;
        let hasNamespaceImport = false;
        let namespaceImportName = null;

        // Process all import specifiers
        node.specifiers.forEach(specifier => {
            if (specifier.type === 'ImportDefaultSpecifier') {
                hasDefaultImport = true;
                defaultImportName = specifier.local.name;
            } else if (specifier.type === 'ImportSpecifier') {
                const importedName = specifier.imported.name;
                const localName = specifier.local.name;

                namedImports.push({
                    importedName,
                    localName,
                    needsIndividualRequire: importedName !== localName
                });
            } else if (specifier.type === 'ImportNamespaceSpecifier') {
                hasNamespaceImport = true;
                namespaceImportName = specifier.local.name;
            }
        });

        // Generate appropriate require statements
        let replacement = '';

        // Handle namespace import (import * as name)
        if (hasNamespaceImport) {
            replacement += `const ${namespaceImportName} = require("${modulePath}");\n`;
        }

        // Handle default import when individual requires needed
        if (hasDefaultImport && (namedImports.length === 0 ||
            namedImports.some(imp => imp.needsIndividualRequire))) {
            replacement += `const ${defaultImportName} = require("${modulePath}").default;\n`;
        }

        // Handle named imports
        if (namedImports.length > 0) {
            const canUseDestructuring = !namedImports.some(imp => imp.needsIndividualRequire);

            if (canUseDestructuring) {
                // Use destructuring when possible: const { a, b } = require('./module')
                let destructuringNames = namedImports.map(imp => imp.localName).join(', ');

                // Include default import in destructuring if possible
                if (hasDefaultImport && canUseDestructuring) {
                    destructuringNames = `default: ${defaultImportName}${
                        destructuringNames.length > 0 ? ', ' + destructuringNames : ''
                    }`;
                }

                replacement += `const { ${destructuringNames} } = require("${modulePath}");\n`;
            } else {
                // Individual requires when needed
                for (const { importedName, localName } of namedImports) {
                    replacement += `const ${localName} = require("${modulePath}").${importedName};\n`;
                }
            }
        } else if (!hasDefaultImport && !hasNamespaceImport) {
            // Side-effect only import: import './module'
            replacement += `require("${modulePath}");\n`;
        }

        // Create import data for module information
        const importData = {
            default: defaultImportName,
            named: namedImports.map(i =>
                i.importedName !== i.localName
                    ? `${i.importedName} as ${i.localName}`
                    : i.importedName
            ),
            namespace: namespaceImportName
        };

        return {
            replacement: replacement.trim(),
            importData
        };
    }

    /**
     * Process named exports and create transformations
     */
    processNamedExport(
        node, content, filePath, dependencies, exports,
        transformations, additionalExports, processedExports
    ) {
        if (node.declaration) {
            // Handle export declarations: export const x = 1
            this.processExportDeclaration(
                node, exports, transformations, additionalExports, processedExports
            );
        } else if (node.specifiers.length > 0) {
            // Handle export specifiers: export { x, y }
            this.processExportSpecifiers(
                node, content, filePath, dependencies, exports, transformations
            );
        }
    }

    /**
     * Process export declarations (export const x = 1)
     */
    processExportDeclaration(
        node, exports, transformations, additionalExports, processedExports
    ) {
        // Remove 'export' keyword but keep declaration
        transformations.push({
            start: node.start,
            end: node.start + 'export '.length,
            replacement: ''
        });

        // Track exports based on declaration type
        if (node.declaration.type === 'VariableDeclaration') {
            // Handle: export const/let/var x = 1, y = 2
            for (const decl of node.declaration.declarations) {
                if (decl.id.type === 'Identifier') {
                    const varName = decl.id.name;
                    exports.named.push(varName);
                    additionalExports.push(`exports.${varName} = ${varName};`);
                    processedExports.add(varName);
                }
            }
        } else if (['FunctionDeclaration', 'ClassDeclaration'].includes(node.declaration.type)) {
            // Handle: export function x(){} or export class X{}
            if (node.declaration.id) {
                const name = node.declaration.id.name;
                exports.named.push(name);
                additionalExports.push(`exports.${name} = ${name};`);
                processedExports.add(name);
            }
        }
    }

    /**
     * Process export specifiers (export { x, y as z })
     */
    processExportSpecifiers(
        node, content, filePath, dependencies, exports, transformations
    ) {
        let replacement = '';

        if (node.source) {
            // Handle re-exports: export { x, y } from 'module'
            this.processReExports(
                node, filePath, dependencies, exports, transformations
            );
        } else {
            // Handle local re-exports: export { x, y as z }
            for (const specifier of node.specifiers) {
                const exportedName = specifier.exported.name;
                const localName = specifier.local.name;
                exports.named.push(exportedName);
                replacement += `exports.${exportedName} = ${localName};\n`;
            }

            transformations.push({
                start: node.start,
                end: node.end,
                replacement: replacement.trim()
            });
        }
    }

    /**
     * Process re-exports (export { x } from 'module')
     */
    processReExports(
        node, filePath, dependencies, exports, transformations
    ) {
        const source = node.source.value;
        dependencies.push(source);

        try {
            // Resolve module path
            const absolutePath = this.resolveDependencyPath(filePath, source);
            const relativePath = './' + path.relative(process.cwd(), absolutePath);

            // Build replacement
            let replacement = '';
            const requireVarName = `_require_${source.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            replacement += `const ${requireVarName} = require("${relativePath}");\n`;

            // Process individual exports
            for (const specifier of node.specifiers) {
                const exportedName = specifier.exported.name;
                const localName = specifier.local.name;
                exports.named.push(exportedName);
                replacement += `exports.${exportedName} = ${requireVarName}.${localName};\n`;
            }

            transformations.push({
                start: node.start,
                end: node.end,
                replacement: replacement.trim()
            });
        } catch (err) {
            console.warn(`Warning: Error processing re-export from '${source}' in ${filePath}`);
        }
    }

    /**
     * Process default exports and create transformations
     */
    processDefaultExport(node, content, exports, transformations, additionalExports) {
        // Set default export placeholder
        exports.default = '_default_export_';

        if (node.declaration.type === 'Identifier') {
            // Handle: export default existingVariable
            exports.default = node.declaration.name;
            transformations.push({
                start: node.start,
                end: node.end,
                replacement: `exports.default = ${node.declaration.name};`
            });
        } else if (['FunctionDeclaration', 'ClassDeclaration'].includes(node.declaration.type)) {
            // Handle: export default function x(){} or class X{}
            if (node.declaration.id) {
                // Named function or class
                exports.default = node.declaration.id.name;
                const name = node.declaration.id.name;

                // Remove 'export default' but keep declaration
                transformations.push({
                    start: node.start,
                    end: node.start + 'export default '.length,
                    replacement: ''
                });

                // Add export at the end
                additionalExports.push(`exports.default = ${name};`);
            } else {
                // Anonymous function/class
                const declarationText = content.substring(
                    node.declaration.start,
                    node.declaration.end
                );

                transformations.push({
                    start: node.start,
                    end: node.end,
                    replacement: `exports.default = ${declarationText};`
                });
            }
        } else {
            // Handle: export default expression
            const declarationText = content.substring(
                node.declaration.start,
                node.declaration.end
            );

            transformations.push({
                start: node.start,
                end: node.end,
                replacement: `exports.default = ${declarationText};`
            });
        }
    }

    /**
     * Transform module content using pre-computed transformations
     */
    async transformModuleContent(module) {
        // Apply pre-transform plugins
        let transformedContent = await this.applyPlugins('preTransform', module.content, module);

        // Apply transformations in reverse order (to maintain position integrity)
        const transformations = [...module.transformations].sort((a, b) => b.start - a.start);

        for (const { start, end, replacement } of transformations) {
            transformedContent =
                transformedContent.substring(0, start) +
                replacement +
                transformedContent.substring(end);
        }

        // Add any additional exports at the end
        const additionalExports = [...module.additionalExports];
        for (const exp of module.exports.named) {
            if (!module.processedExports.has(exp)) {
                additionalExports.push(`exports.${exp} = ${exp};`);
            }
        }

        if (additionalExports.length > 0) {
            transformedContent += '\n' + additionalExports.join('\n');
        }

        // Apply post-transform plugins
        transformedContent = await this.applyPlugins('postTransform', transformedContent, module);

        return transformedContent;
    }

    /**
     * Generate the final bundle with all modules
     */
    async generateBundle() {
        // Create bundle header with runtime code
        let bundle = this.generateBundleRuntime();

        // Transform all modules and add them to the bundle
        const moduleEntries = Array.from(this.modules.entries());
        const transformedModules = await Promise.all(
            moduleEntries.map(async ([filePath, module]) => {
                const relativePath = './' + path.relative(process.cwd(), module.filePath);
                console.log('Adding module:', relativePath);

                const transformedContent = await this.transformModuleContent(module);
                return {
                    path: relativePath,
                    content: transformedContent
                };
            })
        );

        // Add all modules to the bundle
        bundle += '  var modules = {\n';
        transformedModules.forEach(({ path, content }) => {
            bundle += `    "${path}": function(module, exports, require) {\n`;
            bundle += `      ${content}\n`;
            bundle += '    },\n';
        });
        bundle += '  };\n\n';

        // Add code to start execution from entry point
        const relativeEntryPath = './' + path.relative(process.cwd(), this.entryFile);
        bundle += `  require("${relativeEntryPath}");\n`;
        bundle += '})();\n';

        return bundle;
    }

    /**
     * Generate the bundle runtime code that implements the module system
     */
    generateBundleRuntime() {
        return `
(function(modules) {
  // The require function: loads modules and caches them
  function require(moduleId) {
    // Check if module is in cache
    if (require.cache[moduleId]) return require.cache[moduleId].exports;

    // Create a new module and add to cache
    const module = { exports: {} };
    require.cache[moduleId] = module;

    // If module doesn't exist, throw error
    if (!modules[moduleId]) {
      throw new Error("Module not found: " + moduleId);
    }

    // Execute the module function
    modules[moduleId](module, module.exports, require);

    // Return the exports object
    return module.exports;
  }

  // Module cache object
  require.cache = {};

`.trim() + '\n\n';
    }
}

/**
 * Print CLI usage information
 */
function printUsage() {
    console.log('\nUsage:');
    console.log('  node bundler.js [config-file]\n');
    console.log('Arguments:');
    console.log('  config-file  Path to config file (optional, defaults to ./bundler.config.js)\n');
    console.log('Example:');
    console.log('  node bundler.js');
    console.log('  node bundler.js my-config.js\n');
}

/**
 * Load bundler configuration file
 */
function loadConfig(configPath) {
    const defaultConfigPath = 'bundler.config.js';
    const configFile = configPath || defaultConfigPath;
    const absoluteConfigPath = path.resolve(process.cwd(), configFile);

    try {
        if (!fs.existsSync(absoluteConfigPath)) {
            throw new Error(`Config file not found: ${configFile}`);
        }
        return require(absoluteConfigPath);
    } catch (error) {
        console.error('\n🚨 Error loading config file:');
        console.error(`   ${error.message}\n`);
        process.exit(1);
    }
}

/**
 * Main function to bundle a project
 */
async function bundleProject(configPath) {
    try {
        const config = loadConfig(configPath);

        // Create output directory if it doesn't exist
        const outputDir = path.dirname(config.output);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Create and run bundler
        const bundler = new SimpleBundler(config);
        await bundler.bundle(config.output);

        console.log(`\n✨ Bundle created successfully!`);
        console.log(`   Entry: ${path.relative(process.cwd(), config.entry)}`);
        console.log(`   Output: ${path.relative(process.cwd(), config.output)}\n`);
    } catch (error) {
        console.error('\n🚨 Bundling failed:');
        console.error(`   ${error.message}\n`);
        process.exit(1);
    }
}

// Handle command line arguments
if (require.main === module) {
    const args = process.argv.slice(2);

    // Show help if requested
    if (args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    const configPath = args[0];
    bundleProject(configPath);
}

module.exports = SimpleBundler;
