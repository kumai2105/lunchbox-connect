import ShellPage from './ShellPage';
import { useRole } from '../lib/auth';

/**
 * Deliveries: approved domain (docs/02 §37-40, AT-033/071-074) whose exact
 * state machine, dispatch link and proof-of-delivery are NOT_YET_DEFINED.
 * Drivers see assigned deliveries only — none exist until dispatch exists.
 *
 * Reads the actual signed-in role via useRole() — reachable by three
 * different roles (docs/02 §49) and must render each one's own scope, not
 * whichever role happened to be hardcoded at the call site.
 */
export default function DeliveriesPage() {
  const role = useRole();
  const scope =
    role === 'driver'
      ? 'assigned deliveries only. Dispatch/delivery state machine is NOT_YET_DEFINED — no deliveries can exist until it is approved.'
      : 'delivery records must derive from dispatch, which derives from prepared production. Both state machines are NOT_YET_DEFINED.';
  return <ShellPage title={role === 'driver' ? 'My deliveries' : 'Deliveries'} scope={scope} />;
}
