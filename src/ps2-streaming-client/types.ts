import { PS2StreamingEvent } from "./consts";

export type PS2StreamingEventDTO = Partial<
  FacilityControlDTO &
  ContinentLockDTO &
  PlayerLogDTO &
  GainExperienceDto
>;

export type PS2StreamingEventListenerFn = (data: PS2StreamingEventDTO) => Promise<void>;

export type PS2StreamingLookup = {
  worlds?: Array<string>,
  characters?: Array<string>,
  logicalAndCharactersWithWorlds?: boolean,
  experienceIds?: Array<string>,
};

export type PS2StreamingEventListener = {
  fn: PS2StreamingEventListenerFn,
  lookup: PS2StreamingLookup,
};

export type FacilityControlDTO = {
  "event_name": PS2StreamingEvent,
  "timestamp": string,
  "world_id": string,
  "old_faction_id": string,
  "outfit_id": string,
  "new_faction_id": string,
  "facility_id": string,
  "duration_held": string,
  "zone_id": string,
};

export type ContinentLockDTO = {
  "event_name": PS2StreamingEvent,
  "timestamp": string,
  "world_id": string,
  "zone_id": string,
  "triggering_faction": string,
  "previous_faction": string,
  "vs_population": string,
  "nc_population": string,
  "tr_population": string,
  "metagame_event_id": string,
  "event_type": string,
};

export type PlayerLogDTO = {
  "character_id": string,
  "event_name": PS2StreamingEvent,
  "timestamp": string,
  "world_id": string,
};

export type PlayerFacilityDto = {
  "character_id": string,
  "event_name": PS2StreamingEvent,
  "facility_id": string,
  "outfit_id": string,
  "timestamp": string,
  "world_id": string,
  "zone_id": string,
};

export type GainExperienceDto = {
  "amount": string,
  "character_id": string,
  "event_name": string,
  "experience_id": string,
  "loadout_id": string,
  "other_id": string,
  "timestamp": string,
  "world_id": string,
  "zone_id": string,
};

export type DeathDto = {
  "attacker_character_id": string,
  "attacker_fire_mode_id": string,
  "attacker_loadout_id": string,
  "attacker_vehicle_id": string,
  "attacker_weapon_id": string,
  "character_id": string,
  "character_loadout_id": string,
  "event_name": string,
  "is_headshot": string,
  "timestamp": string,
  "vehicle_id": string,
  "world_id": string,
  "zone_id": string,
};
