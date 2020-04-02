const path = require("path");
var WebpackBuildNotifierPlugin = require("webpack-build-notifier");

module.exports = {
    mode: "production",

    output: {
        path: path.resolve(__dirname, 'docs/dist'),
        filename: "main.js"
    },

    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",

    resolve: {
        extensions: [".ts", ".js"]
    },

    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "ts-loader",
                        options: {
                            projectReferences: true
                        }
                    }
                ]
            },
            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            {
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader"
            },

            // Handle CSS files.
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
        ]
    },

    optimization: {
        minimize: false
    },

    plugins: [
        new WebpackBuildNotifierPlugin({
            logo: path.resolve(__dirname, "docs/favicon.ico"),
            // List of sounds: https://github.com/mikaelbr/node-notifier
            successSound: "Pop",
            failureSound: "Basso",
            warningSound: "Basso",
            notifyOptions: {
                timeout: 1,
            },
        }),
    ],

    // Quiet warnings about code size:
    performance: {
        hints: false,
        maxEntrypointSize: 1024*1024,
        maxAssetSize: 1024*1024,
    },
};