import { consoleCatch } from '../utils';
import { ps2Zones, ps2Factions } from '../app';
import { PS2ApiToken, PS2MainOutfitId } from '../consts';
import { PS2RestResult, ZoneVM, ZoneDTO, FacilityVM, FacilityDTO, OutfitDTO, OutfitVM, OufitMemberDTO, OnlineOutfitVM, MainOutfitVM, OutfitMemberVM, FactionVM, FactionDTO, CharacterFactionDTO } from './types';
import { UserAgent, HostName, PS2RestRequest, PS2RestResultCollections, PS2FactionColors } from './consts';
import { RestClient } from 'typed-rest-client/RestClient';
import { isEmpty, sortBy, keys } from 'lodash';

export class PS2RestClient
{
  // Singleton
  private static _instance: PS2RestClient;
  public static getInstance(userAgent: string = UserAgent): PS2RestClient {
    if (isEmpty(userAgent)) throw('user agent required.');

    return this._instance || (this._instance = new this(userAgent));
  };

  private _rest: RestClient;
  private constructor(userAgent: string) {
    this._rest = new RestClient(
      userAgent,
      `http://${HostName}/s:${PS2ApiToken}/get/ps2:v2/`,
    );
    this._rest.client.requestOptions = { socketTimeout : 20000 };
  };

  // PS2RestClient
  public getFactions = async (): Promise<Array<FactionVM>> => {
    const queryParams = {
      'c:limit': '100',
      'c:lang': 'en',
      'c:show': ['code_tag', 'name', 'faction_id'].join(','),
    };

    const resultPromise = this._rest.get<PS2RestResult<FactionDTO>>(
      PS2RestRequest.Faction,
      { queryParameters: { params: queryParams }},
    );
    const factions = (await resultPromise)?.result?.[PS2RestResultCollections.Faction];
    if (!factions) return Promise.reject(`getFactions() failed.`);

    const result: Array<FactionVM> = factions.map((faction) => {
      const factionVM: FactionVM = {
        id: faction.faction_id,
        name: faction.name.en,
        alias: faction.code_tag,
      };

      if (keys(PS2FactionColors).includes(faction.code_tag)) {
        factionVM.color = PS2FactionColors[faction.code_tag];
      }

      return factionVM;
    });

    return result;
  }

  public getZones = async (): Promise<Array<ZoneVM>> => {
    const queryParams = {
      'c:limit': '1000',
      'c:lang': 'en',
      'c:show': ['zone_id', 'name'].join(','),
    };

    const resultPromise = this._rest.get<PS2RestResult<ZoneDTO>>(
      PS2RestRequest.Zone,
      { queryParameters: { params: queryParams }},
    );
    const zones = (await resultPromise)?.result?.[PS2RestResultCollections.Zone];
    if (!zones) return Promise.reject(`getZones() failed.`);

    const result: Array<ZoneVM> = zones.map((zone) => ({
      id: zone.zone_id,
      name: zone.name.en,
    }));

    return result;
  };

  public getFacility = async (facilityId: string | number): Promise<FacilityVM> => {
    const queryParams = {
      'facility_id': facilityId,
      'c:limit': '1',
      'c:lang': 'en',
      'c:show': ['facility_id', 'facility_name', 'facility_type', 'zone_id'].join(','),
    }

    const resultPromise = this._rest.get<PS2RestResult<FacilityDTO>>(
      PS2RestRequest.MapRegion,
      { queryParameters: { params: queryParams }}
    );

    const facilities = (await resultPromise)?.result?.[PS2RestResultCollections.MapRegion];
    if (!facilities?.length) return Promise.reject(`getFacility(${facilityId}) failed.`);

    const result: FacilityVM = facilities.map((facility) => ({
      id: facility.facility_id,
      name: facility.facility_name,
      type: facility.facility_type,
      zone: ps2Zones.find(zone => zone.id === facility.zone_id) as ZoneVM,
    }))[0];

    return result;
  };

  getOutfit = async (lookup: {outfitId?: string, outfitAlias?: string}): Promise<OutfitVM> => {
    const queryParams = {
      ... lookup.outfitId ? { 'outfit_id': lookup.outfitId } : {},
      ... lookup.outfitAlias ? { 'alias_lower': lookup.outfitAlias.toLowerCase() } : {},
      'c:limit': '1',
      'c:lang': 'en',
      'c:resolve': 'leader(name.first,faction_id)',
      'c:hide': ['name_lower', 'alias_lower', 'time_created', 'time_created_date'].join(','),
    }

    const resultPromise = this._rest.get<PS2RestResult<OutfitDTO>>(
      PS2RestRequest.Outfit,
      { queryParameters: { params: queryParams }},
    );

    const outfits = (await resultPromise)?.result?.[PS2RestResultCollections.Outfit];
    if (!outfits?.length) return Promise.reject(`getOufit(${JSON.stringify(lookup)}) failed.`);

    const result: OutfitVM = outfits.map((outfit) => ({
      id: outfit.outfit_id,
      alias: outfit.alias,
      name: outfit.name,
      leader: outfit.leader?.name?.first || 'null',
      faction: ps2Factions.find(faction => faction.id === (outfit.leader?.faction_id || 0)) as FactionVM,
      memberCount: Number(outfit.member_count),
    }))[0];

    return result;
  };

