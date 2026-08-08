/**
 * SMT Simhadri Transport — Owner / Admin App
 *
 * React Native CLI conversion of `admin-mobile-app.html`.
 *
 * @format
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RootNavigator } from '@navigation/RootNavigator';
import { ThemeProvider } from '@theme/ThemeProvider';
import { store } from '@store/index';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <GestureHandlerRootView style={styles.root}>
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ReduxProvider>
  </GestureHandlerRootView>
);

const styles = StyleSheet.create({ root: { flex: 1 } });

export default App;
