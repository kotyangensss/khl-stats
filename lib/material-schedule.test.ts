import test from 'node:test';
import assert from 'node:assert/strict';
import { validDay, shiftDay, monthFromDay, moscowToday, filterSchedule } from './material-schedule';
import type { Game } from './types';

test('calendar days cross month and year boundaries without using the browser timezone', () => {
  assert.deepEqual([shiftDay('2026-12-31',1),monthFromDay('2027-01-01'),moscowToday(new Date('2026-10-24T22:00:00Z'))], ['2027-01-01','0127','2026-10-25']);
});
test('invalid dates are rejected rather than normalised', () => {
  assert.deepEqual(['2026-02-29','2026-13-01','nonsense','2028-02-29'].map(validDay),[false,false,false,true]);
});
test('team and live filters combine and include away games', () => {
  const games = [{id:1,status:'LIVE',teamA:{id:1},teamB:{id:2}},{id:2,status:'SCHEDULED',teamA:{id:2},teamB:{id:3}},{id:3,status:'LIVE',teamA:{id:4},teamB:{id:3}}] as Game[];
  assert.deepEqual(filterSchedule(games,2,true).map(game=>game.id),[1]);
});
