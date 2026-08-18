import ShellPage from './ShellPage';

/**
 * Deliveries: approved domain (docs/02 §37-40, AT-033/071-074) whose exact
 * state machine, dispatch link and proof-of-delivery are NOT_YET_DEFINED.
 * Drivers see assigned deliveries only — none exist until dispatch exists.
 */
export default function DeliveriesPage({
  role,
}: {
  role: 'super_admin' | 'school_admin' | 'driver';
}) {
  const scope =
    role === 'driver'
      ? 'assigned deliveries only. Dispatch/delivery state machine is NOT_YET_DEFINED — no deliveries can exist until it is approved.'
      : 'delivery records must derive from dispatch, which derives from prepared production. Both state machines are NOT_YET_DEFINED.';
  return <ShellPage title={role === 'driver' ? 'My deliveries' : 'Deliveries'} scope={scope} />;
}
