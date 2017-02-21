var path = require('path');

var NODE_MODULES_PATH = path.resolve(__dirname, 'node_modules');

var loaders = {
    loaders: [
        {
            test: /\.ts[x]?$/,
            exclude : NODE_MODULES_PATH,
            loader: 'ts-loader?logLevel=warn' // &transpileOnly=true
        },
        {
            test: /autobahn\/package.json$/,
            loader: 'json-loader'
        }
    ],
    noParse: /\.min\.js$/
};

var resolve = {
    extensions: ["", ".webpack.js", ".web.js", ".js", ".ts", ".tsx"],
    alias: {
        'bluebird-retry': 'bluebird-retry/lib/bluebird-retry'
    }
};

var output = {
    path: __dirname + '/dist',
    filename: '[name].bundle.js',
    libraryTarget: 'umd',
    library: '[name]',
    pathinfo: true
};

module.exports = {
    context: __dirname,
    entry: {
        test: ['./test/browser'],
        webtest: ['mocha-loader!./test/browser']
    },
    devtool: 'eval',
    output: output,
    resolve: resolve,
    module: loaders
};
