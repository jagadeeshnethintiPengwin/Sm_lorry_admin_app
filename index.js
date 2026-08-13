/**
 * @format
 */

// `react-native-gesture-handler` must be the first import in the entry file.
import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

/*
 * Messages that arrive while the app is backgrounded or closed.
 *
 * Registered here, at module scope, and deliberately not inside a component:
 * when a notification arrives for a closed app there is no component tree —
 * React Native starts a headless JS context, looks for exactly this handler,
 * and gives up if it is not already registered by the time the entry file has
 * run.
 *
 * The tray notification itself is drawn by the system, not by this: the server
 * sends a `notification` payload, so Android posts it without waking
 * JavaScript at all. This exists for the work that goes with one — and it must
 * resolve, because an unhandled rejection here is reported as a crash in an
 * app the user never opened.
 */
setBackgroundMessageHandler(getMessaging(), async () => {
  // Nothing to do yet. The badge and the feed are read from the API when the
  // app next opens, so there is no state to reconcile in the background.
});

AppRegistry.registerComponent(appName, () => App);
