import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRanges, parseGroups } from '../assets/ranges.mjs';

test('ranges are 1-based and deduplicated',()=>assert.deepEqual(parseRanges('1-3, 3, 6',7),[0,1,2,5]));
test('explicit page order is retained',()=>assert.deepEqual(parseRanges('5,1-2',7),[4,0,1]));
test('bad ranges fail',()=>assert.throws(()=>parseRanges('5-2',7)));
test('out of bounds fails',()=>assert.throws(()=>parseRanges('8',7)));
test('empty group fails',()=>assert.throws(()=>parseRanges('1,,3',7)));
test('multiple groups produce separate ranges',()=>assert.deepEqual(parseGroups('1-2,4,5-6',6),[[0,1],[3],[4,5]]));
