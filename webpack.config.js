const path = require('path');

module.exports = {
  entry: {
    "force-bubbles": './src/plugins/force-bubbles/force-bubbles.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      }
    ]
  }
};