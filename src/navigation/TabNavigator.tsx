import React, { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { TabBar } from '@components/common/TabBar';
import { DashboardScreen } from '@screens/DashboardScreen';
import { VehiclesScreen } from '@screens/VehiclesScreen';
import { DriversScreen } from '@screens/DriversScreen';
import { BookingsScreen } from '@screens/BookingsScreen';
import { MenuScreen } from '@screens/MenuScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/** `.tabs` in the mock — Home / Vehicles / Drivers / Bookings / Menu. */
export const TabNavigator: React.FC = () => {
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => <TabBar {...props} unreadCount={12} />,
    [],
  );

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, lazy: true }}
      tabBar={renderTabBar}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Vehicles"
        component={VehiclesScreen}
        options={{ tabBarLabel: 'Vehicles' }}
      />
      <Tab.Screen
        name="Drivers"
        component={DriversScreen}
        options={{ tabBarLabel: 'Drivers' }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{ tabBarLabel: 'Bookings' }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{ tabBarLabel: 'Menu' }}
      />
    </Tab.Navigator>
  );
};
