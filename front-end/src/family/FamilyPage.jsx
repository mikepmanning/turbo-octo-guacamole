import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { familyApi } from '../services/api'
import { useAuth } from '../auth/authContext'
import ConfirmDialog from '../components/ConfirmDialog'
import FormField from '../auth/FormField'
import { formatInviteCode, fullName, ownerOf } from './familyFormat'
import '../auth/Auth.css'
import './Family.css'

/**
 * /family: create or join a family, or manage yours. Everyone sees the members; the owner also
 * renames the family, shares, replaces or revokes the invite code, removes members, hands over
 * ownership and deletes the family. Members can leave.
 */
export default function FamilyPage() {
  const [family, setFamily] = useState(undefined) // undefined while loading, null when not in one
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [attempt, setAttempt] = useState(0) // Retry loads again

  useEffect(() => {
    let cancelled = false
    familyApi.getMyFamily().then(
      loaded => { if (!cancelled) setFamily(loaded) },
      err => { if (!cancelled) setLoadError(err.message) }
    )
    return () => { cancelled = true }
  }, [attempt])

  const retry = () => {
    setLoadError(null)
    setAttempt(n => n + 1)
  }

  // After create/join/leave/delete: the new family (or null) and what happened.
  const showFamily = (next, message) => {
    setFamily(next)
    setNotice(message ?? null)
  }

  return (
    <div className="family-page">
      <Link to="/" className="account-back">← Back to recipes</Link>
      {loadError ? (
        <div className="family-load-error">
          <h1>Family</h1>
          <p className="auth-error" role="alert">{loadError}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      ) : family === undefined ? (
        <>
          <h1>Family</h1>
          <p>Loading your family...</p>
        </>
      ) : family === null ? (
        <NoFamily notice={notice} onJoined={showFamily} />
      ) : (
        <FamilyManager family={family} notice={notice} onChange={showFamily} />
      )}
    </div>
  )
}

// --- Not in a family: create one or join with a code ----------------------------------------

function NoFamily({ notice, onJoined }) {
  return (
    <>
      <h1>Family</h1>
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      <p className="family-intro">
        Create a family and share its invite code, or join someone else's family with their code.
      </p>
      <OneFieldForm
        heading="Create a family"
        name="familyName"
        label="Family name"
        placeholder="e.g. The Smiths"
        maxLength={100}
        submitLabel="Create family"
        busyLabel="Creating..."
        validate={value => (value.trim() ? null : 'Family name is required')}
        send={value => familyApi.createFamily(value.trim())}
        errorField="name"
        onDone={family => onJoined(family, `“${family.name}” was created. Share the invite code below to invite others.`)}
      />
      <OneFieldForm
        heading="Join a family"
        name="inviteCode"
        label="Invite code"
        placeholder="ABCD-2345"
        autoComplete="off"
        submitLabel="Join family"
        busyLabel="Joining..."
        validate={value => (value.trim() ? null : 'Invite code is required')}
        send={value => familyApi.joinFamily(value.trim())}
        errorField="code"
        onDone={family => onJoined(family, `You joined “${family.name}”.`)}
      />
    </>
  )
}

// A card with one field and a button (create, join, rename).
function OneFieldForm({
  heading, name, label, submitLabel, busyLabel, validate, send, errorField, onDone, initial = '',
  onCancel, ...inputProps
}) {
  const [value, setValue] = useState(initial)
  const [fieldError, setFieldError] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    const problem = validate(value)
    setFieldError(problem)
    if (problem) return
    setBusy(true)
    try {
      const result = await send(value)
      setBusy(false)
      onDone(result)
    } catch (err) {
      setBusy(false)
      if (err.fieldErrors?.[errorField]) setFieldError(err.fieldErrors[errorField])
      else setError(err.message)
    }
  }

  const headingId = `${name}-heading`
  return (
    <section className="auth-card account-section" aria-labelledby={heading ? headingId : undefined}>
      {heading && <h2 id={headingId}>{heading}</h2>}
      <form onSubmit={submit} className="auth-form" noValidate>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <FormField
          name={name}
          label={label}
          value={value}
          onChange={e => { setValue(e.target.value); setFieldError(null) }}
          error={fieldError}
          {...inputProps}
        />
        <div className="family-form-actions">
          <button type="submit" className="auth-submit" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
          {onCancel && <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>}
        </div>
      </form>
    </section>
  )
}

// --- In a family -------------------------------------------------------------------------------

