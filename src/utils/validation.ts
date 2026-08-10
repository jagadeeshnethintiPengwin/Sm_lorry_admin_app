/**
 * Field rules for the forms that write to the fleet.
 *
 * These deliberately mirror the DTOs the API validates with
 * (`modules/vehicles/dto.ts`, `modules/drivers/dto.ts`) rather than inventing
 * a second, looser standard. The API is the authority — a client check that
 * disagrees with it either lets through something the server then rejects with
 * a message nobody wrote for a human, or blocks something the server would
 * have accepted.
 *
 * The point of having them here as well is *where* the operator finds out: on
 * the field they typed, as they leave it, instead of after a round trip that
 * reports one error at a time.
 */

export type Errors<T> = Partial<Record<keyof T, string>>;

/**
 * The two plate formats on Indian roads — the ordinary one and the newer
 * Bharat series. Kept in step with `common/registration.ts` on the API.
 */
const PLATE_ORDINARY = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;
const PLATE_BHARAT = /^\d{2}BH\d{4}[A-Z]{1,2}$/;

/** Indian mobile numbers are ten digits and never start below 6. */
const MOBILE_NATIONAL = /^[6-9]\d{9}$/;

/** Two letters for the issuing state, then alphanumerics. */
const LICENCE = /^[A-Z]{2}[A-Z0-9]{6,18}$/;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Letters, spaces and the punctuation names actually carry. */
const NAME = /^[\p{L}][\p{L}\s.'-]*$/u;

/** `AP 31 XX 1234` and `ap-31-xx-1234` are the same plate; this is its shape. */
export const packRegistration = (raw: string): string =>
  raw.replace(/[\s-]/g, '').toUpperCase();

/** The ten national digits, from whatever the operator typed. */
export const packMobile = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/** Licence numbers are quoted with spaces and dashes; the store keeps neither. */
export const packLicence = (raw: string): string =>
  raw.replace(/[\s-]/g, '').toUpperCase();

/**
 * The oldest and newest year of manufacture worth accepting.
 *
 * Next year rather than "any year": dealers do register the coming model year,
 * but a lorry built in 2087 is a typo, and it used to be allowed straight
 * through into the fleet's age report.
 */
export const OLDEST_VEHICLE_YEAR = 1980;
export const newestVehicleYear = (): number => new Date().getFullYear() + 1;

// -------------------------------------------------------------- validators
// Each returns the reason it was rejected, or `undefined` when it is fine —
// so a caller can assign the result straight into an errors object and test
// the object for emptiness at the end.

export const validateRegistration = (raw: string): string | undefined => {
  const plate = packRegistration(raw);
  if (!plate) {
    return 'Enter the registration number';
  }
  return PLATE_ORDINARY.test(plate) || PLATE_BHARAT.test(plate)
    ? undefined
    : 'Not a valid plate — e.g. AP 31 XX 1234';
};

export const validateMobile = (raw: string): string | undefined => {
  const national = packMobile(raw);
  if (!national) {
    return 'Enter the mobile number';
  }
  if (national.length !== 10) {
    return 'A mobile number is 10 digits';
  }
  return MOBILE_NATIONAL.test(national)
    ? undefined
    : 'Indian numbers start with 6, 7, 8 or 9';
};

export const validateLicence = (raw: string): string | undefined => {
  const licence = packLicence(raw);
  if (!licence) {
    return 'Enter the licence number';
  }
  return LICENCE.test(licence) ? undefined : 'Not a valid licence number';
};

export const validateName = (raw: string): string | undefined => {
  const name = raw.trim();
  if (name.length < 2) {
    return 'Enter the full name';
  }
  if (name.length > 80) {
    return 'That name is too long';
  }
  return NAME.test(name) ? undefined : 'Name cannot contain digits or symbols';
};

/** Optional: an empty box is fine, a malformed one is not. */
export const validateEmail = (raw: string): string | undefined => {
  const email = raw.trim();
  if (!email) {
    return undefined;
  }
  return EMAIL.test(email) ? undefined : 'Enter a valid email address';
};

export const validateYear = (raw: string): string | undefined => {
  if (!raw.trim()) {
    return 'Enter the year';
  }
  const year = Number(raw);
  if (!Number.isInteger(year)) {
    return 'Enter a four-digit year';
  }
  if (year < OLDEST_VEHICLE_YEAR) {
    return `Year must be ${OLDEST_VEHICLE_YEAR} or later`;
  }
  return year > newestVehicleYear()
    ? `Year cannot be after ${newestVehicleYear()}`
    : undefined;
};

/**
 * Capacity in tonnes, as a positive number.
 *
 * Stored as text (`7 Ton`) because that is what the fleet screens render, but
 * what the operator types into a numeric field still has to be a number.
 */
export const validateCapacity = (raw: string): string | undefined => {
  if (!raw.trim()) {
    return 'Enter the capacity';
  }
  const tons = Number(raw);
  if (!Number.isFinite(tons) || tons <= 0) {
    return 'Capacity must be a number above zero';
  }
  return tons > 100 ? 'That capacity looks too high' : undefined;
};

/** A required free-text box, with the label used in its complaint. */
export const validateRequired =
  (what: string) =>
  (raw: string): string | undefined =>
    raw.trim() ? undefined : `Enter the ${what}`;

/**
 * A date that has to be in the future.
 *
 * Used for licence expiry, where the whole point of collecting the date is to
 * refuse a driver whose licence has already run out — the roster was happy to
 * take one, and nothing downstream checked again.
 */
export const validateFutureDate =
  (what: string) =>
  (iso: string): string | undefined => {
    if (!iso) {
      return `Enter the ${what}`;
    }
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) {
      return `Enter a valid ${what}`;
    }
    // Compared at day resolution: a licence that expires today is still valid
    // today, and comparing against `now` would reject it from mid-morning.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return when < today ? `That ${what} has already passed` : undefined;
  };

/** A date that cannot be in the future, e.g. a date of birth or issue date. */
export const validatePastDate =
  (what: string) =>
  (iso: string): string | undefined => {
    if (!iso) {
      return undefined;
    }
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) {
      return `Enter a valid ${what}`;
    }
    return when > new Date() ? `That ${what} is in the future` : undefined;
  };

/** True when nothing was rejected. */
export const isClean = <T>(errors: Errors<T>): boolean =>
  Object.values(errors).every(message => !message);
