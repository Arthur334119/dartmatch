# Kneipenfinder

Expo/React-Native-App für Berliner Kneipen — Karte, Bewertungen, Check-ins, Community-Posts.

## Stack

- Expo SDK 54 + Expo Router (TypeScript)
- Supabase (Auth, Postgres, Storage, RLS)
- `react-native-maps` mit OpenStreetMap-Tiles
- `expo-image-picker`, `expo-location`, `expo-secure-store`

## Loslegen

```bash
npm install
npx expo run:ios --device   # Native Build aufs iPhone (USB)
# oder
npx expo run:android
```

`react-native-maps` braucht Native-Code, daher kein Expo Go — `expo run:ios/android` ist nötig.

## Struktur

- `app/` — Expo-Router-Routen (Auth-Gate, Tabs, Bar-Detail, Post-Create)
- `components/` — `BarCard`, `PostCard`, `StarRow`
- `lib/` — Supabase-Client, Auth-Helpers, Data-Layer, Konstanten
- `supabase/migrations/` — DB-Schema + RLS-Policies

## Migrations

```bash
supabase db push
```