function FamilyManager({ family, notice, onChange }) {
  const { user } = useAuth()
  const isOwner = family.myRole === 'OWNER'
  const [renaming, setRenaming] = useState(false)
  const [confirm, setConfirm] = useState(null) // { title, message, confirmLabel, busyLabel, run }
  const [busy, setBusy] = useState(false)
  const [confirmError, setConfirmError] = useState(null)
  const [actionError, setActionError] = useState(null)

  // Ask first; `run` returns the new family (or null) and the notice to show.
  const ask = (dialog) => {
    setConfirmError(null)
    setActionError(null)
    setConfirm(dialog)
  }

  const confirmed = async () => {
    setBusy(true)
    setConfirmError(null)
    try {
      const [next, message] = await confirm.run()
      setConfirm(null)
      onChange(next, message)
    } catch (err) {
      setConfirmError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // For actions that don't need asking (a new code when there is none).
  const run = async (action, message) => {
    setActionError(null)
    try {
      onChange(await action(), message)
    } catch (err) {
      setActionError(err.message)
    }
  }

  const others = family.members.length - 1
  const owner = ownerOf(family)

  return (
    <>
      {renaming ? (
        <OneFieldForm
          name="familyName"
          label="Family name"
          initial={family.name}
          maxLength={100}
          autoFocus
          submitLabel="Save name"
          busyLabel="Saving..."
          validate={value => (value.trim() ? null : 'Family name is required')}
          send={value => familyApi.renameFamily(value.trim())}
          errorField="name"
          onDone={next => { setRenaming(false); onChange(next, 'The family name was saved.') }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <div className="family-title">
          <h1>{family.name}</h1>
          {isOwner && <button type="button" onClick={() => setRenaming(true)}>Rename</button>}
        </div>
      )}

      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {actionError && <p className="auth-error" role="alert">{actionError}</p>}

      {isOwner ? (
        <InviteCode
          family={family}
          onNewCode={() => (family.inviteCode
            ? ask({
                title: 'Create a new invite code?',
                message: `The current code, ${formatInviteCode(family.inviteCode)}, will stop working. Anyone who hasn't joined yet will need the new one.`,
                confirmLabel: 'Create new code',
                busyLabel: 'Creating...',
                run: async () => [await familyApi.newInviteCode(), 'There is a new invite code. The old one no longer works.'],
              })
            : run(familyApi.newInviteCode, 'There is a new invite code.'))}
          onRevoke={() => ask({
            title: 'Revoke the invite code?',
            message: `Nobody will be able to join with ${formatInviteCode(family.inviteCode)}. People already in the family stay in it.`,
            confirmLabel: 'Revoke code',
            busyLabel: 'Revoking...',
            run: async () => [await familyApi.revokeInviteCode(), 'The invite code was revoked. Nobody can join until you create a new one.'],
          })}
        />
      ) : (
        <p className="family-intro">
          To invite someone, ask {owner ? fullName(owner) : 'the owner'} for the family's invite code.
        </p>
      )}

      <section className="auth-card account-section" aria-labelledby="members-heading">
        <h2 id="members-heading">Members ({family.members.length})</h2>
        <ul className="family-members">
          {family.members.map(member => {
            const isMe = member.userId === user?.id
            return (
              <li key={member.userId} className="family-member">
                <div className="family-member-info">
                  <span className="family-member-name">
                    {fullName(member)}{isMe && ' (you)'}
                    {member.role === 'OWNER' && <span className="family-badge">Owner</span>}
                  </span>
                  <span className="family-member-email">{member.email}</span>
                </div>
                {isOwner && !isMe && (
                  <div className="family-member-actions">
                    <button
                      type="button"
                      aria-label={`Make ${fullName(member)} the owner`}
                      onClick={() => ask({
                        title: `Make ${fullName(member)} the owner?`,
                        message: `${member.firstName} will manage the family and its invite code. You will become a member.`,
                        confirmLabel: 'Make owner',
                        busyLabel: 'Changing...',
                        run: async () => [await familyApi.makeOwner(member.userId), `${fullName(member)} is now the owner.`],
                      })}
                    >
                      Make owner
                    </button>
                    <button
                      type="button"
                      className="family-danger"
                      aria-label={`Remove ${fullName(member)}`}
                      onClick={() => ask({
                        title: `Remove ${fullName(member)}?`,
                        message: `${member.firstName} will no longer be in “${family.name}”. They can join again with an invite code.`,
                        confirmLabel: 'Remove',
                        busyLabel: 'Removing...',
                        run: async () => [await familyApi.removeMember(member.userId), `${fullName(member)} was removed from the family.`],
                      })}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <div className="family-leave">
        {isOwner && others > 0 && (
          <p className="family-intro">To leave the family, make someone else the owner first.</p>
        )}
        {(!isOwner || others === 0) && (
          <button
            type="button"
            className="family-danger"
            onClick={() => ask({
              title: 'Leave this family?',
              message: isOwner
                ? `You are the only member, so “${family.name}” will be deleted.`
                : `You will no longer be in “${family.name}”. You can join again with an invite code.`,
              confirmLabel: 'Leave family',
              busyLabel: 'Leaving...',
              run: async () => {
                await familyApi.leaveFamily()
                return [null, `You left “${family.name}”.`]
              },
            })}
          >
            Leave family
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            className="family-danger"
            onClick={() => ask({
              title: 'Delete this family?',
              message: others > 0
                ? `“${family.name}” will be deleted and its ${others === 1 ? 'other member' : `${others} other members`} removed from it. This can't be undone.`
                : `“${family.name}” will be deleted. This can't be undone.`,
              confirmLabel: 'Delete family',
              busyLabel: 'Deleting...',
              run: async () => {
                await familyApi.deleteFamily()
                return [null, `“${family.name}” was deleted.`]
              },
            })}
          >
            Delete family
          </button>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          busyLabel={confirm.busyLabel}
          busy={busy}
          error={confirmError}
          onConfirm={confirmed}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  )
}

// The owner's invite code card: show and copy it, replace it, or revoke it.
function InviteCode({ family, onNewCode, onRevoke }) {
  const [copied, setCopied] = useState(false)
  const code = formatInviteCode(family.inviteCode)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="auth-card account-section" aria-labelledby="invite-heading">
      <h2 id="invite-heading">Invite code</h2>
      {family.inviteCode ? (
        <>
          <p className="family-intro">
            Share this code with people you want in the family. Anyone with it can join until you revoke it.
          </p>
          <div className="family-code-row">
            <code className="family-code" aria-label="Current invite code">{code}</code>
            <button type="button" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
          <div className="family-form-actions">
            <button type="button" onClick={onNewCode}>New code</button>
            <button type="button" className="family-danger" onClick={onRevoke}>Revoke code</button>
          </div>
        </>
      ) : (
        <>
          <p className="family-intro">There's no invite code right now, so nobody can join.</p>
          <button type="button" className="auth-submit" onClick={onNewCode}>Create invite code</button>
        </>
      )}
    </section>
  )
}
