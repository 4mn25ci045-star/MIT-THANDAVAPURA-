import type { CapacitorConfig } from '@capacitor/cli';
// Hosted evaluation shell only. SSR and server functions remain on the approved HTTPS host.
// Capacitor server.url is not a production bundled-assets distribution strategy.
const config: CapacitorConfig = {
 appId: 'in.mitthandavapura.bustracker',
 appName: 'MIT Thandavapura',
 webDir: 'android-shell',
 server: { url: 'https://route-ranger-safe.lovable.app', cleartext: false },
 android: { allowMixedContent: false },
};
export default config;
