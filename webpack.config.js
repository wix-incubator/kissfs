const path = require('path');

const NODE_MODULES_PATH = path.resolve(__dirname, 'node_modules');
const polyfills = ['core-js/es6/symbol', 'core-js/es6/number', 'core-js/es6/promise'];

module.exports = {
    context: __dirname,
    entry: {
        test: polyfills.concat(['./test/browser']),
        webtest: polyfills.concat(['mocha-loader!./test/browser'])
    },
    devtool: 'eval',
    module: {
        rules: [
            {
                test: /\.ts[x]?$/,
                loader: 'ts-loader',
                exclude : NODE_MODULES_PATH,
                options: {
                    compilerOptions: {
                        'declaration': false
                    }
                }
            },        
            {
                test: /\.js$/,
                include: [
                    path.resolve(__dirname, 'node_modules/chai-as-promised'),
                    path.resolve(__dirname, 'node_modules/cbor')
                ],
                loader: 'ts-loader',
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
        path: __dirname + '/dist',
        filename: '[name].bundle.js',
        libraryTarget: 'umd',
        library: '[name]',
        pathinfo: true
    },
    resolve: {
        extensions: ['.ts', '.js']
    }
};
