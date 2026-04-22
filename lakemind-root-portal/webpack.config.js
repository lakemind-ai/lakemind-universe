const { merge } = require("webpack-merge");
const singleSpaDefaults = require("webpack-config-single-spa-ts");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const dotenv = require("dotenv");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const appEnv = process.env.ROOT_APP_ENV || "development";
const dotenvPath = `.env.${appEnv}`;
const envFromFile = dotenv.config({ path: dotenvPath });
console.log("envFromFile--", envFromFile);

module.exports = (webpackConfigEnv, argv) => {
  const orgName = "lakemind";
  const defaultConfig = singleSpaDefaults({
    orgName,
    projectName: "root-config",
    webpackConfigEnv,
    argv,
    disableHtmlGeneration: true,
  });

  return merge(defaultConfig, {
    plugins: [
      new webpack.DefinePlugin({
        "process.env": {
          ROOT_APP_ENV: JSON.stringify(appEnv),
          REACT_APP_ENV: JSON.stringify(appEnv),
          API_SERVICE_URL: JSON.stringify(process.env.API_SERVICE_URL),
          DATABRICKS_HOST: JSON.stringify(process.env.DATABRICKS_HOST),
          AUTH_PROVIDER: JSON.stringify(process.env.AUTH_PROVIDER || "databricks"),
          GENERATE_SOURCEMAP: process.env.ROOT_APP_ENV === "local",
        },
      }),
      new HtmlWebpackPlugin({
        inject: false,
        template: "src/index.ejs",
        templateParameters: {
          isLocal: webpackConfigEnv && webpackConfigEnv.isLocal,
          orgName,
        },
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "public", to: "" },
        ],
      }),
    ],
  });
};
