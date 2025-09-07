'use strict';

const { merge } = require('webpack-merge');
const CopyPlugin = require('copy-webpack-plugin');

const common = require('./webpack.common.js');
const PATHS = require('./paths');

// Merge webpack configuration files
const config = (env, argv) =>
  merge(common, {
    entry: {
      popup: PATHS.src + '/popup.js',
      background: PATHS.src + '/background.js',
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: PATHS.src + '/popup.html', to: 'popup.html' },
        ],
      }),
    ],
    devtool: argv.mode === 'production' ? false : 'source-map',
  });

module.exports = config;
