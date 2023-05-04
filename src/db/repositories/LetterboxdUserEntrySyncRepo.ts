import { In, SelectQueryBuilder } from "typeorm";
import { LetterboxdUserEntrySync } from "../entities";
import { getDataSource } from "../orm";
import { LetterboxdUserEntrySyncStatus } from "../../common/types/db";
import { randomUUID } from "crypto";

export const getLetterboxdUserEntrySyncRepository = async () => (await getDataSource()).getRepository(LetterboxdUserEntrySync).extend({
  /**
   * This method will update all existing "REQUESTED" syncs and apply
   * a unique batch ID at the same time. Then, if the update returns
   * a non-zero, non-empty "affected" value (meaning that > 0 rows were
   * updated to "QUEUED"), we return all of the syncs that were just
   * updated by querying for the batchId.
   * 
   * This should prevent a race condition between two calls to this
   * method in (almost?) all cases. 
   * @returns 
   */
  async queueRequested() {
    const uuid = randomUUID();
    const { affected } = await this.update(
      { status: LetterboxdUserEntrySyncStatus.REQUESTED },
      { status: LetterboxdUserEntrySyncStatus.QUEUED, batchId: uuid }
    );

    if (!affected) {
      return [];
    }

    const queuedBatch = await this.findBy({ status: LetterboxdUserEntrySyncStatus.QUEUED, batchId: uuid });

    if (queuedBatch.length !== affected) {
      throw new Error(`Something went wrong while queueing the requested syncs. { "queuedBatch.length": ${queuedBatch.length}, "affected": ${affected} }`);
    }

    return queuedBatch;
  }
});
