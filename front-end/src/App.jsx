import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RecipeList from './components/RecipeList'
import RecipeDetail from './components/RecipeDetail'
import RecipeForm from './components/RecipeForm'
import NewMealPlan from './components/NewMealPlan'
import MealPlanList from './components/MealPlanList'
import MealPlanView from './components/MealPlanView'
import AuthProvider from './auth/AuthProvider'
import RequireAuth from './auth/RequireAuth'
import LoginPage from './auth/LoginPage'
import RegisterPage from './auth/RegisterPage'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Everything else needs a login */}
          <Route element={<RequireAuth />}>
            <Route path="/" element={<RecipeList />} />
            <Route path="/recipe/new" element={<RecipeForm />} />
            <Route path="/recipe/:id" element={<RecipeDetail />} />
            <Route path="/meal-plan/new" element={<NewMealPlan />} />
            <Route path="/meal-plans" element={<MealPlanList />} />
            <Route path="/meal-plans/:id" element={<MealPlanView />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
