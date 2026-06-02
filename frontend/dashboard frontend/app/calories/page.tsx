"use client"

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle, Flame, Search, Sparkles, Trash2 } from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

type FoodSearchResult = {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingQty: number;
  servingUnit: string;
  photo?: string | null;
};

export default function CaloriesPage() {
  const {
    data,
    loading,
    error,
    searchFood,
    logFood,
    removeFood,
    setCalorieGoal
  } = useDashboard();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");
  const [goalInput, setGoalInput] = useState(data.dailyCalorieGoal.toString());
  const [goalMessage, setGoalMessage] = useState<string | null>(null);
  const [goalAnimation, setGoalAnimation] = useState(false);

  useEffect(() => {
    setGoalInput(data.dailyCalorieGoal.toString());
  }, [data.dailyCalorieGoal]);

  const totalCalories = useMemo(
    () => data.calorieLog.reduce((sum, item) => sum + Number(item.calories), 0),
    [data.calorieLog]
  );

  const progressPercent = Math.min(
    Math.round((totalCalories / Math.max(data.dailyCalorieGoal, 1)) * 100),
    100
  );

  useEffect(() => {
    if (goalMessage) {
      setGoalAnimation(true);
      const timer = window.setTimeout(() => {
        setGoalAnimation(false);
        setGoalMessage(null);
      }, 3800);
      return () => window.clearTimeout(timer);
    }
  }, [goalMessage]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setSearchError("Enter a food item to search.");
      return;
    }

    setSearchError(null);
    setSearchLoading(true);
    try {
      const results = await searchFood(query.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No food data found for this query.");
      }
    } catch (err) {
      setSearchError("Could not search foods right now.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddFood = async (food: {
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  }) => {
    try {
      const result = await logFood({
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        timestamp: new Date().toISOString()
      });

      if (result.goalMet) {
        setGoalMessage("Goal hit! +50 XP awarded.");
      }
    } catch (err) {
      setSearchError("Could not add food right now.");
    }
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const calories = Number(manualCalories);
    if (!manualName.trim() || !calories || Number.isNaN(calories)) {
      setSearchError("Please enter a valid food name and calories.");
      return;
    }

    try {
      const result = await logFood({
        name: manualName.trim(),
        calories,
        protein: Number(manualProtein) || 0,
        carbs: Number(manualCarbs) || 0,
        fat: Number(manualFat) || 0,
        timestamp: new Date().toISOString()
      });

      setManualName("");
      setManualCalories("");
      setManualProtein("");
      setManualCarbs("");
      setManualFat("");
      setSearchResults([]);
      setQuery("");

      if (result.goalMet) {
        setGoalMessage("Goal hit! +50 XP awarded.");
      }
    } catch (err) {
      setSearchError("Could not log this food entry.");
    }
  };

  const handleGoalSave = async () => {
    const goalValue = Number(goalInput);
    if (!goalValue || Number.isNaN(goalValue)) {
      setSearchError("Enter a valid calorie goal.");
      return;
    }

    try {
      await setCalorieGoal(goalValue);
      setGoalMessage("Daily calorie goal updated.");
    } catch (err) {
      setSearchError("Could not update calorie goal.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-green-300">Calorie Tracker</p>
            <h1 className="text-3xl font-semibold text-white">Today&apos;s food log</h1>
            <p className="mt-2 text-gray-400 max-w-2xl">
              Search Nutritionix server-side, log meals, and track progress toward your daily calorie goal.
            </p>
          </div>
          <div className="inline-flex gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300">
              <Flame className="h-4 w-4 text-amber-400" /> {totalCalories} kcal consumed
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Search foods</h2>
                  <p className="text-sm text-gray-400">Find nutrition details from Nutritionix without exposing the API key.</p>
                </div>
                <Search className="h-5 w-5 text-green-400" />
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search food descriptions like 'banana', 'grilled chicken', or 'oatmeal'"
                  className="min-w-0 flex-1 rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-100 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-500/20"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {searchLoading ? 'Searching…' : 'Search'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {searchError ? (
                <p className="mt-4 text-sm text-rose-300">{searchError}</p>
              ) : null}

              {searchResults.length > 0 ? (
                <div className="mt-6 space-y-3">
                  {searchResults.map(result => (
                    <div key={result.id} className="rounded-2xl border border-gray-700 bg-gray-950 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-400">{result.brand || 'Nutritionix result'}</p>
                          <h3 className="text-lg font-semibold text-white">{result.name}</h3>
                          <p className="text-sm text-gray-400">{result.servingQty} {result.servingUnit}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-gray-800 px-3 py-2 text-sm text-gray-200">
                            {result.calories.toFixed(0)} kcal
                          </div>
                          <button
                            onClick={() => handleAddFood(result)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Manual entry</h2>
                  <p className="text-sm text-gray-400">Quick add a food item with calories and macronutrients.</p>
                </div>
                <Sparkles className="h-5 w-5 text-cyan-400" />
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleManualSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-gray-300">
                    <span>Name</span>
                    <input
                      value={manualName}
                      onChange={(event) => setManualName(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-100 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/20"
                    />
                  </label>
                  <label className="block text-sm text-gray-300">
                    <span>Calories</span>
                    <input
                      value={manualCalories}
                      onChange={(event) => setManualCalories(event.target.value)}
                      type="number"
                      min="0"
                      className="mt-2 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-100 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/20"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm text-gray-300">
                    <span>Protein</span>
                    <input
                      value={manualProtein}
                      onChange={(event) => setManualProtein(event.target.value)}
                      type="number"
                      min="0"
                      className="mt-2 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-100 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/20"
                    />
                  </label>
                  <label className="block text-sm text-gray-300">
                    <span>Carbs</span>
                    <input
                      value={manualCarbs}
                      onChange={(event) => setManualCarbs(event.target.value)}
                      type="number"
                      min="0"
                      className="mt-2 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-100 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/20"
                    />
                  </label>
                  <label className="block text-sm text-gray-300">
                    <span>Fat</span>
                    <input
                      value={manualFat}
                      onChange={(event) => setManualFat(event.target.value)}
                      type="number"
                      min="0"
                      className="mt-2 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-100 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/20"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
                >
                  Log food
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Daily target</h2>
                  <p className="text-sm text-gray-400">Update your calorie goal anytime.</p>
                </div>
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-3xl bg-gray-950 p-4">
                  <div className="flex items-center justify-between gap-4 text-sm text-gray-300">
                    <span>Goal</span>
                    <span>{data.dailyCalorieGoal.toLocaleString()} kcal</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>{progressPercent}% of goal</span>
                    <span>{Math.max(data.dailyCalorieGoal - totalCalories, 0)} kcal left</span>
                  </div>
                </div>

                <div className="grid gap-3">
                  <label className="block text-sm text-gray-300">
                    <span>New daily goal</span>
                    <input
                      value={goalInput}
                      onChange={(event) => setGoalInput(event.target.value)}
                      type="number"
                      min="0"
                      className="mt-2 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-100 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleGoalSave}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                  >
                    Save goal
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Today&apos;s entries</h2>
                  <p className="text-sm text-gray-400">Remove items as needed.</p>
                </div>
                <span className="inline-flex rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                  {data.calorieLog.length} entries
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {data.calorieLog.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-950 p-6 text-center text-sm text-gray-400">
                    No logged foods yet. Add your first meal.
                  </div>
                ) : (
                  data.calorieLog.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-4 rounded-3xl border border-gray-700 bg-gray-950 p-4">
                      <div>
                        <p className="text-sm text-gray-400">{new Date(entry.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <h3 className="text-base font-semibold text-white">{entry.food_name}</h3>
                        <p className="text-sm text-gray-400">{entry.calories.toFixed(0)} kcal · {entry.protein.toFixed(0)}g protein</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFood(entry.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-300 transition hover:bg-gray-700"
                        aria-label="Remove food"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>

        {goalMessage ? (
          <div className={`rounded-3xl border border-green-500 bg-emerald-500/10 p-5 text-sm text-green-100 transition-transform duration-300 ${goalAnimation ? 'scale-100' : 'scale-95 opacity-90'}`}>
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-green-200" />
              <div>
                <p className="font-semibold">{goalMessage}</p>
                <p className="text-gray-200">Keep logging to stay on track.</p>
              </div>
            </div>
          </div>
        ) : null}

        {(loading || error) && (
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 text-sm text-gray-300">
            {loading ? 'Loading calorie tracker...' : error}
          </div>
        )}
      </div>
    </div>
  );
}
