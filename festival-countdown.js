(function () {
  const root=document.querySelector('#festival-countdown');
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'});
  window.updateFestivalCountdown=function () {
    const parts=Object.fromEntries(formatter.formatToParts(new Date()).map(part=>[part.type,part.value]));
    const today=`${parts.year}-${parts.month}-${parts.day}`;
    const result=festivalCountdown(today,state.event.startDate,state.event.endDate);
    // "230 days left" explains itself; the other states get a short line above the number.
    const heading={upcoming:'Until the festival',today:'Starts today',ongoing:'Festival in progress',ended:'Festival has ended'}[result.status];
    root.querySelector('.countdown-label').textContent=result.status==='upcoming'?'':heading;
    root.dataset.status=result.status;
    root.querySelector('#countdown-days').textContent=result.days;
    root.querySelector('#countdown-day-unit').textContent=result.days===1?'day left':'days left';
    root.querySelector('#countdown-workdays').textContent=`${result.workdays} ${result.workdays===1?'workday':'workdays'}`;
    root.setAttribute('aria-label',`${heading.toLowerCase()}: ${result.days} calendar days left, including ${result.workdays} workdays. Workdays are Monday to Friday; holidays are not deducted.`);
  };
  window.updateFestivalCountdown();
  setInterval(window.updateFestivalCountdown,60000);
  window.addEventListener('focus',window.updateFestivalCountdown);
})();