  getMainOutfit = async (): Promise<MainOutfitVM> => {
    const outfit = await this.getOutfit({ outfitId: PS2MainOutfitId }).catch(consoleCatch);
    if (outfit === undefined) return Promise.reject();

    const outfitMemberRequestLimit = 5000;

    let onlineMemberCount = 0;
    const members: Array<OutfitMemberVM> = [];
    for (let requestStart = 0; requestStart < outfit.memberCount; requestStart+=outfitMemberRequestLimit) {
      const queryParams = {
        'outfit_id': outfit.id,
        'c:limit': outfitMemberRequestLimit,
        'c:start': requestStart,
        'c:resolve': 'online_status',
        'c:show': ['character_id'].join(','),
        'c:join': ['character_name', 'on:character_id', 'show:name.first', 'inject_at:data'].join('^'),
        '&c:sort': 'character_id',
      };

      const resultPromise = this._rest.get<PS2RestResult<OufitMemberDTO>>(
        PS2RestRequest.OutfitMember,
        { queryParameters: { params: queryParams }},
      );
      const outfitMembers = (await resultPromise)?.result?.[PS2RestResultCollections.OutfitMember];
      if (!outfitMembers) return Promise.reject(`getMainOutfit() members not found.`);

      const result: Array<OutfitMemberVM> = outfitMembers.map(member => ({
        id: member.character_id,
        name: member.data?.name?.first || 'null',
        online: member.online_status !== '0',
      }));

      onlineMemberCount += result.filter(member => member.online).length;
      members.push(...result);
    }

    const result: MainOutfitVM = {
      ...outfit,
      onlineMemberCount,
      members: sortBy(members, member => member.name.toLowerCase()),
    }

    return result;
  };

  getOnlineOutfit = async (lookup: {outfitId?: string, outfitAlias?: string}): Promise<OnlineOutfitVM> => {
    const outfit = await this.getOutfit(lookup).catch(consoleCatch);
    if (outfit === undefined) return Promise.reject();

    const outfitMemberRequestLimit = 5000;

    const onlineMembers: Array<string> = [];
    for (let requestStart = 0; requestStart < outfit.memberCount; requestStart+=outfitMemberRequestLimit) {
      const queryParams = {
        'outfit_id': outfit.id,
        'c:limit': outfitMemberRequestLimit,
        'c:start': requestStart,
        'c:resolve': 'online_status',
        'c:show': ['character_id'].join(','),
        'c:join': ['character_name', 'on:character_id', 'show:name.first', 'inject_at:data'].join('^'),
        '&c:sort': 'character_id',
      };

      const resultPromise = this._rest.get<PS2RestResult<OufitMemberDTO>>(
        PS2RestRequest.OutfitMember,
        { queryParameters: { params: queryParams }},
      );
      const outfitMembers = (await resultPromise)?.result?.[PS2RestResultCollections.OutfitMember];
      if (!outfitMembers) return Promise.reject(`getOnlineOutfit(${JSON.stringify(lookup)}) members not found.`);

      const result: Array<string> = outfitMembers
        .filter(member => member.online_status !== '0')
        .map(member => member.data?.name?.first || 'null');

      onlineMembers.push(...result);
    }

    const result: OnlineOutfitVM = {
      ...outfit,
      onlineMembers: sortBy(onlineMembers, member => member.toLowerCase()),
    }

    return result;
  };

  getPlayerFaction = async (lookup: {characterId?: string, characterName?: string}): Promise<FactionVM> => {
    const queryParams = {
      ... lookup.characterId ? { 'character_id': lookup.characterId } : {},
      ... lookup.characterName ? { 'name.first_lower': lookup.characterName.toLowerCase() } : {},
      'c:limit': '1',
      'c:show': ['faction_id'].join(','),
    }

    const resultPromise = this._rest.get<PS2RestResult<CharacterFactionDTO>>(
      PS2RestRequest.Character,
      { queryParameters: { params: queryParams }},
    );

    const characters = (await resultPromise)?.result?.[PS2RestResultCollections.Character];
    if (!characters?.length) return Promise.reject(`getPlayerFaction(${JSON.stringify(lookup)}) failed.`);

    const result = characters.map((character) => {
      return ps2Factions.find(faction => faction.id === character.faction_id);
    })[0];
    if (!result) return Promise.reject(`getPlayerFaction(${JSON.stringify(lookup)}) failed to find faction with id.`);

    return result;
  };
}

export default PS2RestClient;
