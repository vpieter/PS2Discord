export const HostName = 'census.daybreakgames.com';
export const UserAgent = 'ps2discord-client';

export enum PS2RestRequest {
  'Faction' = 'faction',
  'Zone' = 'zone',
  'MapRegion' = 'map_region',
  'Outfit' = 'outfit',
  'OutfitMember' = 'outfit_member',
  'Character' = 'character',
}

export enum PS2RestResultCollections {
  'Faction' = 'faction_list',
  'MapRegion' = 'map_region_list',
  'Zone' = 'zone_list',
  'Outfit' = 'outfit_list',
  'OutfitMember' = 'outfit_member_list',
  'Character' = 'character_list',
}

export const PS2FactionColors: Record<string, string> = {
  'VS': 'dd00ff',
  'NC': '00aaff',
  'TR': 'ff0000',
  'NSO': 'cccccc',
};
