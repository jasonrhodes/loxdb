import { SyncType, SyncStatus, SyncTrigger } from "../../common/types/db";
import { Sync } from "../../db/entities";
import { getSyncRepository, getCastRepository, getPeopleRepository, getCrewRepository } from "../../db/repositories";
import { logger as loxDBlogger } from "../../lib/logger";

export async function syncCastPeople() {
  const SyncRepo = await getSyncRepository();
  const { sync } = await SyncRepo.queueSync({ trigger: SyncTrigger.SYSTEM });
  sync.type = SyncType.MOVIES_CAST;
  const CastRepo = await getCastRepository();
  const missingCastPeople = await CastRepo.getCastRolesWithMissingPeople();
  return syncPeople(sync, missingCastPeople);
}

export async function syncCrewPeople() {
  const SyncRepo = await getSyncRepository();
  const { sync } = await SyncRepo.queueSync({ trigger: SyncTrigger.SYSTEM });
  sync.type = SyncType.MOVIES_CREW;
  const CrewRepo = await getCrewRepository();
  const missingCrewPeople = await CrewRepo.getCrewRolesWithMissingPeople();
  return syncPeople(sync, missingCrewPeople);
}

export async function syncPeople(sync: Sync, peopleIds: number[]) {
  if (peopleIds.length === 0) {
    return {
      peopleIds,
      syncedCount: 0
    };
  }

  const SyncRepo = await getSyncRepository();
  SyncRepo.save(sync);

  const PeopleRepo = await getPeopleRepository();
  const synced = await PeopleRepo.syncPeople(peopleIds);
  if (synced.length > 0) {
    await SyncRepo.endSync(sync, {
      status: SyncStatus.COMPLETE,
      numSynced: synced.length
    });
  } else {
    const message = `Attempted to sync ${peopleIds.length} people, but 0 were synced. Attempted IDs: ${peopleIds.join(', ')}`;
    loxDBlogger.error(message);

    await SyncRepo.endSync(sync, {
      status: SyncStatus.FAILED,
      numSynced: 0
    });
    
    throw new Error(message);
  }

  return {
    peopleIds,
    syncedCount: synced.length
  };
}