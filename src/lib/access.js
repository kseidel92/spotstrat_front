const DESK_STATES = new Set(['trial', 'paper', 'pro', 'active']);

export function deskAllowed(user) {
  return !!user && DESK_STATES.has(user.desk);
}
