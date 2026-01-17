'use client'

import { useEffect, useState } from "react"
import { Info, X, KeyRound } from "lucide-react"

export function InfoPanel() {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const shouldShow = localStorage.getItem('prediction_game_show_help')
        if (shouldShow === '1') {
            setIsOpen(true)
            localStorage.removeItem('prediction_game_show_help')
        }

        const handleShowHelp = () => {
            setIsOpen(true)
            localStorage.removeItem('prediction_game_show_help')
        }

        window.addEventListener('prediction-game-show-help', handleShowHelp)
        return () => {
            window.removeEventListener('prediction-game-show-help', handleShowHelp)
        }
    }, [])

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white/90 border border-stone-200 text-stone-600 shadow-sm hover:bg-stone-100"
                aria-label="How this works"
            >
                <Info className="w-4 h-4" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-stone-900/20 backdrop-blur-sm animate-in fade-in overflow-auto">
                    <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-3xl p-6 md:p-8 space-y-6 shadow-2xl relative">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-800"
                            aria-label="Close help"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <h3 className="text-2xl font-bold text-stone-800">How This Game Works</h3>
                        </div>

                        <div className="space-y-4 text-[16px] text-stone-700">
                            <div className="space-y-2">
                                <p>
                                    This is a friendly family prediction game. Each year, everyone makes four predictions:
                                    one Highly Likely, one Likely, one Unlikely, and one Highly Unlikely. Be bold, but be specific:
                                    make sure your prediction is something that we can definitively judge as having happened or not
                                    happened by the end of the year. Once everyone in a family has entered their predictions, the
                                    family admin will switch the game mode from &quot;Forecasting&quot; to &quot;Betting&quot;. Here, everyone
                                    enters their bets about how likely they think each prediction is. Finally, at the end of the year,
                                    we tally up the results based on what actually did or didn't happen, and the winner wins a wooden
                                    spoon (or similar)!
                                </p>
                            </div>
                            <div>
                                <div className="font-semibold text-stone-800">Forecasting</div>
                                <p>
                                    Each player writes 4 predictions, one per likelihood category.
                                    Predictions auto-save as you type.
                                </p>
                                <div className="mt-3 space-y-2">
                                    <div className="font-semibold text-stone-800">What makes a good prediction?</div>
                                    <p>
                                        A good prediction is one that is specific and verifiable. Make sure that we will be able to
                                        mark your prediction at the end of the year as either having happened or not having happened.
                                        For instance, a good prediction might be something like:
                                    </p>
                                </div>
                                <ExampleCard title="Forecast Example">
                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold text-stone-600">Highly Likely</div>
                                        <div className="text-sm text-stone-800 bg-stone-50 rounded-lg p-2 border border-stone-200">
                                            “US wins at least 4 gold medals at the Winter Olympics.”
                                        </div>
                                        <div className="text-xs font-semibold text-stone-600">Highly Unlikely</div>
                                        <div className="text-sm text-stone-800 bg-stone-50 rounded-lg p-2 border border-stone-200">
                                            “JD Vance becomes president.”
                                        </div>
                                    </div>
                                </ExampleCard>
                                <div className="mt-3 text-sm text-stone-700">And a bad prediction might be something like:</div>
                                <ExampleCard title="Bad Example">
                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold text-stone-600">Highly Likely</div>
                                        <div className="text-sm text-stone-800 bg-rose-50 rounded-lg p-2 border border-rose-200">
                                            “The country goes to hell in a handbasket this year.”
                                        </div>
                                        <div className="text-xs font-semibold text-stone-600">Highly Unlikely</div>
                                        <div className="text-sm text-stone-800 bg-rose-50 rounded-lg p-2 border border-rose-200">
                                            “Matt Damon loses his edge and becomes a has been.”
                                        </div>
                                    </div>
                                </ExampleCard>
                            </div>
                            <div>
                                <div className="font-semibold text-stone-800">Betting</div>
                                <p>
                                    Everyone rates how likely each prediction is (0–100%).
                                    Bets auto-save and can be adjusted anytime before results.
                                </p>
                                <ExampleCard title="Bet Example">
                                    <div className="space-y-2">
                                        <div className="text-xs text-stone-500">Prediction: “US wins at least 4 gold medals at the Winter Olympics.”</div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-stone-400">0%</span>
                                            <div className="flex-1 h-2 rounded-full bg-stone-200 relative">
                                                <div className="absolute left-[75%] -top-1 w-4 h-4 rounded-full bg-stone-800" />
                                            </div>
                                            <span className="text-xs text-stone-400">100%</span>
                                        </div>
                                        <div className="text-sm text-stone-700">Your bet: 75%</div>
                                    </div>
                                </ExampleCard>
                            </div>
                            <div>
                                <div className="font-semibold text-stone-800">Results & Scoring</div>
                                <p>
                                    When an event happens, score = bet − 50.
                                    When it doesn’t, score = 50 − bet.
                                    Scores add up across all predictions.
                                </p>
                                <ExampleCard title="Scoring Example">
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
                                            Bet 80% and it happened → +30 points
                                        </div>
                                        <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
                                            Bet 20% and it happened → -30 points
                                        </div>
                                    </div>
                                </ExampleCard>
                            </div>
                            <div>
                                <div className="font-semibold text-stone-800">Stats & Insights</div>
                                <p>
                                    View bullishness vs. points, prediction variability, and category trends.
                                    Use the stats tab for deeper comparisons.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 text-sm text-stone-700">
                            <div className="font-semibold text-stone-800">Admin Actions</div>
                            <div className="space-y-2">
                                <div className="font-semibold text-stone-700">Family Admin Code required</div>
                                <ul className="list-disc list-inside text-stone-600 space-y-1">
                                    <li>Create a new year</li>
                                    <li>Change the game phase for your family</li>
                                    <li className="flex items-center gap-2">
                                        <KeyRound className="w-4 h-4 text-stone-500" />
                                        Change your family PIN (requires current family PIN)
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2">
                                <div className="font-semibold text-stone-700">Master Admin Code required</div>
                                <ul className="list-disc list-inside text-stone-600 space-y-1">
                                    <li>Manage families and people</li>
                                    <li>Delete a year</li>
                                    <li>Merge people</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function ExampleCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mt-3 border border-dashed border-stone-200 rounded-2xl p-4 bg-white">
            {children}
        </div>
    )
}
