import { MoreThan, Not } from "typeorm";
import { SyncStatus, SyncTrigger, SyncType } from "../../common/types/db";
import { Sync } from "../entities";
import { getDataSource } from "../orm";

export type ManagedAction<T extends {}> = () => Promise<T & { syncedCount: number; secondaryId?: string; }>;

function minutesAgo(min: number, date: Date = new Date()) {
  return new Date(date.getTime() - (min * 60 * 1000));
}

export const getSyncRepository = async () => (await getDataSource()).getRepository(Sync).extend({
  async queueSync({ trigger = SyncTrigger.SYSTEM, username, type }: { trigger: SyncTrigger, username?: string, type?: SyncType }) {
    const created = this.create({ username, trigger, type });
    const sync = await this.save(created);
    const minStart = minutesAgo(10); // wait for a rogue sync before we close that and start a new one
    const systemWhere = {
      trigger,
      username,
      id: Not(sync.id),
      started: MoreThan(minStart)
    };
    const syncsInProgress = await this.find({
      where: [
        { ...systemWhere, status: SyncStatus.PENDING },
        { ...systemWhere, status: SyncStatus.IN_PROGRESS }
      ]
    });

    return { syncsInProgress, sync };
  },

  async skipSync(sync: Sync) {
    sync.status = SyncStatus.SKIPPED;
    sync.finished = new Date();
    sync.numSynced = 0;
    return await this.save(sync);
  },

  async startSync(sync: Sync) {
    sync.status = SyncStatus.IN_PROGRESS;
    sync.started = new Date();
    return await this.save(sync);
  },

  async endSync(sync: Sync, {
    type,
    numSynced,
    secondaryId,
    errorMessage
  }: Partial<Sync> = {}) {
    if (type) {
      sync.type = type;
    }

    if (numSynced) {
      sync.numSynced = numSynced;
    }

    if (errorMessage) {
      sync.errorMessage = errorMessage;
      sync.status = SyncStatus.FAILED;
    } else {
      sync.status = SyncStatus.COMPLETE;
    }

    sync.secondaryId = secondaryId;
    sync.finished = new Date();

    return await this.save(sync);
  },

  async manageAction<T extends {}>({ trigger, type, action }: { trigger: SyncTrigger; type: SyncType; action: ManagedAction<T> }) {
    const sync = this.create({ trigger, type });
    await this.startSync(sync);

    try {
      const result = await action();
      await this.endSync(sync, { numSynced: result.syncedCount, secondaryId: result.secondaryId });
      return result;
    } catch (error: any) {
      await this.endSync(sync, { errorMessage: String(error.message) });
      throw error;
    }
  },

  async clearUnfinished({ trigger }: { trigger: SyncTrigger }) {
    return Promise.all([
      this.delete({ trigger, status: SyncStatus.IN_PROGRESS }),
      this.delete({ trigger, status: SyncStatus.PENDING })
    ]);
  }
});