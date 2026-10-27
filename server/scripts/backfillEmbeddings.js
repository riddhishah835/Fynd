import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Event from '../src/models/Event.js';
import User from '../src/models/User.js';
import { embedEvent, embedSponsor } from '../src/services/embeddingService.js';

const delay = (milliseconds) => new Promise((resolvePromise) => {
  setTimeout(resolvePromise, milliseconds);
});

export async function backfillEmbeddings() {
  try {
    await connectDB();
    const events = await Event.find({ status: 'published' }).select('+embedding');
    const sponsors = await User.find({
      role: 'sponsor',
      $or: [{ embedding: { $exists: false } }, { embedding: { $size: 0 } }],
    }).select('+embedding');
    const tasks = [
      ...events.map((event) => ({ label: `event ${event.title}`, run: () => embedEvent(event._id) })),
      ...sponsors.map((sponsor) => ({
        label: `sponsor ${sponsor.organization}`,
        run: () => embedSponsor(sponsor._id),
      })),
    ];
    let failures = 0;

    for (let index = 0; index < tasks.length; index += 1) {
      const task = tasks[index];
      const succeeded = await task.run();
      if (!succeeded) failures += 1;
      console.info(
        `[${index + 1}/${tasks.length}] ${succeeded ? 'Embedded' : 'Failed'} ${task.label}`,
      );
      if (index < tasks.length - 1) await delay(700);
    }

    console.info(`Embedding backfill complete: ${tasks.length - failures} succeeded, ${failures} failed.`);
    return { total: tasks.length, failures };
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  backfillEmbeddings().catch((error) => {
    console.error('Embedding backfill failed:', error);
    process.exitCode = 1;
  });
}
