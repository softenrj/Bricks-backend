import { Snapshot } from "../../model/snapshot.js";
import { snapShotFile } from "../../model/snapshotfile.js";
import { CronSchedule, Job } from "../../types/jobs.js";

const SnapshotCleanerHandler = async () => {
    console.log('🏆 Snapshot cleaner job started at', new Date().toISOString());

    const snaps = await Snapshot.find({
        expiresAt: { $lt: new Date() }
    });

    const snapIds = snaps.map(s => s._id);

    if (snapIds.length === 0) {
        console.log('No expired snapshots found');
        return;
    }

    await snapShotFile.deleteMany({
        snapshotId: { $in: snapIds }
    });

    await Snapshot.deleteMany({
        _id: { $in: snapIds }
    });

    console.log('Snapshot cleaner job completed at', new Date().toISOString());
};

export const SnapshotCleaner: Job = {
    name: "snapshot cleaner",
    description: "remove the orphen or expired snapshot",
    enabled: true,
    handler: SnapshotCleanerHandler,
    schedule: CronSchedule.EVERY_DAY_MIDNIGHT
}