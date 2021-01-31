import { PS2ApiToken } from '../consts';
import { PS2StreamingEventDTO, PS2StreamingLookup, PS2StreamingEventListenerFn, PS2StreamingEventListener } from './types';
import { HostName, PS2StreamingEvent } from './consts';
import { consoleCatch } from '../utils';
import { mapValues, values, remove, invert } from 'lodash';
import WebSocket from 'ws';

export class PS2StreamingClient
{
  // Singleton didn't work well with ps2 streaming API.
  public static async getInstance(): Promise<PS2StreamingClient>
  {
    const instance = new this();

    return new Promise<PS2StreamingClient>((resolve, reject) => {
      const timeoutReject = setTimeout(() => { reject('PS2StreamingClient connection failed.') }, 20000);
      instance._ws.once('open', async function open() {
        clearTimeout(timeoutReject);
        return resolve(instance);
      });
    });
  };

  private _listeners: Partial<Record<PS2StreamingEvent, Array<PS2StreamingEventListener>>>;
  private _ws: WebSocket;
  private constructor() {
    this._ws = new WebSocket(
      `wss://${HostName}/streaming?environment=ps2&service-id=s:${PS2ApiToken}`,
      { timeout: 20000, handshakeTimeout: 20000, perMessageDeflate: false }
    );

    this._listeners = mapValues(invert(PS2StreamingEvent), ()=>[]);

    this._ws.once('open', async () => {
      this._ws.on('error', consoleCatch);

      this._ws.on('message', async (message) => {
        const { payload }: { payload: PS2StreamingEventDTO } = JSON.parse(message.toString());

        if (payload?.event_name === undefined || !values(PS2StreamingEvent).includes(payload.event_name)) return;
        const event = payload.event_name as PS2StreamingEvent;

        const listeners = this._listeners[event];
        if (!Array.isArray(listeners)) return;

        const filteredListeners = listeners.filter(listener => {
          if (listener.lookup.experienceIds) {
            return listener.lookup.experienceIds.includes(payload.experience_id ?? '')
          }
          return true;
        });

        filteredListeners.forEach(async (listener) => listener.fn(payload).catch(consoleCatch));
      });
    });

    this._ws.on('open', async () => {
      Object.keys(this._listeners).forEach(event => {
        const ps2StreamingEvent = event as PS2StreamingEvent;
        const listeners = this._listeners[ps2StreamingEvent];
        if (!Array.isArray(listeners)) return;

        listeners.forEach(listener => this.sendSubscribe(ps2StreamingEvent, listener));
      });
    });
  }

  // PS2StreamingClient
  private sendSubscribe(event: PS2StreamingEvent, listener: PS2StreamingEventListener) {
    const eventNames = [];
    if (listener.lookup.experienceIds && listener.lookup.experienceIds.length > 0) {
      listener.lookup.experienceIds.forEach(xpId => {
        eventNames.push(`${event}_experience_id_${xpId}`);
      });
    } else {
      eventNames.push(event);
    }

    const subscribeMessage = {
      'service': 'event',
      'action': 'subscribe',
      ...listener.lookup,
      eventNames,
    };
    this._ws.send(JSON.stringify(subscribeMessage));
  }

  public subscribe(event: PS2StreamingEvent, listenerFn: PS2StreamingEventListenerFn, lookup: PS2StreamingLookup = { worlds: ['13'] }): void {
    const listeners = this._listeners[event];
    if (!Array.isArray(listeners)) throw(`${event} event listeners array not found.`);

    const listener: PS2StreamingEventListener = {
      fn: listenerFn,
      lookup
    };
    listeners.push(listener);

    this.sendSubscribe(event, listener);
  }

  public unsubscribe(event: PS2StreamingEvent, lookup: { worlds?: Array<string>, characters?: Array<string> } = { worlds: ['13'] }): void {
    const listeners = this._listeners[event];
    if (!Array.isArray(listeners)) throw(`${event} event listeners array not found.`);

    remove(listeners, ()=>true);

    const unsubscribeMessage = {
      'service': 'event',
      'action': 'clearSubscribe',
      ...lookup,
      'eventNames': [event],
    };
    this._ws.send(JSON.stringify(unsubscribeMessage));
  }
}
