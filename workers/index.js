const fs = require('fs');
const path = require('path');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !(match[1].trim() in process.env)) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

loadEnv();

const jobs = {
  'send-welcome-email': require('./jobs/send-welcome-email'),
};

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'default',
  async (job) => {
    const handler = jobs[job.name];
    if (!handler) throw new Error(`No handler registered for job "${job.name}"`);
    return handler(job.data);
  },
  { connection }
);

worker.on('completed', (job) => console.log(`Completed "${job.name}" (${job.id})`));
worker.on('failed', (job, err) => console.error(`Failed "${job?.name}" (${job?.id}):`, err.message));

console.log('Worker listening for jobs on the "default" queue...');
