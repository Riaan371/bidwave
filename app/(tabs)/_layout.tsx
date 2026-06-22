import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '../../lib/theme';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.35 }}>{icon}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { backgroundColor: Colors.navy, borderTopColor: '#1B2B4B', borderTopWidth: 1 },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index"     options={{ title: 'Home',      tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} /> }} />
      <Tabs.Screen name="search"    options={{ title: 'Search',    tabBarIcon: ({ focused }) => <TabIcon icon="🔍" focused={focused} /> }} />
      <Tabs.Screen name="watchlist" options={{ title: 'Watchlist', tabBarIcon: ({ focused }) => <TabIcon icon="⭐" focused={focused} /> }} />
      <Tabs.Screen name="my-bids"   options={{ title: 'My Bids',   tabBarIcon: ({ focused }) => <TabIcon icon="💰" focused={focused} /> }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profile',   tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} /> }} />
    </Tabs>
  );
}
