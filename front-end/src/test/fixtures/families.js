// Families as GET /api/family returns them, seen by Ada (user 1).

export const ada = { id: 1, email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1990-12-10' }

const adaMember = {
  userId: 1, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', role: 'OWNER', joinedAt: '2026-11-01T10:00:00',
}
const graceMember = {
  userId: 2, firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', role: 'MEMBER', joinedAt: '2026-11-02T10:00:00',
}

// Ada owns the family; Grace is a member.
export const ownedFamily = {
  id: 7,
  name: 'The Lovelaces',
  myRole: 'OWNER',
  inviteCode: 'ABCD2345',
  inviteCodeCreatedAt: '2026-11-01T10:00:00',
  createdAt: '2026-11-01T10:00:00',
  members: [adaMember, graceMember],
}

// Ada is the only member.
export const soloFamily = { ...ownedFamily, members: [adaMember] }

// Grace owns the family; Ada is a member (so no invite code is sent).
export const memberFamily = {
  ...ownedFamily,
  myRole: 'MEMBER',
  inviteCode: null,
  inviteCodeCreatedAt: null,
  members: [{ ...graceMember, role: 'OWNER' }, { ...adaMember, role: 'MEMBER' }],
}
