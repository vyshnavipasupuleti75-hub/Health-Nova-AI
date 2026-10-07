import Logo from './Logo';

// Shown only while a refreshed internal route waits for the saved session check. It uses the app's own
// theme background (no intro), and the mark fades in after a short delay so fast restores show nothing.
export default function RouteLoader() {
  return <div className="route-loader" role="status" aria-label="Loading HealthNova"><Logo compact /></div>;
}
