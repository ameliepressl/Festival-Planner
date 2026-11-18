const test=require('node:test');
const assert=require('node:assert/strict');
const {festivalCountdown}=require('../rules/countdown-rules.js');
test('counts today but excludes festival opening day',()=>{assert.deepEqual(festivalCountdown('2026-11-13','2026-11-16'),{days:3,workdays:1,status:'upcoming'});});
test('full weeks and weekends count correctly',()=>{assert.equal(festivalCountdown('2026-11-14','2026-11-16').workdays,0);assert.equal(festivalCountdown('2026-11-09','2026-11-23').workdays,10);});
test('calendar counts survive daylight-saving and year boundaries',()=>{assert.equal(festivalCountdown('2026-10-23','2026-10-26').days,3);assert.equal(festivalCountdown('2026-12-31','2027-01-04').workdays,2);});
test('today, ongoing and ended festivals never show negative counts',()=>{assert.deepEqual(festivalCountdown('2026-10-15','2026-10-15','2026-10-16'),{days:0,workdays:0,status:'today'});assert.equal(festivalCountdown('2026-10-16','2026-10-15','2026-10-16').status,'ongoing');assert.deepEqual(festivalCountdown('2026-11-11','2026-10-15','2026-10-16'),{days:0,workdays:0,status:'ended'});});
test('rejects invalid dates',()=>{assert.throws(()=>festivalCountdown('2026-02-30','2026-03-01'));});
