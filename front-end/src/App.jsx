import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RecipeList from './components/RecipeList'
import RecipeDetail from './components/RecipeDetail'
import RecipeForm from './components/RecipeForm'
import NewMealPlan from './components/NewMealPlan'
import MealPlanList from './components/MealPlanList'
import MealPlanView from './components/MealPlanView'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RecipeList />} />
        <Route path="/recipe/new" element={<RecipeForm />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/meal-plan/new" element={<NewMealPlan />} />
        <Route path="/meal-plans" element={<MealPlanList />} />
        <Route path="/meal-plans/:id" element={<MealPlanView />} />
      </Routes>
    </Router>
  )
}

export default App
