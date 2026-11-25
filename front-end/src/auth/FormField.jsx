/**
 * A labelled input with its error under it, for the account forms. The error sits outside the
 * <label> so it isn't part of the field's accessible name; aria-describedby ties them together.
 */
export default function FormField({ name, label, value, onChange, error, ...inputProps }) {
  return (
    <div className="auth-field">
      <label>
        {label}
        <input
          name={name}
          value={value}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          {...inputProps}
        />
      </label>
      {error && <span id={`${name}-error`} className="field-error">{error}</span>}
    </div>
  )
}
