import { Linking } from 'react-native';

/**
 * Hands a link to whatever on the phone can show it.
 *
 * Deliberately does *not* ask `Linking.canOpenURL` first.
 *
 * That check was the reason "Could not open it — no app on this phone can open
 * that file" appeared on handsets with a browser sitting on the home screen.
 * Since Android 11 an app only sees the other apps its manifest declares an
 * interest in, and `canOpenURL` answers from that filtered view: with no
 * `<queries>` element it reports `false` for every `http(s)` link regardless of
 * what is installed. These apps target SDK 36, so the filtering is fully in
 * force. The check is meant for custom schemes — `myapp://` — where the honest
 * answer is knowable; for a web address it only ever produces false negatives.
 *
 * `openURL` is asked to do the thing instead, and rejects if nothing handles
 * it. That rejection is the real answer, and it arrives from the OS rather
 * than from a guess made before trying.
 *
 * A `<queries>` element was added alongside this so intent resolution behaves,
 * but the code no longer depends on it being right.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (failure) {
    /*
     * Rethrown with wording a driver can act on. The platform message is
     * `No Activity found to handle Intent { act=android.intent.action.VIEW … }`,
     * which is accurate and useless on the roadside.
     */
    throw new Error(
      failure instanceof Error && /no activity|not supported/i.test(failure.message)
        ? 'Nothing on this phone can open this file. Installing a browser or a PDF viewer will fix it.'
        : 'That file could not be opened. Check your signal and try again.',
    );
  }
}
