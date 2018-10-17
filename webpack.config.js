const path = require('path');
const glob = require('glob');

module.exports = {
    context: __dirname,
    mode: 'development',
    devtool: 'source-map',
    entry: {
        test: [
            `mocha-loader!${path.join(__dirname, 'test', 'setup.ts')}`,
            ...glob.sync(path.join(__dirname, 'test', '**', '*.spec.ts'))
        ]
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: '@ts-tools/webpack-loader',
                exclude : path.join(__dirname, 'node_modules')
            }
        ],
        noParse: /\.min\.js$/
    },
    resolve: {
        extensions: ['.ts', '.js', '.json']
    }
};
