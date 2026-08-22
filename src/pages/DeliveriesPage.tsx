import ShellPage from './ShellPage';
import { useRole } from '../lib/auth';

/**
 * Deliveries. The dispatch link, delivery states and proof of handover are not
 * built. Drivers see assigned deliveries only — and none can exist until
 * dispatch does.
 *
 * Reads the signed-in role via useRole(): three different roles reach this
 * page and each must see its own scope, not whichever role happened to be
 * hardcoded at the call site.
 */
export default function DeliveriesPage() {
  const role = useRole();
  const scope =
    role === 'driver'
      ? 'the deliveries assigned to you. Deliveries cannot exist until dispatch is built, so there is nothing to show yet.'
      : 'delivery records, which must come from dispatch, which in turn comes from prepared production. Neither is built yet.';
  return <ShellPage title={role === 'driver' ? 'My deliveries' : 'Deliveries'} scope={scope} />;
}
