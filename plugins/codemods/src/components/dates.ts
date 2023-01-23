import { DateTime, Interval } from 'luxon';
import humanizeDuration from 'humanize-duration';

export const humanizeDate = (date: string): string => {
  const createdAtTime = DateTime.fromISO(date);
  const formatted = Interval.fromDateTimes(createdAtTime, DateTime.local())
    .toDuration()
    .valueOf();

  return `${humanizeDuration(formatted, { round: true })} ago`;
};
