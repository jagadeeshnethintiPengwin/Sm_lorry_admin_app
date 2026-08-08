module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        // Resolve `root`/`alias` against THIS file's directory rather than
        // process.cwd(). Without it, running Metro from anywhere other than the
        // project root (e.g. Gradle invoking the bundler from android/) makes
        // '@hooks' resolve to '<cwd>/src/hooks' and every alias import fails.
        cwd: __dirname,
        root: ['./src'],
        extensions: [
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.json',
        ],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@navigation': './src/navigation',
          '@theme': './src/theme',
          '@assets': './src/assets',
          '@services': './src/services',
          '@store': './src/store',
          '@hooks': './src/hooks',
          '@utils': './src/utils',
          '@constants': './src/constants',
          '@apptypes': './src/types',
        },
      },
    ],
    // Reads .env into the `@env` module at build time. No native code, so a
    // change here needs a Metro restart with --reset-cache to take effect.
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        // The app has a built-in default for every value it reads, so a
        // missing .env is a fallback rather than a crash on first launch.
        allowUndefined: true,
      },
    ],
    // Reanimated 4 ships its Babel plugin from `react-native-worklets`.
    // It MUST stay last in the plugin list.
    'react-native-worklets/plugin',
  ],
};
