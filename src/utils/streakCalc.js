/**
 * @param {string | Date} date
 */
export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * @param {any[]} instances
 * @param {number} timesPerWeek
 */
export function calculateWeeklyStreak(instances, timesPerWeek) {
  const completed = instances.filter((/** @type {any} */ i) =>
    i.status === "completed"
  );

  /** @type {Record<string, number>} */
  const weeks = {};
  for (const instance of completed) {
    const monday = getMonday(instance.start_time);
    const key = monday.getTime().toString();
    weeks[key] = (weeks[key] || 0) + 1;
  }

  let streak = 0;
  const now = new Date();
  const thisMonday = getMonday(now);

  // Check if current week's goal is met
  const thisWeekCount = weeks[thisMonday.getTime().toString()] || 0;
  if (thisWeekCount >= timesPerWeek) {
    streak++;
  }

  // Check previous weeks
  const checkMonday = new Date(thisMonday);
  checkMonday.setDate(checkMonday.getDate() - 7);

  while (true) {
    const count = weeks[checkMonday.getTime().toString()] || 0;
    if (count >= timesPerWeek) {
      streak++;
      checkMonday.setDate(checkMonday.getDate() - 7);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * @param {any[]} instances
 */
export function getWeeklyProgress(instances) {
  const now = new Date();
  const thisMonday = getMonday(now).getTime();

  const completedThisWeek = instances.filter((/** @type {any} */ i) => {
    if (i.status !== "completed") return false;
    const monday = getMonday(i.start_time).getTime();
    return monday === thisMonday;
  });

  return completedThisWeek.length;
}
