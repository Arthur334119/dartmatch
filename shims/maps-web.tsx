import { View, type ViewProps } from 'react-native';

// Web stub — react-native-maps is native only, so on the web build
// it resolves here. The web Map screen lives in app/(tabs)/index.web.tsx
// and never renders these, but they need to exist so the bundler can
// resolve the imports inside index.native.tsx without pulling in any
// native-only modules.

export default function MapView(props: ViewProps) {
  return <View {...props} />;
}

export function Marker(props: ViewProps) {
  return <View {...props} />;
}

export function UrlTile(props: ViewProps) {
  return <View {...props} />;
}

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
