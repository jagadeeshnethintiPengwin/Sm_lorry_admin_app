import type { AxiosRequestConfig } from 'axios';

import { apiClient } from './api.client';

/**
 * Deleting the signed-in account — the in-app route the App Store and Play
 * both require.
 *
 * Three steps, each its own endpoint: read what deleting would do (and
 * whether anything stops it), send a code to the account's own number, then
 * spend that code on the deletion itself. A deletion is never one tap.
 */

/** `GET /account/deletion` — what deleting would do, before anything is asked. */
export type AccountDeletionInfo = {
  canDelete: boolean;
  /** Sentences, shown as written — e.g. being the only owner on the account. */
  blockers: string[];
  /** Masked, for "We'll send a code to …". */
  mobile: string;
  removes: string[];
  keeps: string[];
};

/** `POST /account/deletion/code` */
export type AccountDeletionCode = {
  verificationId: string;
  /** Seconds until another code may be asked for. */
  resendIn: number;
  mobile: string;
  /** Returned by a development API only, so the code can be typed without SMS. */
  devCode?: string;
};

/** `POST /account/deletion` */
export type AccountDeletionResult = {
  deleted: true;
  erased: boolean;
};

/**
 * Keeps a 401 from the deletion itself as the answer it is.
 *
 * The client treats any 401 as an expired access token: it renews the session
 * and replays the request once. Here a 401 means the *code* was wrong or
 * stale, so a replay would spend a second attempt on the same wrong digits —
 * two strikes towards "Too many attempts" for every mistake. Marking the
 * request as already retried lets that 401 through untouched; `confirm`
 * renews a genuinely stale token beforehand instead.
 */
const NO_REPLAY = { retried: true } as AxiosRequestConfig;

export const accountService = {
  /** GET /account/deletion */
  async deletionInfo(): Promise<AccountDeletionInfo> {
    const { data } = await apiClient.get<AccountDeletionInfo>(
      '/account/deletion',
    );
    return data;
  },

  /** POST /account/deletion/code — a code to the account's own number. */
  async sendDeletionCode(): Promise<AccountDeletionCode> {
    const { data } = await apiClient.post<AccountDeletionCode>(
      '/account/deletion/code',
    );
    return data;
  },

  /**
   * POST /account/deletion — the point of no return.
   *
   * Preceded by a fresh read of the deletion summary. It costs one request and
   * buys two things: an access token that expired while the code was being
   * typed is renewed by an ordinary call (the deletion itself will not replay —
   * see `NO_REPLAY`), and a blocker that appeared in the meantime is reported
   * in its own words rather than as a failed code.
   *
   * Every token for the account is revoked by the server on success.
   */
  async deleteAccount(payload: {
    code: string;
    verificationId: string;
    reason?: string;
  }): Promise<AccountDeletionResult> {
    const info = await accountService.deletionInfo();
    if (!info.canDelete) {
      throw new Error(
        info.blockers[0] ?? 'This account cannot be deleted right now.',
      );
    }
    const { data } = await apiClient.post<AccountDeletionResult>(
      '/account/deletion',
      payload,
      NO_REPLAY,
    );
    return data;
  },
};
