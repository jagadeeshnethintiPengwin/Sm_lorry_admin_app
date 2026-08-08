/**
 * Values `react-native-dotenv` inlines from `.env` at build time.
 *
 * Every one is optional: the app carries a default for each, so a checkout
 * with no `.env` still runs.
 */
declare module '@env' {
  export const API_ORIGIN: string | undefined;
}
