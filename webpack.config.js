const path = require('path');

module.exports = {
  entry: './src/plugins/force-bubbles/force-bubbles.js',
  output: {
    filename: 'force-bubbles.js',
    path: path.resolve(__dirname, 'dist'),
  },
};