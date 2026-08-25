const test = require('node:test');
const assert = require('node:assert/strict');
const { weatherLocationFromPrompt } = require('../packages/ai/tools/weather');

test('extracts explicit weather locations', () => {
  assert.equal(weatherLocationFromPrompt('What is the weather in Amsterdam today?'), 'Amsterdam');
  assert.equal(weatherLocationFromPrompt('forecast for Pune'), 'Pune');
});

test('weather needs a location and unrelated questions skip lookup', () => {
  assert.equal(weatherLocationFromPrompt('weather outside'), '');
  assert.equal(weatherLocationFromPrompt('What causes rainbows?'), null);
});
