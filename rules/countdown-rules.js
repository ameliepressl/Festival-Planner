// Calendar-day arithmetic; workdays are Monday–Friday, without holiday deductions.
function festivalCountdown(today, start, end = start) {
  function dayNumber(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use an ISO calendar date.');
    const time=Date.parse(value+'T00:00:00Z');
    if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)throw new Error('Invalid calendar date.');
    return time/86400000;
  }
  const now=dayNumber(today),opening=dayNumber(start),ending=dayNumber(end);
  const days=Math.max(0,opening-now);
  let workdays=Math.floor(days/7)*5;
  for(let i=0;i<days%7;i++){
    const weekday=new Date((now+i)*86400000).getUTCDay();
    if(weekday!==0&&weekday!==6)workdays++;
  }
  return {days,workdays,status:now<opening?'upcoming':now===opening?'today':now<=ending?'ongoing':'ended'};
}
if(typeof module!=='undefined')module.exports={festivalCountdown};
