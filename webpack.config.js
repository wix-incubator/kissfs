const path = require('path');
const glob = require("glob");
const NODE_MODULES_PATH = path.resolve(__dirname, 'node_modules');
const polyfills = ['core-js/es6/array', 'core-js/es6/number', 'core-js/es6/promise', 'core-js/es6/symbol'];
const testsSetup = `mocha-loader!${path.join(__dirname, 'test', 'setup.ts')}`;
const universalTestFiles = glob.sync(path.join(__dirname, 'test', '**', '*.spec.ts?(x)'));
// const browserTestFiles = glob.sync(path.join(__dirname, 'test', '**', '*.spec.browser.ts?(x)'));

module.exports = {
    mode: 'development',
    devtool: 'source-map',
    context: __dirname,
    entry: {
        test: [...polyfills, testsSetup, ...universalTestFiles]
    },
    module: {
        rules: [
            {
                test: /\.ts[x]?$/,
                loader: 'ts-loader',
                exclude : NODE_MODULES_PATH,
                options: {
                    compilerOptions: {
                        declaration: false,
                        declarationMap: false
                    }
                }
            },
            {
                test: /\.js$/,
                loader: 'ts-loader',
                include: [
                    path.dirname(require.resolve('chai-as-promised/package.json')),
                    path.dirname(require.resolve('cbor/package.json'))
                ],
                options: {
                    // needed so it has a separate transpilation instance
                    instance: 'lib-compat',
                    transpileOnly: true
                }
            }
        ],
        noParse: /\.min\.js$/
    },
    output: {
        filename: '[name].bundle.js',
        libraryTarget: 'umd',
        library: '[name]'
    },
    resolve: {
        extensions: ['.ts', '.js', '.json']
    }
};
