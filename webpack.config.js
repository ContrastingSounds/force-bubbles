const path = require('path');

module.exports = {
  entry: './src/force-bubbles.js',
  output: {
    filename: 'force-bubbles.js',
    path: path.resolve(__dirname),
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