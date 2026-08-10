import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SplashScreen } from '@screens/SplashScreen';
import { LoginScreen } from '@screens/LoginScreen';
import { OtpVerificationScreen } from '@screens/OtpVerificationScreen';
import { ForgotPinScreen } from '@screens/ForgotPinScreen';
import { ResetPinScreen } from '@screens/ResetPinScreen';
import type { AuthStackParamList } from './types';

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
    <Stack.Screen
      name="ForgotPin"
      component={ForgotPinScreen}
      options={{ animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="ResetPin"
      component={ResetPinScreen}
      options={{ animation: 'slide_from_right' }}
    />
  </Stack.Navigator>
);
