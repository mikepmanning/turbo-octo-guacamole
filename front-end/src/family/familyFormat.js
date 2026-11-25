// "ABCD2345" -> "ABCD-2345", easier to read out and type. The server accepts either.
export const formatInviteCode = (code) =>
  code && code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code ?? ''

export const fullName = (member) => `${member.firstName} ${member.lastName}`

// The family's owner (there is always exactly one).
export const ownerOf = (family) => family.members.find(m => m.role === 'OWNER')
