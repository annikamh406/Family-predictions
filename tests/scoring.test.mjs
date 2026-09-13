import assert from 'node:assert/strict'
import test from 'node:test'
import { brierScore, calculateStandings, canCompareLegacyScoring, forecastProbability, formatScore, rankStandings } from '../utils/scoring.ts'

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)
const prediction = (id, did_happen, username = 'Author') => ({ id, did_happen, user: { username } })
const bet = (prediction_id, probability, username = 'Player') => ({ prediction_id, probability, user: { username } })

test('binary Brier scores handle both outcomes, certainty, and 50% correctly', () => {
    for (const [probability, happened, expected] of [
        [100, true, 0], [0, false, 0], [100, false, 1], [0, true, 1],
        [50, true, .25], [50, false, .25], [80, true, .04], [80, false, .64],
        [20, true, .64], [20, false, .04], [75, true, .0625],
    ]) close(brierScore(probability, happened), expected)
})

test('unresolved outcomes are excluded and invalid probabilities never yield NaN standings', () => {
    assert.equal(brierScore(80, null), null)
    for (const value of [NaN, Infinity, -1, 101]) {
        assert.throws(() => brierScore(value, true), RangeError)
        assert.equal(forecastProbability(value), 50)
    }
    assert.equal(forecastProbability(undefined), 50)
    assert.equal(forecastProbability(null), 50)
    assert.equal(forecastProbability(0), 0)
})

test('all players use the same resolved questions; missing bets count as 50%', () => {
    const predictions = [prediction('yes', true), prediction('no', false), prediction('pending', null)]
    const scores = calculateStandings(predictions, [bet('yes', 80), bet('pending', 100), bet('outside-family', 100)])
    const player = scores.find(s => s.username === 'Player')
    close(player.score, (.04 + .25) / 2)
    assert.equal(player.resolvedCount, 2)
    assert.equal(player.defaultCount, 1)
    assert.equal(player.submittedCount, 2)
    assert.equal(scores.find(s => s.username === 'Author').score, null)
    assert.equal(scores.find(s => s.username === 'Author').rank, null)
})

test('no outcomes or no predictions never produces a winner or a fake perfect score', () => {
    assert.deepEqual(calculateStandings([], []), [])
    for (const entry of calculateStandings([prediction('pending', null)], [bet('pending', 100)])) {
        assert.equal(entry.score, null)
        assert.equal(entry.rank, null)
    }
})

test('historical toggle reproduces linear totals and reverses ranking direction', () => {
    const predictions = [prediction('a', true), prediction('b', true)]
    const bets = [bet('a', 70, 'Honest'), bet('b', 70, 'Honest'), bet('a', 100, 'Extreme'), bet('b', 50, 'Extreme')]
    const brier = calculateStandings(predictions, bets)
    assert.equal(brier[0].username, 'Honest')
    close(brier[0].score, .09)
    const old = calculateStandings(predictions, bets, 'linear')
    assert.equal(old[0].username, 'Extreme')
    assert.equal(old[0].score, 50)
    assert.equal(old[1].score, 40)
    assert.equal(old.find(s => s.username === 'Author').score, 0)
})

test('true ties share competition ranks despite floating point noise', () => {
    const scores = calculateStandings([prediction('yes', true), prediction('no', false)], [
        bet('yes', 80, 'A'), bet('no', 20, 'A'), bet('yes', 100, 'B'), bet('no', 50, 'B'),
        bet('yes', 80, 'C'), bet('no', 20, 'C'),
    ])
    assert.deepEqual(scores.slice(0, 3).map(s => s.rank), [1, 1, 3])
    assert.deepEqual(rankStandings(scores.filter(s => s.username !== 'A')).slice(0, 2).map(s => s.rank), [1, 2])
})

test('ranking uses full precision rather than rounded display scores', () => {
    const scores = calculateStandings([prediction('yes', true)], [bet('yes', 80.001, 'Z'), bet('yes', 80, 'A')])
    assert.equal(scores[0].username, 'Z')
    assert.equal(scores[1].rank, 2)
    assert.equal(formatScore(scores[0].score), formatScore(scores[1].score))
})

test('Brier expected loss is uniquely minimized by reporting your belief', () => {
    for (const belief of [0, .2, .5, .6, .8, 1]) {
        const honest = belief * brierScore(belief * 100, true) + (1 - belief) * brierScore(belief * 100, false)
        for (let report = 0; report <= 100; report++) {
            const loss = belief * brierScore(report, true) + (1 - belief) * brierScore(report, false)
            close(loss - honest, (report / 100 - belief) ** 2)
        }
    }
})

test('historical eligibility is fixed; future completed seasons cannot gain the old toggle', () => {
    assert.equal(canCompareLegacyScoring(2025), true)
    assert.equal(canCompareLegacyScoring(2026), false)
    assert.equal(canCompareLegacyScoring(2030), false)
})

test('changing or unresolving an outcome recalculates the average and count', () => {
    const bets = [bet('a', 80), bet('b', 20)]
    const score = outcome => calculateStandings([prediction('a', true), prediction('b', outcome)], bets)[0]
    close(score(false).score, .04)
    close(score(true).score, .34)
    close(score(null).score, .04)
    assert.equal(score(null).resolvedCount, 1)
})
