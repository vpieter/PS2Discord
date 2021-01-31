import { PS2RestResultCollections } from './consts';

export type PS2Translations = {
  en: string;
};

export interface PS2RestResult<T> extends Partial<Record<PS2RestResultCollections, Array<T>>> {
  returned: number;
};

// Faction
export interface FactionDTO {
  faction_id: string,
  name: PS2Translations,
  code_tag: string,
};

export interface FactionVM {
  id: string,
  name: string,
  alias: string,
  color?: string,
};

// Zones
export interface ZoneDTO {
  zone_id: string,
  code: string,
  name: PS2Translations,
  description: PS2Translations,
  hex_size: string,
};

export interface ZoneVM {
  id: string,
  name: string,
};

// Facilities
export interface FacilityDTO {
  facility_id: string;
  facility_name: string;
  facility_type_id: string;
  facility_type: string;
  zone_id: string;
  map_region_id: string;
  location_x: string;
  location_z: string;
  location_y: string;
  reward_amount: string;
  reward_currency_id: string;
};

export interface FacilityVM {
  id: string,
  name: string,
  type: string,
  zone: ZoneVM,
};

export interface CapturedFacilityVM extends FacilityVM {
  contributors: Array<string>,
};

// Outfits
export interface OutfitDTO {
  outfit_id: string,
  alias: string,
  name: string,
  member_count: string,
  leader: {
    name: {
      first: string
    },
    faction_id: string
  },
};

export interface OutfitVM {
  id: string,
  alias: string,
  name: string,
  leader: string,
  faction: FactionVM,
  memberCount: number,
};

export interface OufitMemberDTO {
  character_id: string,
  online_status: string,
  data: {
    name: {
      first: string,
    },
  },
};

export interface OutfitMemberVM {
  id: string,
  name: string,
  online: boolean,
};

export interface MainOutfitVM extends OutfitVM {
  onlineMemberCount: number,
  members: Array<OutfitMemberVM>,
};

export interface OnlineOutfitVM extends OutfitVM {
  onlineMembers: string[],
};

// Characters
export interface CharacterFactionDTO {
  faction_id: string,
};
