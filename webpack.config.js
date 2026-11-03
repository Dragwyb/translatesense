const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  ...defaultConfig,
  entry: {
    dashboard: path.resolve(__dirname, 'src/dashboard/index.jsx'),
    bulk: path.resolve(__dirname, 'src/bulk/index.jsx'),
    page: path.resolve(__dirname, 'src/page/index.jsx'),
  },
  output: {
    ...defaultConfig.output,
    path: path.resolve(__dirname, 'assets/build'),
    filename: '[name]/index.js',
  },
  plugins: [
    ...defaultConfig.plugins.filter(
      (plugin) => !(plugin instanceof MiniCssExtractPlugin)
    ),
    new MiniCssExtractPlugin({
      filename: '[name]/index.css',
    }),
  ],
};

