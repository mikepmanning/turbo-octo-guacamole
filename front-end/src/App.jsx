import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RecipeList from './components/RecipeList'
import RecipeDetail from './components/RecipeDetail'
import RecipeForm from './components/RecipeForm'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RecipeList />} />
        <Route path="/recipe/new" element={<RecipeForm />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
      </Routes>
    </Router>
  )
}

export default App
