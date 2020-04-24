module.exports = {
  webpack: function(config, env) {
    config.module.rules = config.module.rules.map(rule => {
      if (rule.oneOf) {
        rule.oneOf.unshift({
          test: /\.ya?ml$/,
          use: [
            {
              loader: "@friends-of-js/yaml-loader",
              options: { useNodeEnv: false }
            }
          ]
        });
      }
      return rule;
    });

    return config;
  },
  jest: function(config) {
    config.roots = ["<rootDir>/tests"];
    config.testMatch = [
      "<rootDir>/tests/**/__tests__/**/*.{js,jsx,ts,tsx}",
      "<rootDir>/tests/**/*.{spec,test}.{js,jsx,ts,tsx}"
    ];
    return config;
  }
};
