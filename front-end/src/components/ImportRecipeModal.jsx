import { useId, useState } from 'react'
import { recipeApi } from '../services/api'
import Modal from './Modal'
import './RecipeList.css'

/**
 * "Import Recipe": asks for a recipe page's URL, has the server read it, and passes the result to
 * `onImportSuccess` (the recipe form opens with it). Nothing is saved yet.
 */
function ImportRecipeModal({ isOpen, onClose, onImportSuccess }) {
  const titleId = useId()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return

    try {
      setLoading(true)
      setError(null)
      const importedData = await recipeApi.importRecipeFromUrl(url)
      setUrl('')
      onClose()
      onImportSuccess(importedData)
    } catch (err) {
      // The server explains 422 (no recipe found on the page) and 502 (the site couldn't be read).
      setError(err.message || 'Failed to import recipe from URL')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setUrl('')
    setError(null)
    onClose()
  }

  return (
    <Modal className="modal-content" labelledBy={titleId} closeDisabled={loading} onClose={handleClose}>
      <h2 id={titleId}>Import Recipe from URL</h2>
      <p>Paste a recipe website link below to parse ingredients and instructions.</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="url"
            aria-label="Recipe URL"
            placeholder="https://example.com/recipe"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        {error && <div className="error-message" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={handleClose} disabled={loading}>Cancel</button>
          <button type="submit" disabled={loading || !url.trim()}>
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ImportRecipeModal
