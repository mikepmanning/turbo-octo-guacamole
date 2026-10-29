import React, { useState } from 'react'
import { recipeApi } from '../services/api'
import './RecipeList.css'

function ImportRecipeModal({ isOpen, onClose, onImportSuccess }) {
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
      // Call your backend import endpoint
      const importedData = await recipeApi.importRecipeFromUrl(url)
      
      // Reset state, close modal, and pass data to parent
      setUrl('')
      onClose()
      onImportSuccess(importedData)
    } catch (err) {
      // Map HTTP 422 / 502 error messages from backend
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

  return React.createElement('div', { className: 'modal-overlay', onClick: handleClose },
    React.createElement('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
      React.createElement('h2', null, 'Import Recipe from URL'),
      React.createElement('p', null, 'Paste a recipe website link below to parse ingredients and instructions.'),
      React.createElement('form', { onSubmit: handleSubmit },
        React.createElement('div', { className: 'form-group' },
          React.createElement('input', {
            type: 'url',
            placeholder: 'https://example.com/recipe',
            value: url,
            onChange: (e) => setUrl(e.target.value),
            required: true,
            disabled: loading
          })
        ),
        error && React.createElement('div', { className: 'error-message' }, error),
        React.createElement('div', { className: 'modal-actions' },
          React.createElement('button', { type: 'button', onClick: handleClose, disabled: loading }, 'Cancel'),
          React.createElement('button', { type: 'submit', disabled: loading || !url.trim() },
            loading ? 'Importing...' : 'Import'
          )
        )
      )
    )
  )
}

export default ImportRecipeModal