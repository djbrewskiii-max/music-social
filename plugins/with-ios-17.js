
const { withPodfileProperties, withXcodeProject } = require('@expo/config-plugins');

const DEPLOYMENT_TARGET = '17.0';

module.exports = function withIos17(config) {
  config = withPodfileProperties(config, (config) => {
    config.modResults['ios.deploymentTarget'] = DEPLOYMENT_TARGET;
    return config;
  });

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const sections = project.pbxXCBuildConfigurationSection();

    for (const [key, entry] of Object.entries(sections)) {
      if (key.endsWith('_comment') || !entry || !entry.buildSettings) {
        continue;
      }

      if (entry.buildSettings.IPHONEOS_DEPLOYMENT_TARGET != null) {
        entry.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET;
      }
    }

    return config;
  });

  return config;
};
