import { SyncType, SyncTrigger } from "../../common/types/db";
import { getSyncRepository, getCastRepository, getPeopleRepository, getCrewRepository } from "../../db/repositories";
import { logger as loxDBlogger } from "../../lib/logger";

export async function syncCastPeople({ trigger }: { trigger: SyncTrigger }) {
  const SyncRepo = await getSyncRepository();
  
  return await SyncRepo.manageAction<Awaited<ReturnType<typeof syncPeople>>>({
    trigger,
    type: SyncType.MOVIES_CAST,
    action: async () => {
      const CastRepo = await getCastRepository();
      const missingCastPeople = await CastRepo.getCastRolesWithMissingPeople();
      return await syncPeople(missingCastPeople);
    }
  });
}

export async function syncCrewPeople({ trigger }: { trigger: SyncTrigger }) {
  const SyncRepo = await getSyncRepository();
  return await SyncRepo.manageAction<Awaited<ReturnType<typeof syncPeople>>>({
    trigger,
    type: SyncType.MOVIES_CREW,
    action: async () => {
      const CrewRepo = await getCrewRepository();
      const missingCrewPeople = await CrewRepo.getCrewRolesWithMissingPeople();
      return await syncPeople(missingCrewPeople);
    }
  });
}

export async function syncPeople(peopleIds: number[]) {
  if (peopleIds.length === 0) {
    return {
      peopleIds,
      syncedCount: 0
    };
  }

  const PeopleRepo = await getPeopleRepository();
  const synced = await PeopleRepo.syncPeople(peopleIds);
  if (synced.length === 0) {
    const message = `Attempted to sync ${peopleIds.length} people, but 0 were synced. Attempted IDs: ${peopleIds.join(', ')}`;
    loxDBlogger.error(message);
    throw new Error(message);
  }

  return {
    peopleIds,
    syncedCount: synced.length
  };
}