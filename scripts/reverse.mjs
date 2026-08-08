#!/usr/bin/env node
/**
 * Makes `localhost:4000` on a USB-connected Android device mean *this*
 * machine, so the app reaches the API.
 *
 * `localhost` inside an app is the handset, not the laptop serving the API —
 * so a phone plugged in over USB gets "Could not reach the server" however
 * healthy the API is. The React Native CLI already does this for Metro on
 * 8081; nothing does it for the API, so it had to be remembered by hand every
 * time the cable came out.
 *
 * Wi-Fi instead of USB? Run `npm run point-apps` in the repo root to write the
 * machine's LAN address into every app's `.env`. That covers the API; Metro
 * still needs either this or `--host` set.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/*
 * Both ports the handset needs to reach this machine.
 *
 * 8081 is Metro. The React Native CLI sets that one up during `run-android`,
 * but not when Metro is started on its own or when a device is plugged in
 * afterwards — and a debug build that cannot reach Metro does not say so: it
 * quietly loads the bundle baked into the APK, which may be weeks old. That is
 * how a stale JS bundle ends up running against fresh native libraries and
 * reports itself as "mismatch between the JavaScript part and native part of
 * Worklets".
 *
 * 4000 is the API. Nothing sets that one up at all.
 */
const API_PORT = process.env.API_PORT ?? '4000';

/**
 * The port this app asks for, read from where the build gets it.
 *
 * `reactNativeDevServerPort` in `android/gradle.properties` is what the React
 * Native gradle plugin bakes into the app, so it is the only honest source for
 * what the handset will actually request. Reading it here instead of repeating
 * the number keeps the tunnel and the build from drifting apart.
 */
const DEVICE_METRO_PORT = (() => {
  try {
    const properties = readFileSync(
      new URL('../android/gradle.properties', import.meta.url),
      'utf8',
    );
    return properties.match(/^reactNativeDevServerPort=(\d+)/m)?.[1] ?? '8081';
  } catch {
    return '8081';
  }
})();

/**
 * The port *this* project's Metro is on.
 *
 * More than one React Native project open at once is normal, and only the
 * first to start gets 8081; the rest land on 8082, 8083 and so on. The app
 * always asks its device's 8081, so without this it reaches whichever project
 * happened to claim that port — and silently runs that app's JavaScript.
 *
 * That is not a hypothetical: this app was served a different project's bundle
 * and failed with "Mismatch between JavaScript part and native part of
 * Worklets (0.8.1 vs 0.11.3)" — two versions from two different `node_modules`
 * trees, which reads as a broken install rather than the wrong server.
 *
 * So the device's 8081 is pointed at whatever port this project's Metro is
 * actually on, found by matching the process's working directory to this one.
 */
async function metroPort() {
  const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
  const candidates = [];

  try {
    const listing = execFileSync('ps', ['-Ao', 'pid=,command='], { encoding: 'utf8' });
    for (const line of listing.split('\n')) {
      if (!/cli\.js start|react-native start/.test(line)) continue;
      const pid = line.trim().split(/\s+/)[0];

      // The command line names the project only when run from its own
      // node_modules; the working directory is the reliable signal.
      const cwd = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
        .split('\n')
        .find(l => l.startsWith('n'))
        ?.slice(1);

      if (cwd !== root) continue;
      // An explicit --port is the strongest signal. A process without one is
      // still a candidate, but only on the default and only if it answers —
      // several such processes exist while Metro is starting or shutting down.
      const declared = line.match(/--port[= ](\d+)/)?.[1];
      if (declared) candidates.unshift(declared);
      else candidates.push(DEVICE_METRO_PORT);
    }
  } catch {
    // No `ps`/`lsof` — fall through to probing the usual ports.
  }

  // Metro moves up a port at a time when one is taken, so a short sweep covers
  // the case where the process list told us nothing.
  for (let port = 8081; port <= 8090; port += 1) candidates.push(String(port));

  // What this app asks for is the first thing to try: with a port of its own
  // there is nothing to collide with, and the answer is usually right here.
  candidates.unshift(DEVICE_METRO_PORT);

  for (const port of [...new Set(candidates)]) {
    try {
      const response = await fetch(`http://localhost:${port}/status`, {
        signal: AbortSignal.timeout(1_500),
      });
      if ((await response.text()).includes('packager-status:running')) return port;
    } catch {
      // Not listening, or not Metro. Try the next.
    }
  }
  return DEVICE_METRO_PORT;
}

/** `adb` is not always on PATH; the SDK location is the usual fallback. */
function adb(args, { quiet = false } = {}) {
  const candidates = [
    'adb',
    `${process.env.ANDROID_HOME ?? ''}/platform-tools/adb`,
    `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`,
  ].filter(Boolean);

  let lastError;
  for (const bin of candidates) {
    try {
      return execFileSync(bin, args, { encoding: 'utf8', stdio: quiet ? 'pipe' : ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      lastError = error;
      // ENOENT means this candidate is not adb; anything else is adb failing.
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw lastError ?? new Error('adb not found');
}

try {
  const devices = adb(['devices'], { quiet: true })
    .split('\n')
    .slice(1)
    .filter(line => line.trim().endsWith('device'));

  if (devices.length === 0) {
    // Not an error: plenty of runs are iOS, or an emulator that has not booted.
    console.log('reverse: no Android device attached — skipping');
    process.exit(0);
  }

  const metro = await metroPort();

  adb(['reverse', `tcp:${API_PORT}`, `tcp:${API_PORT}`], { quiet: true });
  adb(['reverse', `tcp:${DEVICE_METRO_PORT}`, `tcp:${metro}`], { quiet: true });

  /*
   * 8081 as well, pointed at the same Metro.
   *
   * The port above is baked in at build time, so a copy of the app installed
   * before it was set still asks for 8081 — and would find either nothing or
   * another project's Metro. Mapping both means the build on the handset right
   * now and the next one both reach the right server, and the spare mapping
   * costs nothing once every build has caught up.
   */
  if (DEVICE_METRO_PORT !== '8081') {
    adb(['reverse', 'tcp:8081', `tcp:${metro}`], { quiet: true });
  }

  console.log(`reverse: API      device:${API_PORT} -> ${API_PORT}`);
  console.log(`reverse: Metro    device:${DEVICE_METRO_PORT} -> ${metro}`);
  if (DEVICE_METRO_PORT !== '8081') {
    console.log(`reverse: Metro    device:8081 -> ${metro}   (builds made before the port was set)`);

    /*
     * Say plainly that the 8081 mapping is shared.
     *
     * Every app built before `reactNativeDevServerPort` was set asks the
     * device for 8081, and a device has only one mapping for it — so whichever
     * app ran this last owns it, and the others silently receive *this*
     * project's bundle. That arrives as "Mismatch between JavaScript part and
     * native part of Worklets", which says nothing about the real cause.
     *
     * One `npm run android` per app bakes in its own port and ends the
     * sharing for good.
     */
    console.log('');
    console.log(`         Note: the device's 8081 now belongs to this app.`);
    console.log('         Other SM Lorry apps installed from an older build will');
    console.log(`         receive this project's bundle until they are rebuilt once:`);
    console.log('           npm run android      (in each app)');
  }
} catch (error) {
  // Never fail the build over this — the LAN address is a working alternative.
  console.log(`reverse: skipped (${error.message.split('\n')[0]})`);
}
