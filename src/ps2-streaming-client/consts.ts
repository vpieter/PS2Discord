export const HostName = 'push.planetside2.com';
export const UserAgent = 'ps2discord-client';

export enum PS2StreamingEvent {
  'FacilityControl' = 'FacilityControl',
  'ContinentLock' = 'ContinentLock',
  'PlayerLogin' = 'PlayerLogin',
  'PlayerLogout' = 'PlayerLogout',
  'PlayerFacilityCapture' = 'PlayerFacilityCapture',
  'PlayerFacilityDefend' = 'PlayerFacilityDefend',
  'GainExperience' = 'GainExperience',
  'Death' = 'Death',
};
