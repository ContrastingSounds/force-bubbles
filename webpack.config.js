const path = require('path');

module.exports = {
  entry: './src/force-bubbles-container.js',
  output: {
    filename: 'force-bubbles.js',
    path: path.resolve(__dirname),
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            "presets": [
              "@babel/preset-env", 
              "@babel/preset-react",
              {
                'plugins': [
                  "babel-plugin-styled-components",
                  "@babel/plugin-proposal-class-properties"
                ]
              }
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      }
    ]
  }
};