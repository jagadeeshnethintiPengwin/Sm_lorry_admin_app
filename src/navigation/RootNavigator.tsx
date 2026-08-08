import React, { useMemo } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthNavigator } from './AuthNavigator';
import { TabNavigator } from './TabNavigator';
import { VehicleDetailsScreen } from '@screens/VehicleDetailsScreen';
import { AddVehicleScreen } from '@screens/AddVehicleScreen';
import { UploadDocumentScreen } from '@screens/UploadDocumentScreen';
import { DriverDetailsScreen } from '@screens/DriverDetailsScreen';
import { AddDriverScreen } from '@screens/AddDriverScreen';
import { CustomersScreen } from '@screens/CustomersScreen';
import { CustomerDetailsScreen } from '@screens/CustomerDetailsScreen';
import { AddCustomerScreen } from '@screens/AddCustomerScreen';
import { BookingReviewScreen } from '@screens/BookingReviewScreen';
import { TripsScreen } from '@screens/TripsScreen';
import { TripDetailsScreen } from '@screens/TripDetailsScreen';
import { TripTimelineScreen } from '@screens/TripTimelineScreen';
import { LiveTripTrackScreen } from '@screens/LiveTripTrackScreen';
import { LiveFleetMapScreen } from '@screens/LiveFleetMapScreen';
import { PodViewerScreen } from '@screens/PodViewerScreen';
import { DocumentsScreen } from '@screens/DocumentsScreen';
import { NotificationsScreen } from '@screens/NotificationsScreen';
import { BusinessDetailsScreen } from '@screens/BusinessDetailsScreen';
import { LogoutConfirmScreen } from '@screens/LogoutConfirmScreen';
import { useTheme } from '@theme/ThemeProvider';
import { palette } from '@theme/colors';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { colors, isDark } = useTheme();

  const navTheme = useMemo<Theme>(
    () => ({
      ...DefaultTheme,
      dark: isDark,
      colors: {
        ...DefaultTheme.colors,
        primary: palette.gold,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: palette.red,
      },
    }),
    [colors, isDark],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Auth"
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="Tabs"
          component={TabNavigator}
          options={{ animation: 'fade' }}
        />

        {/* Fleet */}
        <Stack.Screen name="VehicleDetails" component={VehicleDetailsScreen} />
        {/* A full screen in its own right, not a sheet — it pushes like every
            other detail screen so the back chevron reads consistently. */}
        <Stack.Screen name="AddVehicle" component={AddVehicleScreen} />
        <Stack.Screen name="UploadDocument" component={UploadDocumentScreen} />

        {/* People */}
        <Stack.Screen name="DriverDetails" component={DriverDetailsScreen} />
        <Stack.Screen
          name="AddDriver"
          component={AddDriverScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Customers" component={CustomersScreen} />
        <Stack.Screen name="CustomerDetails" component={CustomerDetailsScreen} />
        <Stack.Screen
          name="AddCustomer"
          component={AddCustomerScreen}
          options={{ animation: 'slide_from_bottom' }}
        />

        {/* Bookings & trips */}
        <Stack.Screen name="BookingReview" component={BookingReviewScreen} />
        <Stack.Screen name="Trips" component={TripsScreen} />
        <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
        <Stack.Screen name="TripTimeline" component={TripTimelineScreen} />
        <Stack.Screen name="LiveTripTrack" component={LiveTripTrackScreen} />
        <Stack.Screen name="LiveFleetMap" component={LiveFleetMapScreen} />
        <Stack.Screen name="PodViewer" component={PodViewerScreen} />

        {/* Account */}
        <Stack.Screen name="Documents" component={DocumentsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="BusinessDetails" component={BusinessDetailsScreen} />
        <Stack.Screen
          name="LogoutConfirm"
          component={LogoutConfirmScreen}
          options={{ animation: 'fade', presentation: 'transparentModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
