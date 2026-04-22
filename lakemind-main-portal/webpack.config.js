const { mergeWithRules } = require("webpack-merge");
const singleSpaDefaults = require("webpack-config-single-spa-react-ts");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const path = require("path");

const appEnv = process.env.REACT_APP_ENV || "development";

const optimisation =
  appEnv !== "local"
    ? {
        minimize: true,
        minimizer: [
          new TerserPlugin({
            parallel: true,
          }),
        ],
      }
    : {};

module.exports = (webpackConfigEnv, argv) => {
  const defaultConfig = singleSpaDefaults({
    orgName: "lakemind",
    projectName: "main",
    webpackConfigEnv,
    argv,
  });

  const config = mergeWithRules({
    module: {
      rules: {
        test: "match",
        use: "replace",
      },
    },
  })(defaultConfig, {
    externals: [
      "@emotion/react",
      "history",
      "react-router-dom",
      "react-toastify",
    ],
    plugins: [
      new webpack.DefinePlugin({
        "process.env": {
          REACT_APP_ENV: JSON.stringify(appEnv),
        },
      }),
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
      extensions: [".js", ".jsx", ".ts", ".tsx", ".json", ".mjs", ".svg"],
    },
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [
            require.resolve("style-loader", {
              paths: [require.resolve("webpack-config-single-spa")],
            }),
            require.resolve("css-loader", {
              paths: [require.resolve("webpack-config-single-spa")],
            }),
            "postcss-loader",
          ],
        },
        {
          test: /\.svg$/,
          use: ["@svgr/webpack"],
          issuer: /\.(js|ts)x?$/,
          type: "javascript/auto",
        },
      ],
    },
    devtool: appEnv === "local" ? "source-map" : false,
    optimization: optimisation,
  });

  return config;
};
