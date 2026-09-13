'use client'

import { useState } from 'react'
import { brierScore, formatScore } from '@/utils/scoring'

export function BrierExplanation() {
    const [probability, setProbability] = useState(80)

    return (
        <div className="space-y-3 text-sm text-stone-600">
            <p>
                Brier scoring rewards accurate probabilities. For each resolved event, we square the
                difference between your probability (as a decimal) and the outcome (1 for happened,
                0 for didn’t). Your final score is the average. <strong>Lower is better.</strong>
            </p>
            <p className="font-mono rounded-lg bg-stone-100 p-3 text-stone-800">Brier score = average of (probability − outcome)²</p>
            <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
                <label className="block font-semibold text-stone-800">
                    Try a bet: {probability}%
                    <input aria-label="Example probability" type="range" min="0" max="100" step="1" value={probability}
                        onChange={event => setProbability(Number(event.target.value))}
                        className="block w-full mt-3 accent-stone-800" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-green-50 p-3">If it happens<strong className="block font-mono text-lg text-stone-800">{formatScore(brierScore(probability, true))}</strong></div>
                    <div className="rounded-lg bg-rose-50 p-3">If it doesn’t<strong className="block font-mono text-lg text-stone-800">{formatScore(brierScore(probability, false))}</strong></div>
                </div>
                <p className="text-xs">0 = perfect · 0.25 = always betting 50% · 1 = certain and wrong every time.</p>
            </div>
            <p>
                Why change? The old rules reward exaggeration: if you believe an event has a 60% chance,
                betting 100% earns 10 expected points, versus 2 for honestly betting 60%. With Brier,
                betting 60% has expected error 0.24, versus 0.40 for betting 100%. Your honest probability
                gives you the best expected score.
            </p>
            <p>
                Every resolved prediction has equal weight. Unresolved events are excluded. Untouched
                bets count as 50%, so skipping a question does not remove it from your average. Submit at
                least one bet to join the standings; players with no submitted bets stay unranked. Ties share a rank.
            </p>
            <p>
                This rewards honesty when optimizing your expected score. A single winner’s prize can
                still encourage tactical bets to overtake another player.
            </p>
            <a className="underline underline-offset-2" href="https://confluence.ecmwf.int/spaces/FUG/pages/673551875/Section%2B12.B%2BStatistical%2BConcepts%2B-%2BProbabilistic%2BData" target="_blank" rel="noreferrer">Read ECMWF’s explanation of probability scoring</a>
        </div>
    )
}
