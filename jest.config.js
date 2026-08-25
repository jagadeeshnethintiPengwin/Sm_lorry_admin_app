module.exports = {
  preset: '@react-native/jest-preset',
  /*
   * Transform the ESM packages the tests actually load.
   *
   * The RN preset ignores all of node_modules except react-native itself, but
   * Redux Toolkit and its dependency `immer` ship ES-module builds that Jest's
   * CommonJS runtime chokes on ("Unexpected token 'export'"). Whitelisting them
   * here lets babel-jest down-level them, so a reducer test can import the slice.
   */
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|redux|reselect|redux-thunk)/)',
  ],
};
