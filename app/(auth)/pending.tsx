import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/auth-store';

export default function Pending() {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <Text className="text-3xl mb-4">⏳</Text>
      <Text className="text-2xl font-bold text-ink mb-2 text-center">
        Application submitted
      </Text>
      <Text className="text-base text-ink/60 text-center mb-8">
        Our team reviews new auctioneer accounts within 24 hours. We&#x2019;ll notify you by
        email and push notification once you&#x2019;re approved and ready to publish your
        first lot.
      </Text>

      <Pressable
        onPress={() => router.replace('/(tabs)')}
        className="bg-primary rounded-2xl py-4 px-8 items-center mb-3"
      >
        <Text className="text-white font-bold text-base">Browse auctions meanwhile</Text>
      </Pressable>

      <Pressable onPress={signOut}>
        <Text className="text-ink/50 text-sm underline">Sign out</Text>
      </Pressable>
    </View>
  );
}
