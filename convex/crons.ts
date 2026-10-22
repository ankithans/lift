import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';
const crons = cronJobs();
crons.interval('Sync WHOOP every 30 minutes', { minutes: 30 }, internal.whoopStore.sweep, {});
export default crons;
