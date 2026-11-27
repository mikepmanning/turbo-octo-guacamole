import { lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RecipeList from './components/RecipeList'
import AuthProvider from './auth/AuthProvider'
import RequireAuth from './auth/RequireAuth'
import LoginPage from './auth/LoginPage'
import RegisterPage from './auth/RegisterPage'
import NotFound from './components/NotFound'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

// The front page and the login pages are in the main bundle; the other pages download the first time they are
// opened (RequireAuth shows "Loading..." meanwhile), so the first visit loads less.
const RecipeDetail = lazy(() => import('./components/RecipeDetail'))
const RecipeForm = lazy(() => import('./components/RecipeForm'))
const NewMealPlan = lazy(() => import('./components/NewMealPlan'))
const MealPlanList = lazy(() => import('./components/MealPlanList'))
const MealPlanView = lazy(() => import('./components/MealPlanView'))
const ShoppingList = lazy(() => import('./components/ShoppingList'))
const ShoppingLists = lazy(() => import('./components/ShoppingLists'))
const AccountPage = lazy(() => import('./auth/AccountPage'))
const FamilyPage = lazy(() => import('./family/FamilyPage'))

function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Last resort (e.g. the login pages); RequireAuth has its own for the logged-in pages. */}
        <ErrorBoundary>
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
            <Route path="/meal-plans/:id/shopping-list" element={<ShoppingList />} />
            <Route path="/shopping-lists" element={<ShoppingLists />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/family" element={<FamilyPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  )
}

export default App
