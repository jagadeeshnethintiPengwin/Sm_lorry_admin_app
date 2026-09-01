import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SplashScreen } from '@screens/SplashScreen';
import { LoginScreen } from '@screens/LoginScreen';
import type { AuthStackParamList } from './types';

/*
 * Email and password, like the web panel — no mobile number, no OTP, no PIN.
 *
 * Signing in is `LoginScreen`, which posts email + password to the same
 * endpoint the web admin uses. The old mobile-number/OTP screen
 * (`OtpVerificationScreen`) and the PIN screens are deliberately not registered
 * here, so there is no way to reach a "we texted you a code" flow. The files
 * are left on disk; restoring that flow would mean re-registering them and
 * putting the links back on `LoginScreen`.
 */
const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => (
  <Stack.Navigator
    initialRouteName="Splash"
    screenOptions={{ headerShown: false, animation: 'fade' }}
  >
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);
