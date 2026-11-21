import { formatDay, mealLabel, planDates } from './mealPlan'
import './MealPlan.css'

/**
 * A meal plan as a table: a row per day, a column per meal. `renderSlot(date, mealType)` draws
 * each cell, so the editor and the saved-plan page can share the layout. On narrow screens
 * each day becomes a card with its meals stacked.
 */
function MealPlanGrid({ caption, startDate, days, mealTypes, renderSlot }) {
  return (
    <table className="meal-plan-grid">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col"><span className="visually-hidden">Day</span></th>
          {mealTypes.map(mealType => (
            <th scope="col" key={mealType}>{mealLabel(mealType)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {planDates(startDate, days).map(date => (
          <tr key={date}>
            <th scope="row">{formatDay(date)}</th>
            {mealTypes.map(mealType => (
              <td key={mealType} data-meal={mealLabel(mealType)}>{renderSlot(date, mealType)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default MealPlanGrid
