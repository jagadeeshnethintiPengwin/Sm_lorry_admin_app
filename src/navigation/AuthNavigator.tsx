import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SplashScreen } from '@screens/SplashScreen';
import { LoginScreen } from '@screens/LoginScreen';
import { OtpVerificationScreen } from '@screens/OtpVerificationScreen';
import type { AuthStackParamList } from './types';

/*
 * No PIN routes.
 *
 * Signing in is the registered number and a code sent to it, so there is no
 * PIN to forget or reset and nothing navigates to either screen. The screen
 * files are left in place — restoring the flow is re-registering them here and
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
    <Stack.Screen
      name="OtpVerification"
      component={OtpVerificationScreen}
      options={{ animation: 'slide_from_right' }}
    />
  </Stack.Navigator>
);
