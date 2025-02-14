const fs = require('fs');
const path = require('path');

class SimpleBundler {
    constructor(config) {
        this.config = this.normalizeConfig(config);
        this.entryFile = this.config.entry;
        this.modules = new Map();
        this.moduleId = 0;

        // Load plugins from config
        this.plugins = this.config.plugins || [];
    }

    normalizeConfig(config) {
        return {
            entry: path.resolve(process.cwd(), config.entry),
            output: path.resolve(process.cwd(), config.output || 'dist/bundle.js'),
            plugins: config.plugins || [],
        };
    }

    // Apply plugins for each phase
    async applyPlugins(phase, content, moduleInfo = {}) {
        let result = content;
        for (const plugin of this.plugins) {
            if (plugin[phase]) {
                result = await plugin[phase](result, moduleInfo);
            }
        }
        return result;
    }

    // Read file and extract its dependencies
    readModule(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Find all imports, supports both default and named imports
        const importRegex = /import\s+(?:(\w+)\s*,\s*)?(?:{([^}]+)})?\s+from\s+['"]([^'"]+)['"]/g;
        const dependencies = [];
        const imports = [];

        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const [fullMatch, defaultImport, namedImports, dependencyPath] = match;
            dependencies.push(dependencyPath);
            imports.push({
                named: namedImports ? namedImports.split(',').map(item => item.trim()) : [],
                default: defaultImport || null,
                path: dependencyPath,
                originalText: fullMatch
            });
        }

        // Find all exports
        const namedExportRegex = /export\s+(const|let|var|function)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/g;
        const defaultExportRegex = /export\s+default\s+(?:(function\s+[a-zA-Z_$][0-9a-zA-Z_$]*|class\s+[a-zA-Z_$][0-9a-zA-Z_$]*|[a-zA-Z_$][0-9a-zA-Z_$]*)|(?:{[\s\S]*}|\([^)]*\)\s*=>|function\s*\([^)]*\)))/g;

        const exports = {
            named: [],
            default: null
        };

        // Find named exports
        while ((match = namedExportRegex.exec(content)) !== null) {
            exports.named.push(match[2]);
        }

        // Find default export
        while ((match = defaultExportRegex.exec(content)) !== null) {
            exports.default = match[1] || '_default_export_';
        }

        return {
            id: this.moduleId++,
            filePath,
            content,
            dependencies,
            imports,
            exports
        };
    }

    // Build the dependency graph
    buildDependencyGraph(entryFile) {
        const module = this.readModule(entryFile);
        this.modules.set(entryFile, module);

        module.dependencies.forEach(dependency => {
            const absolutePath = path.resolve(
                path.dirname(entryFile),
                dependency.endsWith('.js') ? dependency : dependency + '.js'
            );

            if (!this.modules.has(absolutePath)) {
                this.buildDependencyGraph(absolutePath);
            }
        });
    }

    // Transform module content: replace imports with requires and add exports
    async transformModuleContent(module) {
        let transformedContent = module.content;

        // Apply pre-transform plugins
        transformedContent = await this.applyPlugins('preTransform', transformedContent, module);

        // Replace imports with requires
        module.imports.forEach(({ named, default: defaultImport, path: importPath, originalText }) => {
            // Convert to relative path
            const absolutePath = path.resolve(
                path.dirname(module.filePath),
                importPath.endsWith('.js') ? importPath : importPath + '.js'
            );
            const relativePath = './' + path.relative(process.cwd(), absolutePath);

            let requireString = '';

            // Handle default import
            if (defaultImport) {
                requireString += `const ${defaultImport} = require("${relativePath}").default;\n`;
            }

            // Handle named imports
            if (named.length > 0) {
                const namedRequires = named
                    .map(item => {
                        const [originalName, alias] = item.split(/\s+as\s+/).map(s => s.trim());
                        if (alias) {
                            return `const ${alias} = require("${relativePath}").${originalName};`;
                        }
                        return `const ${originalName} = require("${relativePath}").${originalName};`;
                    })
                    .join('\n');
                requireString += namedRequires;
            }

            transformedContent = transformedContent.replace(originalText, requireString);
        });

        // Transform named exports
        const namedExportRegex = /export\s+(const|let|var|function)\s+/g;
        transformedContent = transformedContent.replace(namedExportRegex, '$1 ');

        // Transform default export - improved version
        const defaultExportRegex = /export\s+default\s+(?:(function\s+[a-zA-Z_$][0-9a-zA-Z_$]*|class\s+[a-zA-Z_$][0-9a-zA-Z_$]*|[a-zA-Z_$][0-9a-zA-Z_$]*)|(?:{[\s\S]*}|\([^)]*\)\s*=>|function\s*\([^)]*\)))/g;
        transformedContent = transformedContent.replace(defaultExportRegex, (match, identifier, inline) => {
            if (identifier) {
                // Named function, class, or variable
                return `exports.default = ${identifier}`;
            } else if (inline) {
                // Inline function or object
                return `exports.default = ${inline}`;
            }
            return 'exports.default = ';
        });

        // Add named exports to module.exports
        const exportStatements = module.exports.named
            .map(exp => `exports.${exp} = ${exp};`)
            .join('\n');

        transformedContent += '\n' + exportStatements;

        // Apply post-transform plugins
        transformedContent = await this.applyPlugins('postTransform', transformedContent, module);

        return transformedContent;
    }

    // Generate the final bundle
    async generateBundle() {
        let bundle = '';

        // Add the module wrapper with the custom require function
        bundle += '(function(modules) {\n';
        bundle += '  function require(moduleId) {\n';
        bundle += '    if (require.cache[moduleId]) return require.cache[moduleId].exports;\n';
        bundle += '    const module = { exports: {} };\n';
        bundle += '    require.cache[moduleId] = module;\n';
        bundle += '    if (!modules[moduleId]) {\n';
        bundle += '      throw new Error("Module not found: " + moduleId);\n';
        bundle += '    }\n';
        bundle += '    modules[moduleId](module, module.exports, require);\n';
        bundle += '    return module.exports;\n';
        bundle += '  }\n\n';
        bundle += '  require.cache = {};\n\n';

        // Define modules object
        bundle += '  var modules = {\n';

        // Transform all modules and wait for them to complete
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

        // Add all transformed modules to the bundle
        transformedModules.forEach(({ path, content }) => {
            bundle += `    "${path}": function(module, exports, require) {\n`;
            bundle += `      ${content}\n`;
            bundle += '    },\n';
        });

        bundle += '  };\n\n';

        // Start execution from the entry file using relative path
        const relativeEntryPath = './' + path.relative(process.cwd(), this.entryFile);
        bundle += `  require("${relativeEntryPath}");\n`;
        bundle += '})();\n';

        return bundle;
    }

    // Main bundle method
    async bundle(outputFile) {
        this.buildDependencyGraph(this.entryFile);
        const bundleContent = await this.generateBundle();

        // Apply final plugins (e.g. minification)
        const finalContent = await this.applyPlugins('bundle', bundleContent);

        if (outputFile) {
            fs.writeFileSync(outputFile, finalContent);
        }

        return finalContent;
    }
}

function printUsage() {
    console.log('\nUsage:');
    console.log('  node bundler.js [config-file]\n');
    console.log('Arguments:');
    console.log('  config-file  Path to config file (optional, defaults to ./bundler.config.js)\n');
    console.log('Example:');
    console.log('  node bundler.js');
    console.log('  node bundler.js my-config.js\n');
}

// Load config file and bundle project
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
