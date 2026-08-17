/**
 * Values `react-native-dotenv` inlines from `.env` at build time.
 *
 * Every one is optional: the app carries a default for each, so a checkout
 * with no `.env` still runs.
 */
declare module '@env' {
  export const API_ORIGIN: string | undefined;
  /**
   * Whether `API_ORIGIN` is allowed to redirect the app off the deployed API.
   *
   * Separate from the address itself so that pointing somewhere local is a
   * deliberate act rather than a leftover: an `API_ORIGIN` nobody meant to still
   * be there cannot quietly send the app to a laptop.
   */
  export const USE_LOCAL_API: string | undefined;
}
